/*==============================================================================
$RAIDSHOOTER holder perks

A signed-in wallet's $RAIDSHOOTER balance is read straight from the token
contract on Base (balanceOf), mapped to a holder tier, and cached. The perks
are cosmetic and follow the balance - sell below a tier and it goes away on the
next check. Nothing here touches a run, a score or a rank.

  tier        default minimum        what it unlocks
  HOLDER            1,000,000        holder badge on the board + HOLDER trail
  COMMANDER        50,000,000        the badge in the Commander colour
  ADMIRAL         500,000,000        the badge in the Admiral colour

Minimums are whole tokens and adjustable without a code change:
RAIDSHOOTER_HOLDER_TIERS="1000000,50000000,500000000" (three increasing whole
numbers; anything else falls back to the defaults). The token trades freely,
so the operator should revisit these as its price moves.

Caching: the player's own check re-reads the chain when the cached answer is
older than FRESH_MS. The cached tier is kept for KEEP_S so every other viewer's
leaderboard can show the badge without an RPC call per row. A badge can
therefore be up to a day stale for a player who sold and never came back -
acceptable for a cosmetic, and the reason nothing of value hangs on it.
==============================================================================*/

import { isKvConfigured, redisCommand } from '@/lib/kv';
import { OFFICIAL_TOKEN_ADDRESS } from '@/lib/token';

export type HolderTierId = 'holder' | 'commander' | 'admiral';

export interface HolderTier {
  id: HolderTierId;
  label: string;
  /** minimum balance, whole tokens */
  min: number;
}

export interface HolderStatus {
  /** whole tokens, floored - display only */
  balance: number;
  tier: HolderTierId | null;
  /** when the chain was last read (ms) */
  at: number;
}

const DEFAULT_MINS = [1_000_000, 50_000_000, 500_000_000];
const IDS: HolderTierId[] = ['holder', 'commander', 'admiral'];
const LABELS = ['Holder', 'Commander', 'Admiral'];

/** The hue of the holder-only engine trail (see market.js). */
export const HOLDER_TRAIL_HUE = 130;

const FRESH_MS = 10 * 60_000;
const KEEP_S = 24 * 60 * 60;
const DECIMALS = BigInt(10) ** BigInt(18);
const EVM = /^0x[0-9a-f]{40}$/;

export function holderTiers(raw: string | undefined = process.env.RAIDSHOOTER_HOLDER_TIERS): HolderTier[] {
  let mins = DEFAULT_MINS;
  if (raw) {
    const parts = raw.split(',').map((s) => Number(s.trim()));
    const ok =
      parts.length === 3 &&
      parts.every((n) => Number.isSafeInteger(n) && n > 0) &&
      parts[0] < parts[1] && parts[1] < parts[2];
    if (ok) mins = parts;
  }
  return IDS.map((id, i) => ({ id, label: LABELS[i], min: mins[i] }));
}

export function tierFor(balance: number, tiers: HolderTier[] = holderTiers()): HolderTierId | null {
  let hit: HolderTierId | null = null;
  for (const t of tiers) if (balance >= t.min) hit = t.id;
  return hit;
}

/** balanceOf(address) calldata. */
export function balanceOfCall(address: string): string {
  return '0x70a08231' + address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

/** A raw 18-decimal uint256 hex result -> whole tokens (floored). */
export function wholeTokens(hex: string): number {
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) throw new Error('bad_balance');
  const raw = hex === '0x' ? BigInt(0) : BigInt(hex);
  return Number(raw / DECIMALS);
}

// The token only exists on Base mainnet, whatever network the Armory is set to.
function rpcUrl(): string {
  if (process.env.RAIDSHOOTER_RPC_URL) return process.env.RAIDSHOOTER_RPC_URL;
  if (process.env.NEXT_PUBLIC_BASE_NETWORK === 'base' && process.env.BASE_RPC_URL) return process.env.BASE_RPC_URL;
  return 'https://mainnet.base.org';
}

export async function readBalance(address: string, doFetch: typeof fetch = fetch): Promise<number> {
  const res = await doFetch(rpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to: OFFICIAL_TOKEN_ADDRESS, data: balanceOfCall(address) }, 'latest'],
    }),
    signal: AbortSignal.timeout(3000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`rpc_${res.status}`);
  const body = (await res.json()) as { result?: string; error?: unknown };
  if (typeof body.result !== 'string') throw new Error('rpc_error');
  return wholeTokens(body.result);
}

/*--- cache ------------------------------------------------------------------*/
const memory = new Map<string, HolderStatus>();
const key = (a: string) => `holder:${a}`;

async function readCache(address: string): Promise<HolderStatus | null> {
  if (!isKvConfigured()) return memory.get(address) || null;
  try {
    const raw = (await redisCommand(['GET', key(address)])) as string | null;
    return raw ? (JSON.parse(raw) as HolderStatus) : null;
  } catch {
    return null;
  }
}

async function writeCache(address: string, s: HolderStatus): Promise<void> {
  if (!isKvConfigured()) {
    memory.set(address, s);
    return;
  }
  try {
    await redisCommand(['SET', key(address), JSON.stringify(s), 'EX', KEEP_S]);
  } catch { /* a missed cache write only costs a re-read */ }
}

/**
 * The signed-in player's own status. Re-reads the chain when the cached answer
 * is stale; if the chain can't be reached, falls back to the last answer (or
 * null) rather than failing the page.
 */
export async function getHolderStatus(rawAddress: string, force = false): Promise<HolderStatus | null> {
  const address = rawAddress.toLowerCase();
  if (!EVM.test(address)) return null;
  const cached = await readCache(address);
  if (!force && cached && Date.now() - cached.at < FRESH_MS) return cached;
  try {
    const balance = await readBalance(address);
    const status: HolderStatus = { balance, tier: tierFor(balance), at: Date.now() };
    await writeCache(address, status);
    return status;
  } catch {
    return cached;
  }
}

/** Cached tiers for many board rows at once - never touches the chain. */
export async function cachedTiers(addresses: string[]): Promise<Map<string, HolderTierId>> {
  const out = new Map<string, HolderTierId>();
  const wallets = [...new Set(addresses.map((a) => a.toLowerCase()).filter((a) => EVM.test(a)))];
  if (wallets.length === 0) return out;
  if (!isKvConfigured()) {
    for (const a of wallets) {
      const s = memory.get(a);
      if (s?.tier) out.set(a, s.tier);
    }
    return out;
  }
  try {
    const raw = (await redisCommand(['MGET', ...wallets.map(key)])) as (string | null)[];
    raw.forEach((r, i) => {
      if (!r) return;
      try {
        const s = JSON.parse(r) as HolderStatus;
        if (s.tier) out.set(wallets[i], s.tier);
      } catch { /* skip a corrupt row */ }
    });
  } catch { /* no badges beats no board */ }
  return out;
}

/** Adds `holder` to every row whose wallet has a cached tier. */
export async function withHolderTiers<T extends { address?: string; identity?: string }>(
  entries: T[]
): Promise<(T & { holder?: HolderTierId })[]> {
  const tiers = await cachedTiers(entries.map((e) => e.address || e.identity || ''));
  return entries.map((e) => {
    const t = tiers.get((e.address || e.identity || '').toLowerCase());
    return t ? { ...e, holder: t } : e;
  });
}
