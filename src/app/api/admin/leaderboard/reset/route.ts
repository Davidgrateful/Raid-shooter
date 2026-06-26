import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { resetBoard } from '@/lib/leaderboard';

// Wipes the leaderboard. Destructive and irreversible, so it requires the
// admin token AND an explicit { confirm: "RESET" } in the body.
export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || body.confirm !== 'RESET') {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirm": "RESET" }.' },
      { status: 400 }
    );
  }

  const removed = await resetBoard();
  return NextResponse.json({ ok: true, removed });
}
