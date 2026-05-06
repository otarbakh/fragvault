import { createHmac } from 'crypto';
import { Readable } from 'stream';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getFaceitPlayerId, createFaceitMatch } from '../lib/faceit';
import { releasePool, refundLobby } from '../lib/contract';
import { getSlotWallets } from '../store/lobby';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

interface FaceitWebhookPayload {
  event: string;
  match_id?: string;
  payload?: {
    id?: string;
    results?: {
      winner?: string; // 'faction1' | 'faction2'
    };
  };
}

const releaseBody = z.object({
  lobbyId: z.string().uuid(),
  winnerTeam: z.enum(['TEAM_A', 'TEAM_B']),
});

export async function matchRoutes(app: FastifyInstance): Promise<void> {
  // Capture raw request body for HMAC verification on the webhook route.
  // preParsing consumes the stream, saves bytes to req.rawBody, and returns a
  // fresh Readable so Fastify's JSON parser still works normally.
  app.addHook('preParsing', async (req, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    req.rawBody = Buffer.concat(chunks);
    return Readable.from(req.rawBody);
  });

  // ── POST /match/create ────────────────────────────────────────────────────
  // Called internally (fire-and-forget from store/lobby.ts) when a lobby fills.
  app.post('/match/create', async (req, reply) => {
    const { lobbyId } = req.body as { lobbyId?: string };
    if (!lobbyId) return reply.status(400).send({ error: 'lobbyId required' });

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { slots: { include: { player: true } } },
    });
    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' });
    if (lobby.status !== 'FULL') return reply.status(400).send({ error: 'Lobby is not full' });
    if (lobby.faceitMatchId) return reply.status(409).send({ error: 'Match already created' });

    // Resolve FaceIT player IDs — use cached DB value or fetch from API and cache.
    const resolveId = async (player: {
      id: string;
      walletAddress: string;
      faceitUsername: string | null;
      faceitId: string | null;
    }): Promise<string> => {
      if (player.faceitId) return player.faceitId;
      if (!player.faceitUsername) {
        throw new Error(`Player ${player.walletAddress} has no FaceIT username`);
      }
      const faceitId = await getFaceitPlayerId(player.faceitUsername);
      await prisma.player.update({ where: { id: player.id }, data: { faceitId } });
      return faceitId;
    };

    const teamASlots = lobby.slots.filter((s) => s.team === 'TEAM_A');
    const teamBSlots = lobby.slots.filter((s) => s.team === 'TEAM_B');

    let teamAFaceitIds: string[];
    let teamBFaceitIds: string[];
    try {
      [teamAFaceitIds, teamBFaceitIds] = await Promise.all([
        Promise.all(teamASlots.map((s) => resolveId(s.player))),
        Promise.all(teamBSlots.map((s) => resolveId(s.player))),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve FaceIT IDs';
      app.log.error({ err, lobbyId }, 'FaceIT ID resolution failed');
      return reply.status(502).send({ error: msg });
    }

    let match: { matchId: string; matchUrl: string; status: string };
    try {
      match = await createFaceitMatch({ lobbyId, teamAFaceitIds, teamBFaceitIds });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FaceIT match creation failed';
      app.log.error({ err, lobbyId }, 'createFaceitMatch failed');
      return reply.status(502).send({ error: msg });
    }

    await prisma.$transaction([
      prisma.lobby.update({
        where: { id: lobbyId },
        data: { status: 'IN_PROGRESS', faceitMatchId: match.matchId },
      }),
      prisma.match.create({
        data: {
          lobbyId,
          faceitMatchId: match.matchId,
          status: 'IN_PROGRESS',
          prizePool: lobby.prizePool,
          platformFee: lobby.prizePool * 0.15,
        },
      }),
    ]);

    app.log.info({ lobbyId, matchId: match.matchId }, 'FaceIT match created');
    return reply.send({ matchId: match.matchId, matchUrl: match.matchUrl });
  });

  // ── POST /webhooks/faceit ─────────────────────────────────────────────────
  app.post('/webhooks/faceit', async (req, reply) => {
    const webhookSecret = process.env.FACEIT_WEBHOOK_SECRET;
    if (webhookSecret && req.rawBody) {
      const sig = req.headers['faceit-server-to-server-key'] as string | undefined;
      const expected = createHmac('sha256', webhookSecret)
        .update(req.rawBody)
        .digest('hex');
      if (sig !== expected) {
        return reply.status(401).send({ error: 'Invalid webhook signature' });
      }
    }

    const payload = req.body as FaceitWebhookPayload;
    const matchId = payload.match_id ?? payload.payload?.id;
    if (!matchId) return reply.status(400).send({ error: 'No match_id in webhook' });

    const dbMatch = await prisma.match.findFirst({
      where: { faceitMatchId: matchId },
    });
    // Unknown match — not ours, acknowledge and ignore
    if (!dbMatch) return reply.send({ ok: true });
    if (dbMatch.status === 'COMPLETED' || dbMatch.status === 'CANCELLED') {
      return reply.send({ ok: true });
    }

    const { lobbyId } = dbMatch;

    if (payload.event === 'match_status_finished') {
      const winner = payload.payload?.results?.winner; // 'faction1' | 'faction2'
      const winnerTeamInt = winner === 'faction1' ? 0 : 1;
      const winnerTeamName = winner === 'faction1' ? ('TEAM_A' as const) : ('TEAM_B' as const);

      const winnerWallets = await getSlotWallets(lobbyId, winnerTeamName);
      const sig = await releasePool(lobbyId, winnerTeamInt, winnerWallets);
      await prisma.match.update({
        where: { id: dbMatch.id },
        data: { status: 'COMPLETED', winnerTeam: winnerTeamName },
      });
      app.log.info({ sig, matchId, winnerTeam: winnerTeamName }, 'releasePool completed');
    } else if (payload.event === 'match_status_cancelled') {
      const playerWallets = await getSlotWallets(lobbyId);
      const sig = await refundLobby(lobbyId, playerWallets);
      await prisma.match.update({
        where: { id: dbMatch.id },
        data: { status: 'CANCELLED' },
      });
      app.log.info({ sig, matchId }, 'refundLobby completed');
    }

    return reply.send({ ok: true });
  });

  // ── POST /admin/match/release ─────────────────────────────────────────────
  // Manual winner declaration — for when the webhook can't be relied on.
  app.post('/admin/match/release', async (req, reply) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = releaseBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { lobbyId, winnerTeam } = parsed.data;
    const winnerTeamInt = winnerTeam === 'TEAM_A' ? 0 : 1;

    const winnerWallets = await getSlotWallets(lobbyId, winnerTeam);
    const signature = await releasePool(lobbyId, winnerTeamInt, winnerWallets);

    await prisma.$transaction(async (tx) => {
      await tx.lobby.update({ where: { id: lobbyId }, data: { status: 'COMPLETED' } });
      const dbMatch = await tx.match.findFirst({ where: { lobbyId } });
      if (dbMatch) {
        await tx.match.update({
          where: { id: dbMatch.id },
          data: { status: 'COMPLETED', winnerTeam },
        });
      }
    });

    return reply.send({ signature });
  });
}
