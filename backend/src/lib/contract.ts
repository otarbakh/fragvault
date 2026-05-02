import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  type Instruction,
} from '@solana/kit';
import { getInitializeLobbyInstructionAsync } from '../../../fragvault-contract/src/generated/instructions/initializeLobby';
import { getReleasePoolInstructionAsync } from '../../../fragvault-contract/src/generated/instructions/releasePool';
import { getRefundInstructionAsync } from '../../../fragvault-contract/src/generated/instructions/refund';
import { rpc, rpcSubscriptions, getAuthoritySigner } from './solana';

const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

async function sendInstruction(instruction: Instruction): Promise<string> {
  const authority = await getAuthoritySigner();
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(authority, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  );
  const signedTx = await signTransactionMessageWithSigners(txMessage);
  const signature = getSignatureFromTransaction(signedTx);
  await sendAndConfirmTransaction(
    signedTx as Parameters<typeof sendAndConfirmTransaction>[0],
    { commitment: 'confirmed' },
  );
  return signature;
}

export async function initializeLobby(lobbyId: string): Promise<string> {
  const authority = await getAuthoritySigner();
  const ix = await getInitializeLobbyInstructionAsync({ authority, lobbyId });
  return sendInstruction(ix);
}

// Deposit requires the player to sign from their own wallet (frontend).
// The backend cannot sign on behalf of a player — this function logs a warning
// and returns without sending a transaction. The DB remains the source of truth
// until the frontend sends a signed deposit transaction.
export async function depositPlayer(
  lobbyId: string,
  playerWallet: string,
  _team: number,
): Promise<void> {
  console.warn(
    `[contract] depositPlayer: player ${playerWallet} on lobby ${lobbyId} must sign deposit from the frontend`,
  );
}

export async function releasePool(
  lobbyId: string,
  winnerTeam: number,
): Promise<string> {
  const authority = await getAuthoritySigner();
  const ix = await getReleasePoolInstructionAsync({
    authority,
    lobbyId,
    winnerTeam,
  });
  return sendInstruction(ix);
}

export async function refundLobby(lobbyId: string): Promise<string> {
  const authority = await getAuthoritySigner();
  const ix = await getRefundInstructionAsync({ authority, lobbyId });
  return sendInstruction(ix);
}
