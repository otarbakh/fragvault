import 'dotenv/config';
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromBytes,
  getBase58Encoder,
  type KeyPairSigner,
  type Address,
} from '@solana/kit';

const network = process.env.SOLANA_NETWORK ?? 'devnet';

export const rpc = createSolanaRpc(`https://api.${network}.solana.com`);
export const rpcSubscriptions = createSolanaRpcSubscriptions(
  `wss://api.${network}.solana.com`,
);

export const PROGRAM_ID = (
  process.env.PROGRAM_ID ?? '3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9'
) as Address;

let _authority: KeyPairSigner | null = null;

export async function getAuthoritySigner(): Promise<KeyPairSigner> {
  if (_authority) return _authority;
  const b58Key = process.env.SOLANA_PRIVATE_KEY;
  if (!b58Key) throw new Error('SOLANA_PRIVATE_KEY not set in environment');
  const bytes = getBase58Encoder().encode(b58Key);
  _authority = await createKeyPairSignerFromBytes(bytes);
  return _authority;
}
