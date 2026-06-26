import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { removeEntry, banPlayer, unbanPlayer } from '@/lib/leaderboard';

// Moderate the leaderboard. Body: { id, action }.
//   action "derank" -> remove their score (they can re-earn a rank)
//   action "ban"    -> remove AND block future submissions (cheating)
//   action "unban"  -> lift a ban
// `id` may be a "wallet:0x…" / "guest:…" stats id or a bare board key.
export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const rawId = (body?.id as string | undefined)?.trim();
  const action = (body?.action as string | undefined) || 'derank';
  if (!rawId) {
    return NextResponse.json({ error: 'Player id required.' }, { status: 400 });
  }

  // normalize a stats id to the leaderboard key
  const key = rawId.startsWith('wallet:') ? rawId.slice('wallet:'.length).toLowerCase() : rawId;

  if (action === 'ban') {
    await banPlayer(key);
    return NextResponse.json({ ok: true, action, id: key });
  }
  if (action === 'unban') {
    await unbanPlayer(key);
    return NextResponse.json({ ok: true, action, id: key });
  }
  if (action === 'derank') {
    const removed = await removeEntry(key);
    return NextResponse.json({ ok: true, action, id: key, removed });
  }
  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
