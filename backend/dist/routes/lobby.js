"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lobbyRoutes = lobbyRoutes;
const zod_1 = require("zod");
const lobby_1 = require("../store/lobby");
const contract_1 = require("../lib/contract");
const solana_1 = require("../lib/solana");
const joinBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
    faceitUsername: zod_1.z.string().optional(),
    team: zod_1.z.enum(['TEAM_A', 'TEAM_B']),
    txSignature: zod_1.z.string().min(1),
});
const leaveBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
});
const releaseBody = zod_1.z.object({
    lobbyId: zod_1.z.string().uuid(),
    winnerTeam: zod_1.z.number().int().min(0).max(1),
});
const refundBody = zod_1.z.object({
    lobbyId: zod_1.z.string().uuid(),
});
async function lobbyRoutes(app) {
    app.get('/lobby', async (_req, reply) => {
        return reply.send(await (0, lobby_1.getLobby)());
    });
    // Returns the current lobby ID + PDA address, initializing the on-chain account
    // if needed. Frontend calls this before building the deposit transaction.
    app.get('/lobby/deposit-info', async (_req, reply) => {
        try {
            const lobby = await (0, lobby_1.getLobby)();
            app.log.info({ lobbyId: lobby.id }, 'deposit-info: got lobby');
            const pdaAddress = await (0, contract_1.ensureLobbyInitialized)(lobby.id);
            app.log.info({ lobbyId: lobby.id, pdaAddress }, 'deposit-info: lobby initialized');
            return reply.send({
                lobbyId: (0, contract_1.lobbyIdToSeed)(lobby.id),
                pdaAddress,
                programId: solana_1.PROGRAM_ID.toBase58(),
            });
        }
        catch (err) {
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
            await (0, contract_1.verifyDepositTx)(parsed.data.txSignature, parsed.data.walletAddress);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Transaction verification failed';
            return reply.status(400).send({ error: msg });
        }
        const result = await (0, lobby_1.joinLobby)(parsed.data.walletAddress, parsed.data.team, parsed.data.faceitUsername);
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
        const playerLobby = await (0, lobby_1.getPlayerLobby)(walletAddress);
        if (playerLobby) {
            try {
                const sig = await (0, contract_1.refundSinglePlayer)(playerLobby.lobbyId, walletAddress);
                app.log.info({ sig, walletAddress }, 'refundSinglePlayer confirmed');
            }
            catch (err) {
                app.log.error({ err, walletAddress }, 'refundSinglePlayer failed — removing from DB anyway');
            }
        }
        const result = await (0, lobby_1.leaveLobby)(walletAddress);
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
            const teamKey = parsed.data.winnerTeam === 0 ? 'TEAM_A' : 'TEAM_B';
            const winnerWallets = await (0, lobby_1.getSlotWallets)(parsed.data.lobbyId, teamKey);
            const signature = await (0, contract_1.releasePool)(parsed.data.lobbyId, parsed.data.winnerTeam, winnerWallets);
            return reply.status(200).send({ signature });
        }
        catch (err) {
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
            const playerWallets = await (0, lobby_1.getSlotWallets)(parsed.data.lobbyId);
            const signature = await (0, contract_1.refundLobby)(parsed.data.lobbyId, playerWallets);
            return reply.status(200).send({ signature });
        }
        catch (err) {
            app.log.error({ err }, 'refundLobby contract call failed');
            return reply.status(500).send({ error: 'Contract call failed' });
        }
    });
}
//# sourceMappingURL=lobby.js.map