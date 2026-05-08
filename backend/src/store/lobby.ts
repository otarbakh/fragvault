import prisma from '../lib/prisma';
import type { LobbySlot, LobbyState, LobbyStatus, Team } from '../types/index';

type GameMode = '1v1' | '5v5';

const STAKE_PER_PLAYER = 0.001;

function maxPerTeam(mode: string): number {
  return mode === '1v1' ? 1 : 5;
}

function dbStatusToLocal(status: string): LobbyStatus {
  if (status === 'FULL') return 'full';
  if (status === 'IN_PROGRESS') return 'in_progress';
  return 'open';
}

function buildLobbyState(lobby: Awaited<ReturnType<typeof fetchLobbyWithSlots>>): LobbyState {
  const teamA: LobbySlot[] = [];
  const teamB: LobbySlot[] = [];

  for (const s of lobby.slots) {
    const slot: LobbySlot = {
      slot: s.slot,
      team: s.team as Team,
      player: {
        slot: s.slot,
        walletAddress: s.player.walletAddress,
        faceitUsername: s.player.faceitUsername ?? undefined,
        status: 'waiting',
        team: s.team as Team,
      },
    };
    if (s.team === 'TEAM_A') teamA.push(slot);
    else teamB.push(slot);
  }

  return {
    id: lobby.id,
    teamA,
    teamB,
    prizePool: lobby.prizePool,
    status: dbStatusToLocal(lobby.status),
    mode: lobby.mode,
  };
}

async function fetchLobbyWithSlots(lobbyId: string) {
  return prisma.lobby.findUniqueOrThrow({
    where: { id: lobbyId },
    include: { slots: { include: { player: true } } },
  });
}

async function getOrCreateOpenLobby(mode: GameMode) {
  const existing = await prisma.lobby.findFirst({
    where: { status: 'OPEN', mode: mode },
    orderBy: { createdAt: 'asc' },
    include: { slots: { include: { player: true } } },
  });
  // Guard: if Prisma ignored the mode filter (e.g. stale generated client),
  // don't use a lobby whose mode doesn't match.
  if (existing && existing.mode === mode) return existing;

  return prisma.lobby.create({
    data: { status: 'OPEN', mode: mode, prizePool: 0 },
    include: { slots: { include: { player: true } } },
  });
}

export async function getLobby(mode: GameMode = '5v5'): Promise<LobbyState> {
  const lobby = await getOrCreateOpenLobby(mode);
  return buildLobbyState(lobby);
}

export async function joinLobby(
  walletAddress: string,
  team: Team,
  mode: GameMode,
  faceitUsername?: string,
): Promise<{ ok: true; lobby: LobbyState } | { ok: false; error: string }> {
  const lobby = await getOrCreateOpenLobby(mode);
  const limit = maxPerTeam(mode);
  const maxPlayers = limit * 2;

  const alreadyIn = lobby.slots.some((s) => s.player.walletAddress === walletAddress);
  if (alreadyIn) return { ok: false, error: 'Wallet already in lobby' };

  const teamSlots = lobby.slots.filter((s) => s.team === team);
  if (teamSlots.length >= limit) return { ok: false, error: `${team} is full` };

  const player = await prisma.player.upsert({
    where: { walletAddress },
    update: { faceitUsername: faceitUsername ?? null },
    create: { walletAddress, faceitUsername: faceitUsername ?? null },
  });

  const nextSlot = teamSlots.length + 1;

  await prisma.lobbySlot.create({
    data: { lobbyId: lobby.id, playerId: player.id, team, slot: nextSlot },
  });

  const totalPlayers = lobby.slots.length + 1;
  const newPrizePool = totalPlayers * STAKE_PER_PLAYER;
  const newStatus = totalPlayers >= maxPlayers ? 'FULL' : 'OPEN';

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { prizePool: newPrizePool, status: newStatus },
  });

  if (newStatus === 'FULL') {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    fetch(`${backendUrl}/match/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyId: lobby.id }),
    }).catch((err: unknown) => {
      console.error('[lobby] match/create fire-and-forget failed:', err);
    });
  }

  const updated = await fetchLobbyWithSlots(lobby.id);
  return { ok: true, lobby: buildLobbyState(updated) };
}

export async function getSlotWallets(
  lobbyId: string,
  team?: 'TEAM_A' | 'TEAM_B',
): Promise<string[]> {
  const slots = await prisma.lobbySlot.findMany({
    where: { lobbyId, ...(team ? { team } : {}) },
    include: { player: true },
  });
  return slots.map((s) => s.player.walletAddress);
}

// Returns the lobby ID for the lobby where this wallet currently has a slot,
// or null if the player is not in any active lobby.
export async function getPlayerLobby(walletAddress: string): Promise<{ lobbyId: string } | null> {
  const lobby = await prisma.lobby.findFirst({
    where: { status: { in: ['OPEN', 'FULL'] } },
    include: { slots: { include: { player: true } } },
  });
  if (!lobby) return null;
  const inLobby = lobby.slots.some((s) => s.player.walletAddress === walletAddress);
  if (!inLobby) return null;
  return { lobbyId: lobby.id };
}

export async function leaveLobby(
  walletAddress: string,
): Promise<{ ok: true; lobby: LobbyState } | { ok: false; error: string }> {
  const lobby = await prisma.lobby.findFirst({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      slots: {
        some: {
          player: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
        },
      },
    },
    include: { slots: { include: { player: true } } },
  });

  if (!lobby) return { ok: false, error: 'No active lobby' };

  const slot = lobby.slots.find(
    (s) => s.player.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );
  if (!slot) return { ok: false, error: 'Wallet not in lobby' };

  await prisma.lobbySlot.delete({ where: { id: slot.id } });

  const remainingPlayers = lobby.slots.length - 1;
  const newPrizePool = remainingPlayers * STAKE_PER_PLAYER;
  const limit = maxPerTeam(lobby.mode);
  const newStatus = remainingPlayers < limit * 2 ? 'OPEN' : 'FULL';

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { prizePool: newPrizePool, status: newStatus },
  });

  const updated = await fetchLobbyWithSlots(lobby.id);
  return { ok: true, lobby: buildLobbyState(updated) };
}
