import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLobby, joinLobby, leaveLobby } from '../store/lobby';

const joinBody = z.object({
  walletAddress: z.string().min(32).max(44),
  faceitUsername: z.string().optional(),
  team: z.enum(['TEAM_A', 'TEAM_B']),
});

const leaveBody = z.object({
  walletAddress: z.string().min(32).max(44),
});

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
}
