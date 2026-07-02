import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateGuestId, getSession } from '@/lib/session';
import { checkSubmitAllowed, getTop, getBoardCount, isPersistent, submitEntry, suspicionReason, flagRun } from '@/lib/leaderboard';
import { verifyTurnstile } from '@/lib/turnstile';
import { clientIp } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  try {
    // The board is no longer hard-capped at 50: it shows however many people
    // actually ranked. `limit` pages the rows for lighter clients (the canvas
    // game asks for fewer; the web page asks for all), while `total` always
    // reports the full field so "OF N" stays accurate. Hard ceiling of 1000
    // keeps a pathological payload from ever being returned.
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 1000;
    const [entries, total] = await Promise.all([getTop(limit), getBoardCount()]);
    return NextResponse.json({ entries, total, persistent: isPersistent() });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export async function POST(req: NextRequest) {
  const session = await getSession();

  // Guest play by default: a wallet is no longer required to post a score.
  // Wallet players get a verified entry keyed by their address; everyone
  // else gets an anonymous, device-scoped guest identity.
  const verified = !!session.siwe;
  const key = verified
    ? session.siwe!.address.toLowerCase()
    : await getOrCreateGuestId(session);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { score, level, kills, combo, pilot, time, name } = body as Record<string, unknown>;

  // Display name: 3-12 chars, letters/digits/spaces. Optional for wallet
  // players (they fall back to their address); required for guests, who
  // have no readable identity to show otherwise.
  let displayName: string | undefined;
  if (typeof name === 'string') {
    const cleaned = name.toUpperCase().replace(/\s+/g, ' ').trim();
    if (/^[A-Z0-9 ]{3,12}$/.test(cleaned)) {
      displayName = cleaned;
    }
  }
  if (!verified && !displayName) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  // Bot defense for guest scores: wallet players already proved identity by
  // signing, so they're exempt; guests must pass a Turnstile challenge. A
  // no-op until TURNSTILE_SECRET_KEY is configured.
  if (!verified) {
    const ok = await verifyTurnstile((body as Record<string, unknown>).turnstileToken as string | undefined, clientIp(req));
    if (!ok) {
      return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
    }
  }
  if (
    !isInt(score, 1, 5_000_000) ||
    !isInt(level, 1, 500) ||
    !isInt(kills, 0, 100_000) ||
    !isInt(combo, 0, 10_000) ||
    !isInt(time, 0, 86_400) ||
    typeof pilot !== 'string' ||
    !/^[A-Z0-9 ]{1,16}$/.test(pilot)
  ) {
    return NextResponse.json({ error: 'invalid_run' }, { status: 400 });
  }

  // loose plausibility bounds: the richest single kill is a boss (value 750,
  // or 3x as an elite) at the x8 combo cap, so we allow generous headroom per
  // kill and reject only kill rates far beyond human play
  if (score > kills * 8000 + 50 || kills > time * 12 + 40) {
    return NextResponse.json({ error: 'implausible_run' }, { status: 400 });
  }

  try {
    const allowed = await checkSubmitAllowed(key);
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    const entry = {
      address: key,
      name: displayName,
      score,
      level,
      kills,
      combo,
      pilot,
      time,
      at: Date.now(),
      verified,
    };
    const result = await submitEntry(entry);
    // outlier runs still rank (no false-positive punishment) but are copied
    // to the admin review queue - the gate for tournament payouts
    const reason = suspicionReason(entry);
    if (reason) {
      flagRun(entry, reason).catch(() => {});
    }
    return NextResponse.json({ ok: true, verified, ...result });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}
