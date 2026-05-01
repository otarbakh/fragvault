export type PlayerStatus = 'waiting' | 'ready' | 'locked';

export type LobbyStatus = 'open' | 'full' | 'in_progress';

export interface Player {
  slot: number;
  walletAddress: string;
  faceitUsername?: string;
  status: PlayerStatus;
}

export interface Lobby {
  players: Player[];
  prizePool: number;
  status: LobbyStatus;
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
