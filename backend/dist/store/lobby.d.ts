import type { LobbyState, Team } from '../types/index';
export declare function getLobby(): Promise<LobbyState>;
export declare function joinLobby(walletAddress: string, team: Team, faceitUsername?: string): Promise<{
    ok: true;
    lobby: LobbyState;
} | {
    ok: false;
    error: string;
}>;
export declare function getSlotWallets(lobbyId: string, team?: 'TEAM_A' | 'TEAM_B'): Promise<string[]>;
export declare function getPlayerLobby(walletAddress: string): Promise<{
    lobbyId: string;
} | null>;
export declare function leaveLobby(walletAddress: string): Promise<{
    ok: true;
    lobby: LobbyState;
} | {
    ok: false;
    error: string;
}>;
//# sourceMappingURL=lobby.d.ts.map