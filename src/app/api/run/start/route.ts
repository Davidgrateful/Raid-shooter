import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { issueRunTicket } from '@/lib/runs';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Issues the single-use ticket a run's score is later submitted against (see
// lib/runs.ts). Identity is resolved EXACTLY as /api/leaderboard resolves it -
// wallet address, else the client's durable guest token, else the session
// cookie id - because a ticket only redeems for the identity it was issued to,
// and the two routes disagreeing about who a guest is would fail honest runs.
export async function POST(req: NextRequest) {
  // One ticket per run, and a run lasts well over a few seconds, so this
  // ceiling is far above honest play. It exists to stop a loop minting tickets.
  if (!(await rateLimit('run_start', clientIp(req), 30, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const session = await getSession();
  const body = await req.json().catch(() => null);
  const raw = (body as Record<string, unknown> | null)?.guestToken;
  const clientGuest = typeof raw === 'string' && /^[a-z0-9-]{8,40}$/i.test(raw) ? `guest:${raw.toLowerCase()}` : null;
  const identity = session.siwe
    ? session.siwe.address.toLowerCase()
    : (clientGuest || (await getOrCreateGuestId(session)));

  try {
    const { id } = await issueRunTicket(identity);
    return NextResponse.json({ ticket: id });
  } catch {
    // no ticket is a degraded run, never a blocked one - the client plays on
    return NextResponse.json({ ticket: null }, { status: 503 });
  }
}
