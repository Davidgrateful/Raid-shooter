/*==============================================================================
Paying for Armory items in $RAIDSHOOTER

Priced by ONE number the operator controls: whole tokens per US dollar.
Every item's token price is its catalogue USD price times that rate, less an
optional pay-in-token discount, rounded UP to a whole token.

Where the rate comes from (first match wins):
  1. /admin -> Token tab (stored in KV; changes apply in ~30s, no redeploy)
  2. RAIDSHOOTER_TOKENS_PER_USD env var (the original switch; still works)
  3. neither -> token checkout is off

The site never PRICES from a market feed - a thin pool is too easy to push
around to trust for that. The admin tab shows the pool's price only as a
reference for the operator's own decision. Checkout also needs the Armory to
be live on Base mainnet, because that is where the token is.

A rate change can land between a player's quote and their payment. For
RATE_GRACE_MS after a change, a payment that meets the PREVIOUS price is
still accepted, so nobody pays and then gets refused.

A payment is an ERC-20 transfer to the treasury. The server accepts it only
when the confirmed receipt carries a Transfer event emitted BY the official
token contract, FROM the signed-in wallet, TO the treasury, for at least the
item's token price - and the tx hash has never been claimed (same claimTx
ledger as ETH payments). The event is checked rather than tx.from, so a
smart-account wallet (where a bundler submits the tx) pays the same way.
==============================================================================*/

import { OFFICIAL_TOKEN_ADDRESS } from '@/lib/token';
import { isKvConfigured, redisCommand } from '@/lib/kv';

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const UNIT = BigInt(10) ** BigInt(18);

export function tokensPerUsd(raw: string | undefined = process.env.RAIDSHOOTER_TOKENS_PER_USD): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 && n < 1e15 ? n : null;
}

export const MAX_DISCOUNT_PCT = 50;

/** Whole tokens for a USD price; null when token pay is not configured. */
export function tokenPrice(priceUsd: number, rate: number | null, discountPct = 0): number | null {
  if (!rate || !(priceUsd > 0)) return null;
  const d = Math.min(MAX_DISCOUNT_PCT, Math.max(0, Math.floor(discountPct || 0)));
  // cents first so 0.3 * rate doesn't pick up float dust before the ceil
  return Math.ceil((Math.round(priceUsd * 100) * rate * (100 - d)) / 10000);
}

/*--- the operator's config ----------------------------------------------------*/
export interface TokenPayConfig {
  enabled: boolean;
  /** whole tokens per US dollar */
  perUsd: number | null;
  discountPct: number;
  /** where this came from, for the admin tab */
  source: 'admin' | 'env' | 'none';
  updatedAt?: number;
  updatedBy?: string;
  /** the rate/discount before the last change, honoured for RATE_GRACE_MS */
  prev?: { perUsd: number | null; discountPct: number };
}

export const RATE_GRACE_MS = 15 * 60_000;
const KEY = 'tokenpay:config';
const CACHE_MS = 30_000;
let memStored: Omit<TokenPayConfig, 'source'> | null = null;
let cache: { at: number; cfg: TokenPayConfig } | null = null;

function envConfig(): TokenPayConfig {
  const perUsd = tokensPerUsd();
  return { enabled: perUsd !== null, perUsd, discountPct: 0, source: perUsd !== null ? 'env' : 'none' };
}

/** Validates an operator's input. Returns an error message or null. */
export function checkConfigInput(input: { enabled?: unknown; perUsd?: unknown; discountPct?: unknown }): string | null {
  if (typeof input.enabled !== 'boolean') return 'enabled must be true or false';
  const perUsd = Number(input.perUsd);
  if (input.enabled && !(Number.isFinite(perUsd) && perUsd > 0 && perUsd < 1e15)) {
    return 'set a positive rate (whole tokens per $1) before switching it on';
  }
  const d = Number(input.discountPct ?? 0);
  if (!Number.isInteger(d) || d < 0 || d > MAX_DISCOUNT_PCT) return `discount must be a whole number from 0 to ${MAX_DISCOUNT_PCT}`;
  return null;
}

export async function getTokenPayConfig(fresh = false): Promise<TokenPayConfig> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.cfg;
  let stored: Omit<TokenPayConfig, 'source'> | null = null;
  if (isKvConfigured()) {
    try {
      const raw = (await redisCommand(['GET', KEY])) as string | null;
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      // KV hiccup: fall back to the last good answer rather than flip checkout off
      if (cache) return cache.cfg;
    }
  } else {
    stored = memStored;
  }
  const cfg: TokenPayConfig = stored ? { ...stored, source: 'admin' } : envConfig();
  cache = { at: Date.now(), cfg };
  return cfg;
}

export async function saveTokenPayConfig(
  input: { enabled: boolean; perUsd: number | null; discountPct: number },
  actor: string
): Promise<TokenPayConfig> {
  const before = await getTokenPayConfig(true);
  const next: Omit<TokenPayConfig, 'source'> = {
    enabled: input.enabled,
    perUsd: input.perUsd && input.perUsd > 0 ? input.perUsd : null,
    discountPct: Math.floor(input.discountPct || 0),
    updatedAt: Date.now(),
    updatedBy: actor,
    prev: before.enabled ? { perUsd: before.perUsd, discountPct: before.discountPct } : undefined,
  };
  if (isKvConfigured()) await redisCommand(['SET', KEY, JSON.stringify(next)]);
  else memStored = next;
  cache = null;
  return getTokenPayConfig(true);
}

/** The token price a player is quoted now; null when checkout is off. */
export function quote(priceUsd: number, cfg: TokenPayConfig): number | null {
  return cfg.enabled ? tokenPrice(priceUsd, cfg.perUsd, cfg.discountPct) : null;
}

/**
 * The least a payment may be and still count: the current quote, or - within
 * RATE_GRACE_MS of a change - the previous quote if that was lower.
 */
export function minAcceptable(priceUsd: number, cfg: TokenPayConfig, now = Date.now()): number | null {
  const current = quote(priceUsd, cfg);
  if (current === null) return null;
  if (cfg.prev && cfg.updatedAt && now - cfg.updatedAt < RATE_GRACE_MS) {
    const before = tokenPrice(priceUsd, cfg.prev.perUsd, cfg.prev.discountPct);
    if (before !== null && before < current) return before;
  }
  return current;
}

export function toRaw(wholeTokens: number): bigint {
  return BigInt(Math.ceil(wholeTokens)) * UNIT;
}

const topicAddress = (a: string) => '0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0');

export interface ReceiptLike {
  status?: string;
  logs?: { address?: string; topics?: string[]; data?: string }[];
}

/**
 * True when the receipt proves `from` paid `to` at least `minRaw` of the
 * official token. Pure - the route fetches the receipt and passes it in.
 */
export function receiptPaysToken(
  receipt: ReceiptLike | null,
  opts: { from: string; to: string; minRaw: bigint; token?: string }
): boolean {
  if (!receipt || receipt.status !== '0x1' || !Array.isArray(receipt.logs)) return false;
  const token = (opts.token || OFFICIAL_TOKEN_ADDRESS).toLowerCase();
  const from = topicAddress(opts.from);
  const to = topicAddress(opts.to);
  let paid = BigInt(0);
  for (const log of receipt.logs) {
    const t = log.topics || [];
    if (
      log.address?.toLowerCase() === token &&
      t.length === 3 &&
      t[0]?.toLowerCase() === TRANSFER_TOPIC &&
      t[1]?.toLowerCase() === from &&
      t[2]?.toLowerCase() === to &&
      typeof log.data === 'string' &&
      /^0x[0-9a-fA-F]{1,64}$/.test(log.data)
    ) {
      paid += BigInt(log.data);
    }
  }
  return paid >= opts.minRaw;
}
