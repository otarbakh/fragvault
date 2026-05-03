import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
  type AccountMeta,
} from '@solana/web3.js';
import { connection, PROGRAM_ID, getAuthorityKeypair } from './solana';

// Discriminators from fragvault-contract IDL
const DISC = {
  initialize_lobby:      Buffer.from([249, 98,  87,  186, 217, 8,   193, 242]),
  deposit:               Buffer.from([242, 35,  198, 137, 82,  225, 242, 182]),
  release_pool:          Buffer.from([231, 58,  235, 5,   167, 9,   247, 129]),
  refund:                Buffer.from([2,   96,  183, 251, 63,  208, 46,  46 ]),
  refund_single_player:  Buffer.from([63,  216, 35,  117, 106, 226, 183, 78 ]),
};

const LOBBY_SEED = Buffer.from('lobby');

// Solana PDA seeds are capped at 32 bytes. A UUID without dashes is exactly 32
// hex characters, so we strip dashes before using it as a seed or as the lobby_id
// instruction argument. The Rust contract derives the PDA from the same value.
export function lobbyIdToSeed(id: string): string {
  return id.replace(/-/g, '');
}

// Returns the raw seed Buffers for a lobby PDA.
// Accepts a raw UUID (dashes present) or an already-stripped 32-char hex string.
export function getLobbySeeds(lobbyId: string): Buffer[] {
  return [LOBBY_SEED, Buffer.from(lobbyIdToSeed(lobbyId))];
}

function lobbyPda(lobbyId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(getLobbySeeds(lobbyId), PROGRAM_ID);
  return pda;
}

// Borsh string encoding: 4-byte LE length prefix + UTF-8 bytes
function borshStr(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(utf8.length, 0);
  return Buffer.concat([len, utf8]);
}

async function sendInstruction(
  authority: Keypair,
  keys: AccountMeta[],
  data: Buffer,
): Promise<string> {
  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(connection, tx, [authority], {
    commitment: 'confirmed',
  });
}

export async function initializeLobby(lobbyId: string): Promise<string> {
  const authority = getAuthorityKeypair();
  const data = Buffer.concat([DISC.initialize_lobby, borshStr(lobbyIdToSeed(lobbyId))]);
  return sendInstruction(authority, [
    { pubkey: lobbyPda(lobbyId), isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

// Returns the PDA address for the lobby, initializing the on-chain account if it
// doesn't exist yet. Idempotent: safe to call multiple times.
export async function ensureLobbyInitialized(lobbyId: string): Promise<string> {
  const pda = lobbyPda(lobbyId);
  console.log(`[contract] ensureLobbyInitialized: lobbyId=${lobbyId} pda=${pda.toBase58()}`);
  const accountInfo = await connection.getAccountInfo(pda);
  console.log(`[contract] ensureLobbyInitialized: accountInfo=${accountInfo ? 'exists' : 'null'}`);
  if (accountInfo !== null) return pda.toBase58();
  console.log('[contract] ensureLobbyInitialized: calling initializeLobby...');
  const sig = await initializeLobby(lobbyId);
  console.log(`[contract] ensureLobbyInitialized: initialized, sig=${sig}`);
  return pda.toBase58();
}

// Verifies that txSignature is a confirmed, successful transaction whose fee
// payer (signer index 0) matches walletAddress. Throws on any mismatch.
export async function verifyDepositTx(
  txSignature: string,
  walletAddress: string,
): Promise<void> {
  const txResp = await connection.getTransaction(txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!txResp) throw new Error('Transaction not found on-chain');
  if (txResp.meta?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(txResp.meta.err)}`);

  const feePayer = txResp.transaction.message.staticAccountKeys[0]?.toBase58();
  if (feePayer !== walletAddress) {
    throw new Error(`Transaction signer ${feePayer} does not match wallet ${walletAddress}`);
  }
}

export async function releasePool(
  lobbyId: string,
  winnerTeam: number,
  winnerWallets: string[],
): Promise<string> {
  const authority = getAuthorityKeypair();
  const teamByte = Buffer.alloc(1);
  teamByte.writeUInt8(winnerTeam, 0);
  const data = Buffer.concat([DISC.release_pool, borshStr(lobbyIdToSeed(lobbyId)), teamByte]);

  const remainingKeys: AccountMeta[] = winnerWallets.map((w) => ({
    pubkey: new PublicKey(w),
    isSigner: false,
    isWritable: true,
  }));

  return sendInstruction(authority, [
    { pubkey: lobbyPda(lobbyId), isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ...remainingKeys,
  ], data);
}

// Refunds a single player's stake and removes them from the lobby on-chain.
// The lobby status is reset to Open so the freed slot can be filled again.
export async function refundSinglePlayer(
  lobbyId: string,
  playerWallet: string,
): Promise<string> {
  const authority = getAuthorityKeypair();
  const data = Buffer.concat([DISC.refund_single_player, borshStr(lobbyIdToSeed(lobbyId))]);

  return sendInstruction(authority, [
    { pubkey: lobbyPda(lobbyId), isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true },
    { pubkey: new PublicKey(playerWallet), isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

export async function refundLobby(
  lobbyId: string,
  playerWallets: string[],
): Promise<string> {
  const authority = getAuthorityKeypair();
  const data = Buffer.concat([DISC.refund, borshStr(lobbyIdToSeed(lobbyId))]);

  const remainingKeys: AccountMeta[] = playerWallets.map((w) => ({
    pubkey: new PublicKey(w),
    isSigner: false,
    isWritable: true,
  }));

  return sendInstruction(authority, [
    { pubkey: lobbyPda(lobbyId), isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ...remainingKeys,
  ], data);
}
