import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLobby, joinLobby, leaveLobby, getSlotWallets, getPlayerLobby } from '../store/lobby';
import {
  ensureLobbyInitialized,
  verifyDepositTx,
  releasePool,
  refundLobby,
  refundSinglePlayer,
  lobbyIdToSeed,
} from '../lib/contract';
import { PROGRAM_ID } from '../lib/solana';

const joinBody = z.object({
  walletAddress: z.string().min(32).max(44),
  faceitUsername: z.string().optional(),
  team: z.enum(['TEAM_A', 'TEAM_B']),
  txSignature: z.string().min(1),
  mode: z.enum(['1v1', '5v5']).default('5v5'),
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

export async function lobbyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/lobby', async (req, reply) => {
    const query = req.query as { mode?: string };
    const mode = query.mode === '1v1' ? '1v1' as const : '5v5' as const;
    return reply.send(await getLobby(mode));
  });

  // Returns the current lobby ID + PDA address, initializing the on-chain account
  // if needed. Frontend calls this before building the deposit transaction.
  app.get('/lobby/deposit-info', async (req, reply) => {
    const query = req.query as { mode?: string };
    const mode = query.mode === '1v1' ? '1v1' as const : '5v5' as const;
    try {
      const lobby = await getLobby(mode);
      app.log.info({ lobbyId: lobby.id, mode }, 'deposit-info: got lobby');
      const pdaAddress = await ensureLobbyInitialized(lobby.id);
      app.log.info({ lobbyId: lobby.id, pdaAddress }, 'deposit-info: lobby initialized');
      return reply.send({
        lobbyId: lobbyIdToSeed(lobby.id),
        pdaAddress,
        programId: PROGRAM_ID.toBase58(),
      });
    } catch (err) {
      app.log.error({ err }, 'deposit-info failed');
      const msg = err instanceof Error ? err.message : 'Failed to prepare deposit';
      return reply.status(500).send({ error: msg });
    }
  });

  app.post('/lobby/join', async (req, reply) => {
    const parsed = joinBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    // Verify the deposit transaction is confirmed on-chain before saving the player.
    try {
      await verifyDepositTx(parsed.data.txSignature, parsed.data.walletAddress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction verification failed';
      return reply.status(400).send({ error: msg });
    }

    const result = await joinLobby(parsed.data.walletAddress, parsed.data.team, parsed.data.mode, parsed.data.faceitUsername);
    if (!result.ok) {
      return reply.status(409).send({ error: result.error });
    }

    return reply.status(200).send({ lobby: result.lobby });
  });

  app.post('/lobby/leave', async (req, reply) => {
    const parsed = leaveBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { walletAddress } = parsed.data;

    // Attempt on-chain refund before removing from DB.
    // If the refund fails (e.g. devnet hiccup) we still remove from DB and log the
    // error, otherwise the player would be stuck unable to leave via the UI at all.
    const playerLobby = await getPlayerLobby(walletAddress);
    if (playerLobby) {
      try {
        const sig = await refundSinglePlayer(playerLobby.lobbyId, walletAddress);
        app.log.info({ sig, walletAddress }, 'refundSinglePlayer confirmed');
      } catch (err) {
        app.log.error({ err, walletAddress }, 'refundSinglePlayer failed — removing from DB anyway');
      }
    }

    const result = await leaveLobby(walletAddress);
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
      const teamKey = parsed.data.winnerTeam === 0 ? ('TEAM_A' as const) : ('TEAM_B' as const);
      const winnerWallets = await getSlotWallets(parsed.data.lobbyId, teamKey);
      const signature = await releasePool(parsed.data.lobbyId, parsed.data.winnerTeam, winnerWallets);
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
      const playerWallets = await getSlotWallets(parsed.data.lobbyId);
      const signature = await refundLobby(parsed.data.lobbyId, playerWallets);
      return reply.status(200).send({ signature });
    } catch (err) {
      app.log.error({ err }, 'refundLobby contract call failed');
      return reply.status(500).send({ error: 'Contract call failed' });
    }
  });
}
