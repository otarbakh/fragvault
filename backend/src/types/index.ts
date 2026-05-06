export type PlayerStatus = 'waiting' | 'ready' | 'locked';

export type LobbyStatus = 'open' | 'full' | 'in_progress';

export type Team = 'TEAM_A' | 'TEAM_B';

export interface Player {
  slot: number;
  walletAddress: string;
  faceitUsername?: string;
  status: PlayerStatus;
  team: Team;
}

export interface Lobby {
  players: Player[];
  prizePool: number;
  status: LobbyStatus;
}

export interface LobbySlot {
  slot: number;
  team: Team;
  player: Player | null;
}

export interface LobbyState {
  id: string;
  teamA: LobbySlot[];
  teamB: LobbySlot[];
  prizePool: number;
  status: LobbyStatus;
  mode: string;
}
