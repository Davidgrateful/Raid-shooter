import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateName } from '@/lib/leaderboard';

// Renames an existing Shooterboard entry immediately, so a name change
// shows up without having to beat your personal best first.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ error: 'wallet_required' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = body && typeof body.name === 'string' ? body.name.toUpperCase().replace(/\s+/g, ' ').trim() : '';
  if (!/^[A-Z0-9 ]{3,12}$/.test(name)) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  try {
    const updated = await updateName(session.siwe.address.toLowerCase(), name);
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}
