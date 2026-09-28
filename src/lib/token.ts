/*==============================================================================
$RAIDSHOOTER - the launch panel's configuration

Read from public env vars (inlined at build time, so a change needs a
redeploy - same as every other NEXT_PUBLIC_ setting here):

  NEXT_PUBLIC_RAIDSHOOTER_TOKEN_ADDRESS   the official contract address
  NEXT_PUBLIC_RAIDSHOOTER_TOKEN_CHAIN     optional; defaults to Base, the
                                          chain the operator confirmed
  NEXT_PUBLIC_RAIDSHOOTER_TOKEN_BUY_URL   optional https link to buy

Nothing here is invented. With no address set the panel says the token is
launching and that the real address will appear on this site and only here -
which is the most useful thing it can say before launch, because the first
thing that follows any token announcement is someone posting a fake contract.

Every value is validated rather than trusted: the token launches on Base, so
anything but a 0x-prefixed 40-hex EVM address is treated as unset (a pasted
address from the wrong chain must never appear as "official"), and a buy link
that is not plain https is dropped. A typo in Vercel should produce "launching
soon", not a broken or dangerous link on the command deck.
==============================================================================*/

const EVM = /^0x[a-fA-F0-9]{40}$/;

export interface TokenInfo {
  symbol: string;
  address: string | null;
  chain: string | null;
  buyUrl: string | null;
}

export function readTokenInfo(env: {
  address?: string; chain?: string; buyUrl?: string;
} = {
  // referenced literally so Next can inline them into the client bundle
  address: process.env.NEXT_PUBLIC_RAIDSHOOTER_TOKEN_ADDRESS,
  chain: process.env.NEXT_PUBLIC_RAIDSHOOTER_TOKEN_CHAIN,
  buyUrl: process.env.NEXT_PUBLIC_RAIDSHOOTER_TOKEN_BUY_URL,
}): TokenInfo {
  const address = (env.address || '').trim();
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
    chain: /^[A-Za-z0-9 .-]{1,24}$/.test(chain) ? chain : 'Base',
    buyUrl,
  };
}

/** 0x1234…abcd - enough to recognise, never enough to mistake for another. */
export function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
