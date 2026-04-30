import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLobbyState, joinLobby, leaveLobby } from '../store/lobby';

const walletBody = z.object({
  walletAddress: z.string().min(32).max(44),
});

export async function lobbyRoutes(app: FastifyInstance): Promise<void> {
  // GET /lobby — current lobby state
  app.get('/lobby', async (_req, reply) => {
    return reply.send(getLobbyState());
  });

  // POST /lobby/join
  app.post('/lobby/join', async (req, reply) => {
    const parsed = walletBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const result = joinLobby(parsed.data.walletAddress);
    if (!result.ok) {
      return reply.status(409).send({ error: result.error });
    }

    return reply.status(200).send({ slot: result.slot, lobby: getLobbyState() });
  });

  // POST /lobby/leave
  app.post('/lobby/leave', async (req, reply) => {
    const parsed = walletBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const result = leaveLobby(parsed.data.walletAddress);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error });
    }

    return reply.status(200).send({ lobby: getLobbyState() });
  });
}
