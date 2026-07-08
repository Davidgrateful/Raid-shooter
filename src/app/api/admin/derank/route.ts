import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { unbanPlayer } from '@/lib/leaderboard';
import { purgeScoresEverywhere, banEverywhere } from '@/lib/moderation';
import { audit } from '@/lib/audit';

// Moderate the leaderboard. Body: { id, action }.
//   action "derank" -> remove their score (they can re-earn a rank)
//   action "ban"    -> remove AND block future submissions (cheating)
//   action "unban"  -> lift a ban
// `id` may be a "wallet:0x…" / "guest:…" stats id or a bare board key.
export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'players.moderate');
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const rawId = (body?.id as string | undefined)?.trim();
  const action = (body?.action as string | undefined) || 'derank';
  if (!rawId) {
    return NextResponse.json({ error: 'Player id required.' }, { status: 400 });
  }

  // normalize a stats id to the leaderboard key
  const key = rawId.startsWith('wallet:') ? rawId.slice('wallet:'.length).toLowerCase() : rawId;

  if (action === 'ban') {
    // remove everywhere (all-time + every cup + weekly) AND block future posts
    const purged = await banEverywhere(key);
    await audit({ actor: auth.identity.actor, action: 'player.ban', target: key });
    return NextResponse.json({ ok: true, action, id: key, purged });
  }
  if (action === 'unban') {
    await unbanPlayer(key);
    await audit({ actor: auth.identity.actor, action: 'player.unban', target: key });
    return NextResponse.json({ ok: true, action, id: key });
  }
  if (action === 'derank') {
    // strip the score from all-time AND the sponsored cup + weekly boards
    const purged = await purgeScoresEverywhere(key);
    await audit({ actor: auth.identity.actor, action: 'player.derank', target: key });
    return NextResponse.json({ ok: true, action, id: key, removed: purged.allTime, purged });
  }
  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
