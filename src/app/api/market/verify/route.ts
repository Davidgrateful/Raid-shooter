import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getItem, marketEnabled, treasury, baseRpcUrl } from '@/lib/market';
import { claimTx, grantItem } from '@/lib/profile';
import { trackPurchase } from '@/lib/stats';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { getTop } from '@/lib/leaderboard';
import { postMessage } from '@/lib/chat';

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(baseRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`RPC failed: ${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

// Verifies a Base payment transaction and grants the purchased item:
// the tx must be confirmed, sent by the signed-in wallet, paid to the
// treasury, meet the item price, and never have been claimed before.
export async function POST(req: NextRequest) {
  if (!marketEnabled) {
    return NextResponse.json({ error: 'market_disabled' }, { status: 503 });
  }
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ error: 'wallet_required' }, { status: 401 });
  }

  // each verify makes two RPC calls; cap per wallet so a loop can't hammer
  // the (possibly paid) RPC endpoint
  if (!(await rateLimit('verify', session.siwe.address.toLowerCase(), 20, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const itemId = body?.itemId as string | undefined;
  const txHash = (body?.txHash as string | undefined)?.toLowerCase();
  const item = itemId ? getItem(itemId) : undefined;
  if (!item || item.comingSoon || !txHash || !/^0x[0-9a-f]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const [tx, receipt] = (await Promise.all([
      rpc('eth_getTransactionByHash', [txHash]),
      rpc('eth_getTransactionReceipt', [txHash]),
    ])) as [
      { from?: string; to?: string; value?: string } | null,
      { status?: string } | null,
    ];

    const address = session.siwe.address.toLowerCase();
    const priceWei = BigInt(Math.round(parseFloat(item.priceEth) * 1e6)) * BigInt('1000000000000');
    if (
      !tx ||
      !receipt ||
      receipt.status !== '0x1' ||
      tx.from?.toLowerCase() !== address ||
      tx.to?.toLowerCase() !== treasury ||
      BigInt(tx.value || '0x0') < priceWei
    ) {
      return NextResponse.json({ error: 'payment_not_verified' }, { status: 400 });
    }

    if (!(await claimTx(txHash))) {
      return NextResponse.json({ error: 'tx_already_claimed' }, { status: 400 });
    }

    const profile = await grantItem(address, item);
    // record revenue only after the payment is verified and granted; price
    // comes from the catalog, never the client. Non-blocking - a stats
    // hiccup must not fail a paid purchase.
    try {
      await trackPurchase(`wallet:${address}`, { id: item.id, priceUsd: item.priceUsd });
    } catch {
      // swallow: the player already got their item
    }

    // Free advertising: a top-20 player's purchase is social proof that
    // sells the item far better than a static catalog listing does. Only
    // fires for players currently holding a top-20 spot (the same audience
    // chat is scoped to), so this stays a rare flex, not spam on every sale.
    try {
      const top20 = await getTop(20);
      const entry = top20.find((e) => e.address === address);
      if (entry) {
        await postMessage({
          key: 'system',
          name: 'RAID SHOOTER',
          text: `${entry.name || 'A top pilot'} just equipped ${item.title}`,
          verified: true,
          cosmetics: entry.cosmetics,
        });
      }
    } catch {
      // best-effort flex message - never block a paid purchase over it
    }

    return NextResponse.json({ ok: true, items: profile.items, consumables: profile.consumables });
  } catch {
    return NextResponse.json({ error: 'verification_unavailable' }, { status: 503 });
  }
}
