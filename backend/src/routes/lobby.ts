import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLobby, joinLobby, leaveLobby } from '../store/lobby';
import {
  depositPlayer,
  releasePool,
  refundLobby,
} from '../lib/contract';

const joinBody = z.object({
  walletAddress: z.string().min(32).max(44),
  faceitUsername: z.string().optional(),
  team: z.enum(['TEAM_A', 'TEAM_B']),
});

const leaveBody = z.object({
  walletAddress: z.string().min(32).max(44),
});

const releaseBody = z.object({
  lobbyId: z.string().uuid(),
  winnerTeam: z.number().int().min(0).max(1),
});

const refundBody = z.object({
  lobbyId: z.string().uuid(),
});

const TEAM_INDEX: Record<'TEAM_A' | 'TEAM_B', number> = {
  TEAM_A: 0,
  TEAM_B: 1,
};

export async function lobbyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/lobby', async (_req, reply) => {
    return reply.send(await getLobby());
  });

  app.post('/lobby/join', async (req, reply) => {
    const parsed = joinBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const result = await joinLobby(parsed.data.walletAddress, parsed.data.team, parsed.data.faceitUsername);
    if (!result.ok) {
      return reply.status(409).send({ error: result.error });
    }

    // Fire-and-forget: player must co-sign from frontend; logs a warning if SOLANA_PRIVATE_KEY absent
    void depositPlayer(
      result.lobby.teamA[0]?.player?.walletAddress ?? parsed.data.walletAddress,
      parsed.data.walletAddress,
      TEAM_INDEX[parsed.data.team],
    ).catch((err: unknown) => app.log.warn({ err }, 'depositPlayer contract call failed'));

    return reply.status(200).send({ lobby: result.lobby });
  });

  app.post('/lobby/leave', async (req, reply) => {
    const parsed = leaveBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const result = await leaveLobby(parsed.data.walletAddress);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error });
    }

    return reply.status(200).send({ lobby: result.lobby });
  });

  // POST /lobby/release — authority only, called when match result is known
  app.post('/lobby/release', async (req, reply) => {
    const parsed = releaseBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    try {
      const signature = await releasePool(parsed.data.lobbyId, parsed.data.winnerTeam);
      return reply.status(200).send({ signature });
    } catch (err) {
      app.log.error({ err }, 'releasePool contract call failed');
      return reply.status(500).send({ error: 'Contract call failed' });
    }
  });

  // POST /lobby/refund — authority only, called when match is cancelled
  app.post('/lobby/refund', async (req, reply) => {
    const parsed = refundBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    try {
      const signature = await refundLobby(parsed.data.lobbyId);
      return reply.status(200).send({ signature });
    } catch (err) {
      app.log.error({ err }, 'refundLobby contract call failed');
      return reply.status(500).send({ error: 'Contract call failed' });
    }
  });
}
