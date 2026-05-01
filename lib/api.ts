const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function getLobby() {
  const res = await fetch(`${API_URL}/lobby`, { cache: 'no-store' });
  return res.json();
}

export async function verifyFaceit(username: string): Promise<FaceitProfile> {
  const res = await fetch(`${API_URL}/faceit/verify/${encodeURIComponent(username)}`);
  return res.json();
}

export async function joinLobby(walletAddress: string, faceitUsername?: string) {
  const res = await fetch(`${API_URL}/lobby/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, faceitUsername }),
  });
  return res.json();
}

export async function leaveLobby(walletAddress: string) {
  const res = await fetch(`${API_URL}/lobby/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  return res.json();
}

export interface FaceitProfile {
  verified: boolean;
  nickname: string;
  avatar: string;
  skillLevel: number;
  elo: number;
  error?: string;
}

// Types mirroring backend/src/types/index.ts
export type PlayerStatus = 'waiting' | 'ready' | 'locked';
export type LobbyStatus = 'open' | 'full' | 'in_progress';

export interface Player {
  slot: number;
  walletAddress: string;
  status: PlayerStatus;
}

export interface LobbySlot {
  slot: number;
  player: Player | null;
}

export interface LobbyState {
  slots: LobbySlot[];
  prizePool: number;
  status: LobbyStatus;
}
