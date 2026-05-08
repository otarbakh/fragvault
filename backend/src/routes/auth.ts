import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { getFaceitPlayerId } from '../lib/faceit';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_in_production';
const BCRYPT_ROUNDS = 10;

const registerBody = z.object({
  faceitUsername: z.string().min(1),
  walletAddress: z.string().min(32).max(44),
  password: z.string().min(8),
});

const loginBody = z.object({
  faceitUsername: z.string().min(1),
  password: z.string().min(1),
});

function signToken(player: { id: string; faceitUsername: string | null; walletAddress: string }): string {
  return jwt.sign(
    { playerId: player.id, faceitUsername: player.faceitUsername, walletAddress: player.walletAddress },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { faceitUsername, walletAddress, password } = parsed.data;

    const existing = await prisma.player.findFirst({
      where: { OR: [{ faceitUsername }, { walletAddress }] },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Username or wallet already registered' });
    }

    let faceitId: string;
    try {
      faceitId = await getFaceitPlayerId(faceitUsername);
    } catch {
      return reply.status(400).send({ error: `FaceIT user "${faceitUsername}" not found` });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const player = await prisma.player.create({
      data: { faceitUsername, walletAddress, faceitId, passwordHash },
    });

    return reply.status(201).send({ token: signToken(player) });
  });

  app.post('/auth/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { faceitUsername, password } = parsed.data;

    const player = await prisma.player.findFirst({ where: { faceitUsername } });
    if (!player?.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, player.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    return reply.send({ token: signToken(player) });
  });

  app.get('/auth/me', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { playerId: string };
      const player = await prisma.player.findUnique({
        where: { id: payload.playerId },
        select: { id: true, faceitUsername: true, walletAddress: true, faceitId: true, createdAt: true },
      });
      if (!player) return reply.status(404).send({ error: 'Player not found' });
      return reply.send(player);
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
}
