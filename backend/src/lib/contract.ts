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
  initialize_lobby: Buffer.from([249, 98, 87, 186, 217, 8, 193, 242]),
  deposit:          Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]),
  release_pool:     Buffer.from([231, 58, 235, 5, 167, 9, 247, 129]),
  refund:           Buffer.from([2, 96, 183, 251, 63, 208, 46, 46]),
};

const LOBBY_SEED = Buffer.from('lobby');

function lobbyPda(lobbyId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [LOBBY_SEED, Buffer.from(lobbyId)],
    PROGRAM_ID,
  );
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
  const data = Buffer.concat([DISC.initialize_lobby, borshStr(lobbyId)]);
  return sendInstruction(authority, [
    { pubkey: lobbyPda(lobbyId), isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

// Deposit requires the player to sign from their own wallet (frontend).
// The backend cannot sign on behalf of a player — this function logs a warning.
export async function depositPlayer(
  lobbyId: string,
  playerWallet: string,
  _team: number,
): Promise<void> {
  console.warn(
    `[contract] depositPlayer: player ${playerWallet} in lobby ${lobbyId} must sign deposit from frontend`,
  );
}

export async function releasePool(
  lobbyId: string,
  winnerTeam: number,
  winnerWallets: string[],
): Promise<string> {
  const authority = getAuthorityKeypair();
  const teamByte = Buffer.alloc(1);
  teamByte.writeUInt8(winnerTeam, 0);
  const data = Buffer.concat([DISC.release_pool, borshStr(lobbyId), teamByte]);

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

export async function refundLobby(
  lobbyId: string,
  playerWallets: string[],
): Promise<string> {
  const authority = getAuthorityKeypair();
  const data = Buffer.concat([DISC.refund, borshStr(lobbyId)]);

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
