import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { claimStreak, claimStreakPilot, STREAK_REWARD_ITEM_ID, STREAK_PILOT_ITEM_ID } from '@/lib/streak';
import { getItem } from '@/lib/market';
import { grantItem } from '@/lib/profile';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Grants a free consumable at every 3-day streak milestone. No wallet
// required - the reward lands in the same profile store purchases use
// (profile.ts), keyed by the leaderboard-style identity (wallet or guest),
// so it works identically for guests and wallet players.
export async function POST(req: NextRequest) {
  if (!(await rateLimit('streak_claim', clientIp(req), 10, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const session = await getSession();
  const body = await req.json().catch(() => null);
  const rawGuestToken = (body as Record<string, unknown> | null)?.guestToken;
  const clientGuestToken =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  const key = session.siwe
    ? session.siwe.address.toLowerCase()
    : (clientGuestToken || (await getOrCreateGuestId(session)));

  // Day-30 grand prize: a fixed pilot, granted once. The board sends
  // target:'pilot' for this; everything else is the recurring 3-day
  // consumable claim below.
  if ((body as Record<string, unknown> | null)?.target === 'pilot') {
    const pilotResult = await claimStreakPilot(key);
    if (!pilotResult.ok) {
      return NextResponse.json({ error: pilotResult.error }, { status: 409 });
    }
    const pilot = getItem(STREAK_PILOT_ITEM_ID);
    if (!pilot) {
      return NextResponse.json({ error: 'no_reward_configured' }, { status: 503 });
    }
    const profile = await grantItem(key, pilot);
    return NextResponse.json({ ok: true, granted: { id: pilot.id, title: pilot.title, kind: 'pilot' }, items: profile.items });
  }

  const result = await claimStreak(key);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  const item = getItem(STREAK_REWARD_ITEM_ID);
  if (!item) {
    return NextResponse.json({ error: 'no_reward_configured' }, { status: 503 });
  }
  const profile = await grantItem(key, item);
  return NextResponse.json({ ok: true, granted: { id: item.id, title: item.title }, days: result.days, consumables: profile.consumables });
}
