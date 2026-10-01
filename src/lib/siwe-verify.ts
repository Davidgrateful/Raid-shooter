/*==============================================================================
SIWE signature verification that works for every wallet a player can have

`SiweMessage.verify({ signature })` with no provider only recovers a plain
EOA signature. Reown's email / social logins (and Coinbase Smart Wallet) give
players SMART-ACCOUNT wallets, which sign differently:
  - ERC-1271: a deployed contract wallet validates the signature itself
  - ERC-6492: a not-yet-deployed one wraps the signature with its deploy data
Both fail the EOA check every time - which is exactly "social login connects,
but sign-in never completes".

So: try the EOA check first (fast, no network). If it fails, ask the chain the
message names (Base or Base Sepolia) through viem's verifyMessage, which
handles EOA, ERC-1271 and ERC-6492 in one call. Time bounds and domain/nonce
are still enforced - the fallback only replaces the signature step.
==============================================================================*/

import { SiweMessage } from 'siwe';
import { createPublicClient, http, type PublicClient } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { baseNetwork, baseRpcUrl } from '@/lib/market';

const CHAINS = { [base.id]: base, [baseSepolia.id]: baseSepolia } as const;

/** A public client for the chain a SIWE message was signed on (Base only). */
export function clientForChain(chainId: number): PublicClient | null {
  const chain = CHAINS[chainId as keyof typeof CHAINS];
  if (!chain) return null;
  // the configured RPC serves the Armory's own network; the other one uses
  // the chain's public endpoint
  const ours = (baseNetwork === 'base' ? base.id : baseSepolia.id) === chain.id;
  return createPublicClient({ chain, transport: http(ours ? baseRpcUrl : undefined, { timeout: 8000 }) }) as PublicClient;
}

export type SiweResult =
  | { ok: true; fields: SiweMessage; via: 'eoa' | 'contract' }
  | { ok: false; reason: string };

export async function verifySiwe(
  message: string,
  signature: string,
  opts: { now?: Date; client?: (chainId: number) => Pick<PublicClient, 'verifyMessage'> | null } = {}
): Promise<SiweResult> {
  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(message);
  } catch {
    return { ok: false, reason: 'malformed_message' };
  }

  // 1. a plain wallet: recovered locally, no network
  try {
    const { data } = await parsed.verify({ signature }, { suppressExceptions: false });
    return { ok: true, fields: data, via: 'eoa' };
  } catch {
    /* not an EOA signature (or not valid) - try the chain */
  }

  // 2. a smart-account wallet: the chain decides (ERC-1271 / ERC-6492)
  const now = opts.now ?? new Date();
  if (parsed.expirationTime && new Date(parsed.expirationTime) <= now) return { ok: false, reason: 'expired' };
  if (parsed.notBefore && new Date(parsed.notBefore) > now) return { ok: false, reason: 'not_yet_valid' };
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) return { ok: false, reason: 'bad_signature' };
  const client = (opts.client ?? clientForChain)(parsed.chainId);
  if (!client) return { ok: false, reason: 'unsupported_chain' };
  try {
    const valid = await client.verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return valid ? { ok: true, fields: parsed, via: 'contract' } : { ok: false, reason: 'bad_signature' };
  } catch {
    return { ok: false, reason: 'chain_unavailable' };
  }
}
