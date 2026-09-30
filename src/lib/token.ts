/*==============================================================================
$RAIDSHOOTER - the launch panel's configuration

The token is LIVE. Its contract address is fixed in code below, NOT read
from an env var: the address is the one thing on this panel that must never be
wrong, and a Vercel typo or a compromised dashboard must not be able to put a
different "official" address in front of players. Changing it takes a reviewed
commit.

It was checked on Base mainnet (chain 8453) before it went in: the contract
reports name "Raid Shooter", symbol "$Raidshooter", 18 decimals.

Optional public env vars (inlined at build time, so a change needs a redeploy):

  NEXT_PUBLIC_RAIDSHOOTER_TOKEN_CHAIN     label only; defaults to Base
  NEXT_PUBLIC_RAIDSHOOTER_TOKEN_BUY_URL   https link to buy

A buy link that is not plain https (http:, javascript:, garbage) is dropped.
Without one the panel still links the contract on BaseScan, so players can
verify it themselves.
==============================================================================*/

const EVM = /^0x[a-fA-F0-9]{40}$/;

/** The official $RAIDSHOOTER contract on Base. Verified on-chain; see above. */
export const OFFICIAL_TOKEN_ADDRESS = '0x0af55bfd094090f787a82666ac6496f66e95cba3';

export function isBaseAddress(a: string): boolean {
  return EVM.test(a);
}

export interface TokenInfo {
  symbol: string;
  address: string | null;
  chain: string | null;
  buyUrl: string | null;
  explorerUrl: string | null;
}

export function readTokenInfo(env: {
  chain?: string; buyUrl?: string;
} = {
  // referenced literally so Next can inline them into the client bundle
  chain: process.env.NEXT_PUBLIC_RAIDSHOOTER_TOKEN_CHAIN,
  buyUrl: process.env.NEXT_PUBLIC_RAIDSHOOTER_TOKEN_BUY_URL,
}): TokenInfo {
  const address = OFFICIAL_TOKEN_ADDRESS;
  const chain = (env.chain || '').trim();
  let buyUrl: string | null = null;
  const rawUrl = (env.buyUrl || '').trim();
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol === 'https:') buyUrl = u.toString();
    } catch { /* not a URL - dropped */ }
  }
  return {
    symbol: '$RAIDSHOOTER',
    address: EVM.test(address) ? address : null,
    explorerUrl: EVM.test(address) ? `https://basescan.org/token/${address}` : null,
    chain: /^[A-Za-z0-9 .-]{1,24}$/.test(chain) ? chain : 'Base',
    buyUrl,
  };
}

/** Where a player gets the token: the operator's link if set, else the
 *  official contract on Uniswap (Base), where its pool is. */
export function buyLink(info: TokenInfo): string | null {
  if (info.buyUrl) return info.buyUrl;
  return info.address ? `https://app.uniswap.org/swap?chain=base&outputCurrency=${info.address}` : null;
}

/** 0x1234…abcd - enough to recognise, never enough to mistake for another. */
export function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** 1_000_000 -> "1M", 8_450_000 -> "8.45M", 250_000 -> "250K" */
export function compactTokens(n: number): string {
  const f = (v: number, unit: string) => `${Number(v.toFixed(v < 100 ? 2 : 0))}${unit}`;
  if (n >= 1e9) return f(n / 1e9, 'B');
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e3) return f(n / 1e3, 'K');
  return String(Math.floor(n));
}
