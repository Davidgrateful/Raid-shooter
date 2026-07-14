import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { getAllEntries, mergeGuestIntoWallet, getEntry } from '@/lib/leaderboard';
import { mergeGuestProfileIntoWallet, getProfile } from '@/lib/profile';

// "I connected my wallet and lost my progress" recovery tool. A player's
// guest identity is a durable token minted client-side (localStorage), so
// there's no way to look it up FROM a wallet address - the operator almost
// always only has the player's old call sign (their guest display name),
// not the guest token itself. This searches all-time entries for guest:
// rows matching a name, so the operator can eyeball score/date to pick the
// right one, then trigger the same merge that runs automatically on
// sign-in (see /api/siwe/verify) - for players who lost progress BEFORE
// that merge was fixed to use the right guest identity.
export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'players.moderate');
  if (!auth.ok) return auth.res;

  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ error: 'query_too_short' }, { status: 400 });
  }

  const all = await getAllEntries();
  const matches = all
    .filter((e) => e.address.startsWith('guest:') && (e.name || '').toLowerCase().includes(q))
    .slice(0, 20)
    .map((e) => ({
      guestKey: e.address,
      name: e.name,
      score: e.score,
      kills: e.kills,
      pilot: e.pilot,
      at: e.at,
    }));

  return NextResponse.json({ matches });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'players.moderate');
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const guestKey = body?.guestKey as string | undefined;
  const walletAddress = body?.walletAddress as string | undefined;
  if (!guestKey || !guestKey.startsWith('guest:') || !walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const walletKey = walletAddress.toLowerCase();

  await mergeGuestIntoWallet(guestKey, walletKey);
  await mergeGuestProfileIntoWallet(guestKey, walletKey);

  const [walletEntry, walletProfile] = await Promise.all([
    getEntry(walletKey),
    getProfile(walletKey),
  ]);

  return NextResponse.json({ ok: true, walletEntry, walletProfile });
}
