"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const lobby_1 = require("./routes/lobby");
const faceit_1 = require("./routes/faceit");
const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_in_production';
const app = (0, fastify_1.default)({ logger: true });
async function bootstrap() {
    await app.register(cors_1.default, {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
    });
    await app.register(websocket_1.default);
    await app.register(jwt_1.default, { secret: JWT_SECRET });
    // Health check
    app.get('/health', async (_req, reply) => {
        return reply.send({ status: 'ok', service: 'FragVault API' });
    });
    // Routes
    await app.register(lobby_1.lobbyRoutes);
    await app.register(faceit_1.faceitRoutes);
    await app.listen({ port: PORT, host: '0.0.0.0' });
}
bootstrap().catch((err) => {
    app.log.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map