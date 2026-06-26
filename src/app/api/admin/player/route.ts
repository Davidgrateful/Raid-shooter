import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { getEntry, isPersistent } from '@/lib/leaderboard';
import { getProfile } from '@/lib/profile';

// Look up one player to diagnose purchase issues: what they own, their
// leaderboard entry, and whether persistence is even on (the #1 cause of
// "my purchase vanished"). Pass ?id=<wallet 0x... or guest:...>.
export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  const raw = (req.nextUrl.searchParams.get('id') || '').trim();
  if (!raw) {
    return NextResponse.json({ error: 'Pass ?id=<wallet address or guest:id>.' }, { status: 400 });
  }
  // wallet addresses are stored lowercased; guest ids are kept verbatim
  const id = raw.startsWith('0x') ? raw.toLowerCase() : raw;

  const [profile, entry] = await Promise.all([getProfile(id), getEntry(id)]);

  return NextResponse.json({
    id,
    persistent: isPersistent(),
    // if false, owned items live in ephemeral memory and disappear on
    // redeploy - this alone explains most "lost purchase" reports
    persistenceWarning: isPersistent()
      ? null
      : 'No persistent store: purchases are NOT durable and reset on redeploy. Fix KV first.',
    profile: {
      items: profile.items,
      itemCount: profile.items.length,
      consumables: profile.consumables,
    },
    leaderboardEntry: entry,
  });
}
