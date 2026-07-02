import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { grantItem } from '@/lib/profile';
import { getItem } from '@/lib/market';
import { isKvConfigured, redisCommand } from '@/lib/kv';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Weekly free boost for wallet-connected players. The gift rotates every
// week and is claimable once per wallet per week. Purpose: convert guests
// into wallet players (who can then receive tournament rewards/payouts) and
// give a recurring reason to come back. These are consumable boosts (health,
// shield, revive) - a run that spends one is excluded from the ranked board,
// so free boosts stay a convenience, never a competitive edge.

const ROTATION = ['consumable_shield', 'consumable_health', 'consumable_revive'];

// in-memory fallback so local dev works without KV (per-instance, ephemeral)
const memClaims = new Set<string>();

function weekKey(): string {
  return `w${Math.floor(Date.now() / (7 * 86400000))}`;
}

function weekItemId(): string {
  return ROTATION[Math.floor(Date.now() / (7 * 86400000)) % ROTATION.length];
}

async function hasClaimed(address: string): Promise<boolean> {
  const key = `shooterboard:weeklyclaim:${weekKey()}`;
  if (isKvConfigured()) {
    const r = (await redisCommand(['SISMEMBER', key, address])) as number;
    return r === 1;
  }
  return memClaims.has(`${weekKey()}:${address}`);
}

async function markClaimed(address: string): Promise<void> {
  const key = `shooterboard:weeklyclaim:${weekKey()}`;
  if (isKvConfigured()) {
    await redisCommand(['SADD', key, address]);
    // claims only matter for the current week; expire after two
    await redisCommand(['EXPIRE', key, 14 * 86400]);
  } else {
    memClaims.add(`${weekKey()}:${address}`);
  }
}

export async function GET() {
  const session = await getSession();
  const item = getItem(weekItemId());
  if (!session.siwe) {
    return NextResponse.json({ available: false, reason: 'wallet', item: item ? { id: item.id, title: item.title } : null });
  }
  const address = session.siwe.address.toLowerCase();
  const claimed = await hasClaimed(address);
  return NextResponse.json({
    available: !claimed,
    claimed,
    item: item ? { id: item.id, title: item.title } : null,
  });
}

export async function POST(req: NextRequest) {
  const allowed = await rateLimit('weeklyclaim', clientIp(req), 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ error: 'wallet_required' }, { status: 401 });
  }
  const address = session.siwe.address.toLowerCase();
  if (await hasClaimed(address)) {
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }
  const item = getItem(weekItemId());
  if (!item) {
    return NextResponse.json({ error: 'no_gift_this_week' }, { status: 503 });
  }
  await markClaimed(address);
  const profile = await grantItem(address, item);
  return NextResponse.json({ ok: true, granted: { id: item.id, title: item.title }, items: profile.items });
}
