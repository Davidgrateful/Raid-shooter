import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { PUBLIC_CATALOG, marketEnabled, baseNetwork } from '@/lib/market';
import { OFFICIAL_TOKEN_ADDRESS } from '@/lib/token';
import { checkConfigInput, getTokenPayConfig, quote, saveTokenPayConfig, RATE_GRACE_MS, MAX_DISCOUNT_PCT } from '@/lib/tokenpay';

export const dynamic = 'force-dynamic';

// The token's price in its most liquid Base pool, as a REFERENCE for the
// operator only - checkout never prices from it (see src/lib/tokenpay.ts).
async function poolReference(): Promise<{ priceUsd: number; perUsd: number; liquidityUsd: number | null; dex: string; url: string } | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${OFFICIAL_TOKEN_ADDRESS}`, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { pairs?: { chainId?: string; dexId?: string; url?: string; priceUsd?: string; liquidity?: { usd?: number } }[] };
    const pairs = (data.pairs || []).filter((p) => p.chainId === 'base' && Number(p.priceUsd) > 0);
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const top = pairs[0];
    if (!top) return null;
    const priceUsd = Number(top.priceUsd);
    return {
      priceUsd,
      perUsd: Math.round(1 / priceUsd),
      liquidityUsd: typeof top.liquidity?.usd === 'number' ? top.liquidity.usd : null,
      dex: top.dexId || 'dex',
      url: top.url || '',
    };
  } catch {
    return null;
  }
}

async function view() {
  const [cfg, reference] = await Promise.all([getTokenPayConfig(true), poolReference()]);
  const blockers: string[] = [];
  if (!marketEnabled) blockers.push('No treasury set (NEXT_PUBLIC_BASE_TREASURY) - the Armory cannot take payments.');
  if (baseNetwork !== 'base') blockers.push('The Armory is on Base Sepolia (testnet); the token is on Base mainnet. Set NEXT_PUBLIC_BASE_NETWORK=base.');
  const samples = PUBLIC_CATALOG.filter((i) => !i.comingSoon)
    .sort((a, b) => a.priceUsd - b.priceUsd)
    .filter((i, idx, arr) => arr.findIndex((x) => x.priceUsd === i.priceUsd) === idx)
    .slice(0, 5)
    .map((i) => ({ id: i.id, title: i.title, priceUsd: i.priceUsd, priceToken: quote(i.priceUsd, { ...cfg, enabled: true }) }));
  return {
    config: cfg,
    live: cfg.enabled && !!cfg.perUsd && blockers.length === 0,
    blockers,
    samples,
    reference,
    graceMinutes: RATE_GRACE_MS / 60_000,
    maxDiscountPct: MAX_DISCOUNT_PCT,
  };
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'market.manage');
  if (!auth.ok) return auth.res;
  return NextResponse.json(await view());
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'market.manage');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => null)) as { enabled?: unknown; perUsd?: unknown; discountPct?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const problem = checkConfigInput(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const perUsd = body.perUsd === null || body.perUsd === '' || body.perUsd === undefined ? null : Number(body.perUsd);
  const cfg = await saveTokenPayConfig(
    { enabled: body.enabled as boolean, perUsd, discountPct: Number(body.discountPct ?? 0) },
    auth.identity.actor
  );
  await audit({
    actor: auth.identity.actor,
    action: 'tokenpay.update',
    detail: `${cfg.enabled ? 'ON' : 'OFF'} · ${cfg.perUsd ? cfg.perUsd.toLocaleString('en-US') : '-'} tokens/$1 · ${cfg.discountPct}% off`,
  });
  return NextResponse.json({ ok: true, ...(await view()) });
}
