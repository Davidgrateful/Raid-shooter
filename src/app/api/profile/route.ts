import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile, mergePilotXp } from '@/lib/profile';
import { getOrCreateGuestId } from '@/lib/session';
import { rateLimit, clientIp } from '@/lib/ratelimit';

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

/*
 * Sync pilot XP up from the client and get the merged truth back.
 *
 * The engine owns XP during a run - it is awarded per kill in the play loop
 * and committed once at game-over - so the client is where the new value is
 * born. This endpoint does NOT trust it blindly: mergePilotXp takes the higher
 * of stored and incoming per pilot, which means a forged payload can inflate a
 * number but can never destroy one, and a fresh device full of zeroes cannot
 * wipe a real total.
 *
 * XP buys no power that matters competitively - a maxed pilot is 9% less
 * damage taken, and the leaderboard does not read XP at all - so this is
 * deliberately a convenience sync, not an audited transaction. Anything that
 * paid out money would need a different design.
 */
export async function POST(req: NextRequest) {
  if (!(await rateLimit('pilotxp', clientIp(req), 20, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const incoming = (body as Record<string, unknown> | null)?.pilotxp;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const session = await getSession();
  const rawGuestToken = (body as Record<string, unknown>).guestToken;
  const clientGuest =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  const key = session.siwe
    ? session.siwe.address.toLowerCase()
    : (clientGuest || (await getOrCreateGuestId(session)));

  try {
    const pilotxp = await mergePilotXp(key, incoming as Record<string, number>);
    return NextResponse.json({ ok: true, pilotxp });
  } catch {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 503 });
  }
}
