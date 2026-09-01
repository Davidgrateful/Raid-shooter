import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { grantItem } from '@/lib/profile';
import { getItem } from '@/lib/market';
import { isKvConfigured, redisCommand } from '@/lib/kv';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { weekKey as mondayWeekKey } from '@/lib/weekly';

// Weekly free boost for wallet-connected players. The gift rotates every
// week and is claimable once per wallet per week. Purpose: convert guests
// into wallet players (who can then receive tournament rewards/payouts) and
// give a recurring reason to come back. These are consumable boosts (health,
// shield, revive).
//
// CORRECTION: this comment used to claim "a run that spends one is excluded
// from the ranked board, so free boosts stay a convenience, never a
// competitive edge." That exclusion does not exist and never did. `assisted`
// is recorded onto the entry (leaderboard route) and read by nobody -
// submitEntry does not filter on it, and computeWinners assigns prizes purely
// by rank. A run that spends one of these ranks exactly like any other and is
// fully eligible for cosmetic grants and USDC payouts. That is the intended
// policy (assists are a bounded part of the loadout), but the safeguard named
// here was never implemented, so the sentence is removed rather than left
// standing as a false assurance.

const ROTATION = ['consumable_shield', 'consumable_health', 'consumable_revive'];

// in-memory fallback so local dev works without KV (per-instance, ephemeral)
const memClaims = new Set<string>();

/*
 * The gift week is the SAME week as the weekly ladder: Monday 00:00 UTC.
 *
 * It used to be `Math.floor(Date.now() / (7 * 86400000))`, an epoch-aligned
 * week - and the Unix epoch was a Thursday, so the gift rolled over on
 * Thursdays while the ladder rolled over on Mondays. Neither was wrong on its
 * own; together they made "weekly" impossible to teach, because the game meant
 * two different things by it three days apart.
 *
 * Reuses weekly.ts's key so the two can never drift again - one definition of
 * a week, imported rather than reimplemented.
 *
 * TRANSITION: claim keys change shape (w2981 -> 2026-08-31), so nobody carries
 * a claimed flag across the switch. The one-off cost is that a player who
 * already claimed this Thursday-week can claim once more in the Monday-week
 * that follows. That is a single extra consumable each, which is a far cheaper
 * outcome than the alternative bug - a key collision silently denying someone
 * a gift they never received.
 */
function weekKey(): string {
  return mondayWeekKey();
}

function weekItemId(): string {
  // rotate on the same Monday boundary: whole weeks since the epoch Monday
  const monday = Date.parse(`${mondayWeekKey()}T00:00:00Z`);
  return ROTATION[Math.floor(monday / (7 * 86400000)) % ROTATION.length];
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
