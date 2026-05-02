import 'dotenv/config';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const network = process.env.SOLANA_NETWORK ?? 'devnet';

export const connection = new Connection(
  `https://api.${network}.solana.com`,
  'confirmed',
);

export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? '3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9',
);

let _keypair: Keypair | null = null;

export function getAuthorityKeypair(): Keypair {
  if (_keypair) return _keypair;
  const b58Key = process.env.SOLANA_PRIVATE_KEY;
  if (!b58Key) throw new Error('SOLANA_PRIVATE_KEY not set in environment');
  _keypair = Keypair.fromSecretKey(bs58.decode(b58Key));
  return _keypair;
}
