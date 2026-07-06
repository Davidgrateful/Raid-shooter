import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateName } from '@/lib/leaderboard';

// Renames an existing Shooterboard entry immediately, so a name change
// shows up without having to beat your personal best first. Works for both
// wallet players and guests (whoever owns the current session identity).
export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json().catch(() => null);

  // prefer the durable client guest token (matches how scores are keyed) so a
  // rename targets the same identity even if the session cookie was dropped
  const rawGuestToken = body?.guestToken;
  const clientGuestToken =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  const key = session.siwe ? session.siwe.address.toLowerCase() : (clientGuestToken || session.guestId);
  if (!key) {
    return NextResponse.json({ error: 'no_identity' }, { status: 401 });
  }

  const name = body && typeof body.name === 'string' ? body.name.toUpperCase().replace(/\s+/g, ' ').trim() : '';
  if (!/^[A-Z0-9 ]{3,12}$/.test(name)) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  try {
    const updated = await updateName(key, name);
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}
