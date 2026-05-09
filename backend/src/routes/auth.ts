import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { getFaceitPlayerId } from '../lib/faceit';

const JWT_SECRET           = process.env.JWT_SECRET           ?? 'dev_secret_change_in_production';
const FACEIT_CLIENT_ID     = process.env.FACEIT_CLIENT_ID     ?? '';
const FACEIT_CLIENT_SECRET = process.env.FACEIT_CLIENT_SECRET ?? '';
const OAUTH_REDIRECT_URI   = 'https://fragvault-production-7aba.up.railway.app/auth/faceit/callback';
const OAUTH_FRONTEND_URL   = process.env.FRONTEND_URL         ?? 'https://project-8fyo0.vercel.app';
const BCRYPT_ROUNDS = 10;

// Short-lived PKCE state cache.  Keyed by random `state` value; pruned on each OAuth initiation.
interface PkceEntry { codeVerifier: string; expiresAt: number; }
const pkceCache = new Map<string, PkceEntry>();
const PKCE_TTL_MS = 10 * 60 * 1000;

function prunePkceCache(): void {
  const now = Date.now();
  for (const [key, entry] of pkceCache) {
    if (entry.expiresAt < now) pkceCache.delete(key);
  }
}

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

  // ── FaceIT OAuth (Authorization Code + PKCE) ──────────────────────────────

  app.get('/auth/faceit', async (_req, reply) => {
    if (!FACEIT_CLIENT_ID) {
      return reply.status(503).send({ error: 'FaceIT OAuth not configured' });
    }
    prunePkceCache();

    const codeVerifier  = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state         = crypto.randomBytes(16).toString('hex');

    pkceCache.set(state, { codeVerifier, expiresAt: Date.now() + PKCE_TTL_MS });

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             FACEIT_CLIENT_ID,
      redirect_uri:          OAUTH_REDIRECT_URI,
      scope:                 'openid email profile',
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    return reply.redirect(`https://accounts.faceit.com/oauth/authorize?${params.toString()}`);
  });

  app.get('/auth/faceit/callback', async (req, reply) => {
    const { code, state, error: oauthError } = req.query as {
      code?: string; state?: string; error?: string;
    };

    if (oauthError || !code || !state) {
      return reply.redirect(`${OAUTH_FRONTEND_URL}/login?error=oauth_cancelled`);
    }

    const entry = pkceCache.get(state);
    if (!entry || entry.expiresAt < Date.now()) {
      return reply.redirect(`${OAUTH_FRONTEND_URL}/login?error=state_invalid`);
    }
    pkceCache.delete(state);

    // Exchange authorization code for access token
    let accessToken: string;
    try {
      const tokenRes = await fetch('https://accounts.faceit.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  OAUTH_REDIRECT_URI,
          client_id:     FACEIT_CLIENT_ID,
          client_secret: FACEIT_CLIENT_SECRET,
          code_verifier: entry.codeVerifier,
        }).toString(),
      });
      if (!tokenRes.ok) {
        app.log.error({ status: tokenRes.status, body: await tokenRes.text() }, 'FaceIT token exchange failed');
        return reply.redirect(`${OAUTH_FRONTEND_URL}/login?error=token_exchange_failed`);
      }
      const tokenData = await tokenRes.json() as { access_token: string };
      accessToken = tokenData.access_token;
    } catch (err) {
      app.log.error({ err }, 'FaceIT token exchange error');
      return reply.redirect(`${OAUTH_FRONTEND_URL}/login?error=server_error`);
    }

    // Fetch authenticated player's FaceIT profile
    let faceitId: string;
    let nickname: string;
    try {
      const meRes = await fetch('https://open.faceit.com/data/v4/players/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        app.log.error({ status: meRes.status }, 'FaceIT /players/me failed');
        return reply.redirect(`${OAUTH_FRONTEND_URL}/login?error=profile_fetch_failed`);
      }
      const me = await meRes.json() as { player_id: string; nickname: string };
      faceitId = me.player_id;
      nickname = me.nickname;
    } catch (err) {
      app.log.error({ err }, 'FaceIT profile fetch error');
      return reply.redirect(`${OAUTH_FRONTEND_URL}/login?error=server_error`);
    }

    // Find existing player by faceitId or username, or create a new record.
    // New OAuth-only players get a placeholder walletAddress until they connect Phantom.
    let player = await prisma.player.findFirst({
      where: { OR: [{ faceitId }, { faceitUsername: nickname }] },
    });

    if (player) {
      player = await prisma.player.update({
        where: { id: player.id },
        data: { faceitId, faceitUsername: nickname },
      });
    } else {
      player = await prisma.player.create({
        data: { walletAddress: `oauth:${faceitId}`, faceitId, faceitUsername: nickname },
      });
    }

    const token = signToken(player);
    return reply.redirect(`${OAUTH_FRONTEND_URL}/lobby?token=${encodeURIComponent(token)}`);
  });
}
