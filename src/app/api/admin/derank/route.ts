import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { unbanPlayer, submitEntry } from '@/lib/leaderboard';
import { purgeScoresEverywhere, banEverywhere, restoreScore, listRemoved } from '@/lib/moderation';
import { audit } from '@/lib/audit';

// GET: the "recently removed" list, so an accidental derank/ban can be undone.
export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'players.moderate');
  if (!auth.ok) return auth.res;
  return NextResponse.json({ removed: await listRemoved() });
}

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
  if (action === 'restore') {
    // undo an accidental derank/ban: put the snapshotted score back + unban
    const r = await restoreScore(key);
    await audit({ actor: auth.identity.actor, action: 'player.restore', target: key });
    return NextResponse.json({ ok: true, action, id: key, ...r });
  }
  if (action === 'readd') {
    // manual recovery when there's no snapshot (e.g. an old derank): put a
    // score back by value. Only fields we have are optional; the rest default.
    const score = Math.floor(Number(body?.score));
    if (!Number.isFinite(score) || score <= 0 || score > 100_000_000) {
      return NextResponse.json({ error: 'A positive score is required.' }, { status: 400 });
    }
    await unbanPlayer(key); // in case they were banned, so the re-add can land
    const nameRaw = typeof body?.name === 'string' ? body.name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 12) : '';
    const entry = {
      address: key,
      name: nameRaw || undefined,
      score,
      level: Math.max(1, Math.floor(Number(body?.level) || 1)),
      kills: Math.max(0, Math.floor(Number(body?.kills) || 0)),
      combo: 0,
      pilot: '',
      time: 0,
      at: Date.now(),
      verified: key.startsWith('0x'),
    };
    const res = await submitEntry(entry);
    await audit({ actor: auth.identity.actor, action: 'player.readd', target: key, detail: String(score) });
    return NextResponse.json({ ok: true, action, id: key, score, rank: res.rank, applied: res.improved });
  }
  if (action === 'derank') {
    // strip the score from all-time AND the sponsored cup + weekly boards
    const purged = await purgeScoresEverywhere(key);
    await audit({ actor: auth.identity.actor, action: 'player.derank', target: key });
    return NextResponse.json({ ok: true, action, id: key, removed: purged.allTime, purged });
  }
  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
