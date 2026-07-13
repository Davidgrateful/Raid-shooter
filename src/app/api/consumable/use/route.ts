import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { spendConsumable } from '@/lib/profile';

// Spends one charge of an owned consumable. The effect itself happens
// client side (heal/shield/revive) - this just decrements the stockpile
// so it can't be reused after a refresh or on another device.
//
// Guests can own consumables too now (the streak reward grants one with no
// wallet required - see /api/streak/claim), so this can no longer hard-
// require session.siwe: that left a guest able to EARN a consumable but
// never able to SPEND it - "power-ups don't work in game". Same guest-
// identity resolution as /api/leaderboard, /api/chat, /api/streak: prefer
// the client's durable localStorage token over the session cookie.
export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json().catch(() => null);
  const itemId = body?.itemId as string | undefined;
  if (!itemId || !/^consumable_[a-z]+$/.test(itemId)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const rawGuestToken = body?.guestToken as string | undefined;
  const clientGuestToken =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  const key = session.siwe
    ? session.siwe.address.toLowerCase()
    : (clientGuestToken || (await getOrCreateGuestId(session)));
  try {
    const spent = await spendConsumable(key, itemId);
    if (!spent) {
      return NextResponse.json({ error: 'none_left' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 503 });
  }
}
