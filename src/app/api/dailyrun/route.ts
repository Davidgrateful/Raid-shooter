import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateGuestId, getSession } from '@/lib/session';
import { submitDaily, getDailyTop, getDailyCount, hasPlayedDaily, dayWithinWindow, type DailyEntry } from '@/lib/dailyrun';
import { verifyTurnstile } from '@/lib/turnstile';
import { clientIp, rateLimit } from '@/lib/ratelimit';

// Daily Run: everyone plays the same seeded waves once per day; standings
// live on a board that resets daily. The day key comes from the client (its
// local date) so a player's "today" matches the seed they were given.

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}
function safeDay(v: unknown): string | null {
  const s = (v || '').toString();
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(s) ? s : null;
}

export async function GET(req: NextRequest) {
  const day = safeDay(req.nextUrl.searchParams.get('day'));
  if (!day) return NextResponse.json({ error: 'bad_day' }, { status: 400 });
  const session = await getSession();
  const identity = session.siwe ? session.siwe.address.toLowerCase() : session.guestId || '';
  const [entries, total] = await Promise.all([getDailyTop(day, 100), getDailyCount(day)]);
  const played = identity ? await hasPlayedDaily(day, identity) : false;
  return NextResponse.json({ entries, total, played });
}

export async function POST(req: NextRequest) {
  const allowed = await rateLimit('dailyrun', clientIp(req), 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const session = await getSession();
  const verified = !!session.siwe;
  const identity = verified ? session.siwe!.address.toLowerCase() : await getOrCreateGuestId(session);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const day = safeDay(body.day);
  if (!day) return NextResponse.json({ error: 'bad_day' }, { status: 400 });
  // A write may only land on the day the player is actually living in. Reads
  // (GET) stay unbounded on purpose: once writes are fenced, a future day's
  // board is always empty, so reading one tells you nothing and refusing it
  // would only add a way for a skewed clock to break the board screen.
  if (!dayWithinWindow(day)) {
    return NextResponse.json({ error: 'day_out_of_range' }, { status: 400 });
  }

  const { score, pilot, name } = body as Record<string, unknown>;
  if (!isInt(score, 1, 100_000_000) || typeof pilot !== 'string' || !/^[A-Z0-9 ]{1,16}$/.test(pilot)) {
    return NextResponse.json({ error: 'invalid_run' }, { status: 400 });
  }
  let displayName: string | undefined;
  if (typeof name === 'string') {
    const cleaned = name.toUpperCase().replace(/\s+/g, ' ').trim();
    if (/^[A-Z0-9 ]{3,12}$/.test(cleaned)) displayName = cleaned;
  }
  if (!verified && !displayName) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  // guests pass Turnstile (no-op until configured); wallet players are exempt
  if (!verified) {
    const ok = await verifyTurnstile((body as Record<string, unknown>).turnstileToken as string | undefined, clientIp(req));
    if (!ok) return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
  }

  const entry: DailyEntry = {
    identity,
    name: displayName,
    score,
    pilot,
    at: Date.now(),
    verified,
  };
  const result = await submitDaily(day, entry);
  return NextResponse.json({ ok: true, verified, ...result });
}
