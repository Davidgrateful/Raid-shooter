import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { trackRunStart, trackRunEnd, trackInterest, isInterestFeature } from '@/lib/stats';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Fire-and-forget run telemetry from the game client. Identifies the player
// by wallet (if signed in) or their device-scoped guest id, so we count
// every player and every run - not just score submitters. No personal data
// is stored, only counters and an opaque id in anonymous sets.
export async function POST(req: NextRequest) {
  let body: { event?: string; durationSec?: number; pilot?: string; drone?: string; name?: string; feature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // cap telemetry writes so a script can't inflate stats or run up Redis
  // ops/cost - a normal run only fires ~2 events
  if (!(await rateLimit('track', clientIp(req), 40, 60_000))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const session = await getSession();
  const playerId = session.siwe?.address
    ? `wallet:${session.siwe.address.toLowerCase()}`
    : await getOrCreateGuestId(session);

  try {
    if (body.event === 'run_start') {
      await trackRunStart(playerId, { pilot: body.pilot, drone: body.drone, name: body.name });
    } else if (body.event === 'run_end') {
      await trackRunEnd(playerId, Number(body.durationSec) || 0);
    } else if (body.event === 'interest') {
      // "coming soon" demand gauge. Allowlisted feature names only, so a
      // forged payload cannot mint arbitrary keys in Redis.
      if (!isInterestFeature(body.feature)) {
        return NextResponse.json({ ok: false, error: 'unknown feature' }, { status: 400 });
      }
      await trackInterest(playerId, body.feature);
    } else {
      return NextResponse.json({ ok: false, error: 'unknown event' }, { status: 400 });
    }
  } catch {
    // never let telemetry failures surface to the player
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
