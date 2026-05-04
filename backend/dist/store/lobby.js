"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLobby = getLobby;
exports.joinLobby = joinLobby;
exports.getSlotWallets = getSlotWallets;
exports.getPlayerLobby = getPlayerLobby;
exports.leaveLobby = leaveLobby;
const prisma_1 = __importDefault(require("../lib/prisma"));
const MAX_PER_TEAM = 5;
const STAKE_PER_PLAYER = 0.5;
function dbStatusToLocal(status) {
    if (status === 'FULL')
        return 'full';
    if (status === 'IN_PROGRESS')
        return 'in_progress';
    return 'open';
}
function buildLobbyState(lobby) {
    const teamA = [];
    const teamB = [];
    for (const s of lobby.slots) {
        const slot = {
            slot: s.slot,
            team: s.team,
            player: {
                slot: s.slot,
                walletAddress: s.player.walletAddress,
                faceitUsername: s.player.faceitUsername ?? undefined,
                status: 'waiting',
                team: s.team,
            },
        };
        if (s.team === 'TEAM_A')
            teamA.push(slot);
        else
            teamB.push(slot);
    }
    return {
        id: lobby.id,
        teamA,
        teamB,
        prizePool: lobby.prizePool,
        status: dbStatusToLocal(lobby.status),
    };
}
async function fetchLobbyWithSlots(lobbyId) {
    return prisma_1.default.lobby.findUniqueOrThrow({
        where: { id: lobbyId },
        include: { slots: { include: { player: true } } },
    });
}
async function getOrCreateOpenLobby() {
    const existing = await prisma_1.default.lobby.findFirst({
        where: { status: 'OPEN' },
        include: { slots: { include: { player: true } } },
    });
    if (existing)
        return existing;
    return prisma_1.default.lobby.create({
        data: { status: 'OPEN', prizePool: 0 },
        include: { slots: { include: { player: true } } },
    });
}
async function getLobby() {
    const lobby = await getOrCreateOpenLobby();
    return buildLobbyState(lobby);
}
async function joinLobby(walletAddress, team, faceitUsername) {
    const lobby = await getOrCreateOpenLobby();
    const alreadyIn = lobby.slots.some((s) => s.player.walletAddress === walletAddress);
    if (alreadyIn)
        return { ok: false, error: 'Wallet already in lobby' };
    const teamSlots = lobby.slots.filter((s) => s.team === team);
    if (teamSlots.length >= MAX_PER_TEAM)
        return { ok: false, error: `${team} is full` };
    const player = await prisma_1.default.player.upsert({
        where: { walletAddress },
        update: { faceitUsername: faceitUsername ?? null },
        create: { walletAddress, faceitUsername: faceitUsername ?? null },
    });
    const nextSlot = teamSlots.length + 1;
    await prisma_1.default.lobbySlot.create({
        data: { lobbyId: lobby.id, playerId: player.id, team, slot: nextSlot },
    });
    const totalPlayers = lobby.slots.length + 1;
    const newPrizePool = totalPlayers * STAKE_PER_PLAYER;
    const newStatus = totalPlayers >= MAX_PER_TEAM * 2 ? 'FULL' : 'OPEN';
    await prisma_1.default.lobby.update({
        where: { id: lobby.id },
        data: { prizePool: newPrizePool, status: newStatus },
    });
    const updated = await fetchLobbyWithSlots(lobby.id);
    return { ok: true, lobby: buildLobbyState(updated) };
}
async function getSlotWallets(lobbyId, team) {
    const slots = await prisma_1.default.lobbySlot.findMany({
        where: { lobbyId, ...(team ? { team } : {}) },
        include: { player: true },
    });
    return slots.map((s) => s.player.walletAddress);
}
// Returns the lobby ID for the lobby where this wallet currently has a slot,
// or null if the player is not in any active lobby.
async function getPlayerLobby(walletAddress) {
    const lobby = await prisma_1.default.lobby.findFirst({
        where: { status: { in: ['OPEN', 'FULL'] } },
        include: { slots: { include: { player: true } } },
    });
    if (!lobby)
        return null;
    const inLobby = lobby.slots.some((s) => s.player.walletAddress === walletAddress);
    if (!inLobby)
        return null;
    return { lobbyId: lobby.id };
}
async function leaveLobby(walletAddress) {
    const lobby = await prisma_1.default.lobby.findFirst({
        where: { status: { in: ['OPEN', 'FULL'] } },
        include: { slots: { include: { player: true } } },
    });
    if (!lobby)
        return { ok: false, error: 'No active lobby' };
    const slot = lobby.slots.find((s) => s.player.walletAddress === walletAddress);
    if (!slot)
        return { ok: false, error: 'Wallet not in lobby' };
    await prisma_1.default.lobbySlot.delete({ where: { id: slot.id } });
    const remainingPlayers = lobby.slots.length - 1;
    const newPrizePool = remainingPlayers * STAKE_PER_PLAYER;
    const newStatus = remainingPlayers < MAX_PER_TEAM * 2 ? 'OPEN' : 'FULL';
    await prisma_1.default.lobby.update({
        where: { id: lobby.id },
        data: { prizePool: newPrizePool, status: newStatus },
    });
    const updated = await fetchLobbyWithSlots(lobby.id);
    return { ok: true, lobby: buildLobbyState(updated) };
}
//# sourceMappingURL=lobby.js.map