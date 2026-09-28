import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { recordPlay, getStreak, STREAK_GOAL_DAYS, STREAK_PILOT_GOAL_DAYS } from '@/lib/streak';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { hasAcceptedRunSince } from '@/lib/runs';

// Same guest-identity resolution as /api/leaderboard and /api/chat: prefer
// the client's durable localStorage token (survives cookie loss - iOS
// Safari ITP, in-app browsers) over the session cookie, so a player's
// streak lands on the same identity their score and chat messages do.
function guestKeyFromBody(body: unknown): string | null {
  const raw = (body as Record<string, unknown> | null)?.guestToken;
  return typeof raw === 'string' && /^[a-z0-9-]{8,40}$/i.test(raw) ? `guest:${raw.toLowerCase()}` : null;
}

// GET: current streak, read-only, no side effects.
export async function GET(req: NextRequest) {
  const session = await getSession();
  const clientGuestToken = guestKeyFromBody({ guestToken: req.nextUrl.searchParams.get('guestToken') });
  const key = session.siwe
    ? session.siwe.address.toLowerCase()
    : (clientGuestToken || session.guestId || null);
  if (!key) {
    return NextResponse.json({ days: 0, claimedAt: 0, pilotClaimed: false, goal: STREAK_GOAL_DAYS, pilotGoal: STREAK_PILOT_GOAL_DAYS });
  }
  const streak = await getStreak(key);
  return NextResponse.json({ ...streak, goal: STREAK_GOAL_DAYS, pilotGoal: STREAK_PILOT_GOAL_DAYS });
}

// POST: record today's play. Called once per menu visit by the client -
// idempotent same-day, so extra calls are harmless.
export async function POST(req: NextRequest) {
  if (!(await rateLimit('streak_record', clientIp(req), 20, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const session = await getSession();
  const body = await req.json().catch(() => null);
  const clientGuestToken = guestKeyFromBody(body);
  const key = session.siwe
    ? session.siwe.address.toLowerCase()
    : (clientGuestToken || (await getOrCreateGuestId(session)));
  /*
   * This used to record a play for anyone who asked. The earlier fix for "the
   * streak counts opening the app" gated the CLIENT on a finished run - which
   * fixed honest players and left the route itself answering any script that
   * posted to it once a day. A day now counts only if the server has seen a
   * ticketed run accepted for this identity in the last 24 hours (the
   * leaderboard and daily routes record the day themselves when that happens;
   * this is a second door to the same room, not a way around it).
   */
  const recent = await hasAcceptedRunSince(key, Date.now() - 24 * 60 * 60 * 1000);
  if (!recent) {
    const current = await getStreak(key);
    return NextResponse.json({ days: current.days, goal: STREAK_GOAL_DAYS, recorded: false });
  }
  const days = await recordPlay(key);
  return NextResponse.json({ days, goal: STREAK_GOAL_DAYS, recorded: true });
}
