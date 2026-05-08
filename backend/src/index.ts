import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import { lobbyRoutes } from './routes/lobby';
import { faceitRoutes } from './routes/faceit';
import { matchRoutes } from './routes/match';
import { authRoutes } from './routes/auth';

const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_in_production';

const app = Fastify({ logger: true });

async function bootstrap(): Promise<void> {
  await app.register(cors, {
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === process.env.FRONTEND_URL ||
        origin.includes('vercel.app') ||
        origin.includes('localhost')
      ) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'), false)
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.register(websocket);

  await app.register(jwt, { secret: JWT_SECRET });

  // Health check
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', service: 'FragVault API' });
  });

  // Routes
  await app.register(lobbyRoutes);
  await app.register(faceitRoutes);
  await app.register(matchRoutes);
  await app.register(authRoutes);

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
