import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import { lobbyRoutes } from './routes/lobby';
import { faceitRoutes } from './routes/faceit';

const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_in_production';

const app = Fastify({ logger: true });

async function bootstrap(): Promise<void> {
  await app.register(cors, {
    origin: FRONTEND_URL,
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

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
