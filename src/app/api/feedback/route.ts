import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { addFeedback } from '@/lib/feedback';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Public: players submit feedback from in-game. Rate-limited so it can't be
// spammed into the team's inbox.
export async function POST(req: NextRequest) {
  if (!(await rateLimit('feedback', clientIp(req), 5, 60_000))) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const text = body?.text as string | undefined;
  if (!text) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 });

  const session = await getSession();
  const playerId = session.siwe?.address ? `wallet:${session.siwe.address.toLowerCase()}` : await getOrCreateGuestId(session);
  const fb = await addFeedback(text, playerId);
  return NextResponse.json({ ok: !!fb });
}
