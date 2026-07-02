import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { getFlagged, clearFlag, removeEntry, banPlayer } from '@/lib/leaderboard';

// Admin: the suspicious-run review queue. Approve clears the flag (the run
// stays ranked); derank removes the score; ban removes it and blocks the
// player from posting again. Review this queue before settling a tournament.
export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const flagged = await getFlagged();
  return NextResponse.json({ flagged });
}

export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as
    | { id?: string; address?: string; action?: string }
    | null;
  if (!body?.id || !body?.action) {
    return NextResponse.json({ error: 'id and action required' }, { status: 400 });
  }
  const address = (body.address || body.id.split(':')[0] || '').toLowerCase();

  if (body.action === 'approve') {
    await clearFlag(body.id);
    return NextResponse.json({ ok: true, action: 'approve' });
  }
  if (body.action === 'derank') {
    await removeEntry(address);
    await clearFlag(body.id);
    return NextResponse.json({ ok: true, action: 'derank' });
  }
  if (body.action === 'ban') {
    await banPlayer(address);
    await clearFlag(body.id);
    return NextResponse.json({ ok: true, action: 'ban' });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
