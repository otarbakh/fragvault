export declare function lobbyIdToSeed(id: string): string;
export declare function getLobbySeeds(lobbyId: string): Buffer[];
export declare function initializeLobby(lobbyId: string): Promise<string>;
export declare function ensureLobbyInitialized(lobbyId: string): Promise<string>;
export declare function verifyDepositTx(txSignature: string, walletAddress: string): Promise<void>;
export declare function releasePool(lobbyId: string, winnerTeam: number, winnerWallets: string[]): Promise<string>;
export declare function refundSinglePlayer(lobbyId: string, playerWallet: string): Promise<string>;
export declare function refundLobby(lobbyId: string, playerWallets: string[]): Promise<string>;
//# sourceMappingURL=contract.d.ts.map