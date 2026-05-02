// Augments @solana/kit with forward-looking exports used by Codama-generated code.
// These are planned APIs not yet in a stable release of @solana/kit.
declare module '@solana/kit' {
  export const SOLANA_ERROR__PROGRAM_CLIENTS__INSUFFICIENT_ACCOUNT_METAS: number;
  export const SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_ACCOUNT: number;
  export const SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_INSTRUCTION: number;
  export const SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_INSTRUCTION_TYPE: number;
  export function extendClient(client: unknown, extension: unknown): unknown;
  export interface ClientWithRpc {}
  export interface ClientWithTransactionPlanning {}
  export interface ClientWithTransactionSending {}
}
