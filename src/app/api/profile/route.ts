import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile } from '@/lib/profile';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session.siwe) {
    try {
      const profile = await getProfile(session.siwe.address.toLowerCase());
      return NextResponse.json({ authenticated: true, ...profile });
    } catch {
      return NextResponse.json({ error: 'profile_unavailable' }, { status: 503 });
    }
  }
  // Guests never own market cosmetics (purchases require a wallet), but a
  // guest CAN hold grant-only rewards (weekly gift, streak) - read their
  // profile too, without minting a fresh guestId just for a view (that only
  // happens where it's actually needed: score submit, streak record/claim).
  // Prefer the client's durable localStorage token over the session cookie
  // (same precedence as /api/leaderboard and /api/streak) so the identity
  // that earned a streak reward is the identity that sees it.
  const rawGuestToken = req.nextUrl.searchParams.get('guestToken');
  const guestKey =
    rawGuestToken && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : session.guestId;
  if (guestKey) {
    try {
      const profile = await getProfile(guestKey);
      return NextResponse.json({ authenticated: false, ...profile });
    } catch {
      // fall through to the empty response below
    }
  }
  return NextResponse.json({ authenticated: false, items: [], consumables: {} });
}
