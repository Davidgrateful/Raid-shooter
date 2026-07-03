import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { resetBoard } from '@/lib/leaderboard';

// Wipes the leaderboard. Destructive and irreversible, so it requires the
// admin token AND an explicit { confirm: "RESET" } in the body.
export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'rewards.manage');
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  if (!body || body.confirm !== 'RESET') {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirm": "RESET" }.' },
      { status: 400 }
    );
  }

  const removed = await resetBoard();
  await audit({ actor: auth.identity.actor, action: 'board.reset', detail: `${removed} entries wiped` });
  return NextResponse.json({ ok: true, removed });
}
