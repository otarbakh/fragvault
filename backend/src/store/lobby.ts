import type { LobbySlot, LobbyState, LobbyStatus, Player } from '../types/index';

const TOTAL_SLOTS = 8;
const STAKE_PER_PLAYER = 0.5; // SOL

function buildEmptySlots(): LobbySlot[] {
  return Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
    slot: i + 1,
    player: null,
  }));
}

function deriveLobbyStatus(slots: LobbySlot[]): LobbyStatus {
  const filled = slots.filter((s) => s.player !== null).length;
  if (filled === 0) return 'open';
  if (filled === TOTAL_SLOTS) return 'full';
  return 'open';
}

// Single shared lobby for MVP. Replace with DB-backed store when Prisma is wired up.
const slots: LobbySlot[] = buildEmptySlots();
const walletIndex = new Map<string, number>(); // walletAddress → slot number

export function getLobbyState(): LobbyState {
  const prizePool =
    slots.filter((s) => s.player !== null).length * STAKE_PER_PLAYER;

  return {
    slots: slots.map((s) => ({ ...s })),
    prizePool,
    status: deriveLobbyStatus(slots),
  };
}

export function joinLobby(walletAddress: string): { ok: true; slot: number } | { ok: false; error: string } {
  if (walletIndex.has(walletAddress)) {
    return { ok: false, error: 'Wallet already in lobby' };
  }

  const empty = slots.find((s) => s.player === null);
  if (!empty) {
    return { ok: false, error: 'Lobby is full' };
  }

  const player: Player = { slot: empty.slot, walletAddress, status: 'waiting' };
  empty.player = player;
  walletIndex.set(walletAddress, empty.slot);

  return { ok: true, slot: empty.slot };
}

export function leaveLobby(walletAddress: string): { ok: true } | { ok: false; error: string } {
  const slotNumber = walletIndex.get(walletAddress);
  if (slotNumber === undefined) {
    return { ok: false, error: 'Wallet not in lobby' };
  }

  const slot = slots.find((s) => s.slot === slotNumber);
  if (slot) slot.player = null;
  walletIndex.delete(walletAddress);

  return { ok: true };
}

export function resetLobby(): void {
  slots.forEach((s) => { s.player = null; });
  walletIndex.clear();
}
