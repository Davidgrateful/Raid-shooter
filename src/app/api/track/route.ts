import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { trackRunStart, trackRunEnd } from '@/lib/stats';

// Fire-and-forget run telemetry from the game client. Identifies the player
// by wallet (if signed in) or their device-scoped guest id, so we count
// every player and every run - not just score submitters. No personal data
// is stored, only counters and an opaque id in anonymous sets.
export async function POST(req: NextRequest) {
  let body: { event?: string; durationSec?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await getSession();
  const playerId = session.siwe?.address
    ? `wallet:${session.siwe.address.toLowerCase()}`
    : await getOrCreateGuestId(session);

  try {
    if (body.event === 'run_start') {
      await trackRunStart(playerId);
    } else if (body.event === 'run_end') {
      await trackRunEnd(playerId, Number(body.durationSec) || 0);
    } else {
      return NextResponse.json({ ok: false, error: 'unknown event' }, { status: 400 });
    }
  } catch {
    // never let telemetry failures surface to the player
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
