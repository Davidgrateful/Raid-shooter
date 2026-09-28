/*==============================================================================
Paying for Armory items in $RAIDSHOOTER

Off until the operator sets ONE number:

  RAIDSHOOTER_TOKENS_PER_USD   whole tokens per US dollar, e.g. 8450000

Every item's token price is its catalogue USD price times that rate, rounded
UP to a whole token, so the operator prices the whole Armory with one value
and re-sets it as the token moves (the site never guesses a market price - a
thin pool is too easy to push around to trust for pricing). It also needs the
Armory itself to be live on Base mainnet, because that is where the token is.

A payment is an ERC-20 transfer to the treasury. The server accepts it only
when the confirmed receipt carries a Transfer event emitted BY the official
token contract, FROM the signed-in wallet, TO the treasury, for at least the
item's token price - and the tx hash has never been claimed (same claimTx
ledger as ETH payments). The event is checked rather than tx.from, so a
smart-account wallet (where a bundler submits the tx) pays the same way.
==============================================================================*/

import { OFFICIAL_TOKEN_ADDRESS } from '@/lib/token';

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const UNIT = BigInt(10) ** BigInt(18);

export function tokensPerUsd(raw: string | undefined = process.env.RAIDSHOOTER_TOKENS_PER_USD): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 && n < 1e15 ? n : null;
}

/** Whole tokens for a USD price; null when token pay is not configured. */
export function tokenPrice(priceUsd: number, rate: number | null = tokensPerUsd()): number | null {
  if (!rate || !(priceUsd > 0)) return null;
  // cents first so 0.3 * rate doesn't pick up float dust before the ceil
  return Math.ceil((Math.round(priceUsd * 100) * rate) / 100);
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
