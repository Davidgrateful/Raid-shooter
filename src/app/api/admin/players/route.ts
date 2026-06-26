import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { getPlayersList } from '@/lib/stats';
import { getBanned } from '@/lib/leaderboard';

// Team players table: every known player with games played, USD spent,
// wallet, last-seen, and whether they're banned. Admin-only.
export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  const limit = Math.min(1000, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '200', 10) || 200));
  const [players, banned] = await Promise.all([getPlayersList(limit), getBanned()]);
  const bannedSet = new Set(banned);

  // a stats id is "wallet:0x…" / "guest:…"; the board ban key is the bare
  // address ("0x…") or the guest handle - line them up
  const annotated = players.map((p) => {
    const boardKey = p.isWallet ? (p.wallet || '') : p.id;
    return { ...p, banned: bannedSet.has(boardKey) };
  });

  return NextResponse.json({ count: annotated.length, players: annotated });
}
