import { NextResponse } from 'next/server';
import { getActiveSeason } from '@/lib/rewards';
import { getCupTop, getCupCount } from '@/lib/cup';
import { listSponsors } from '@/lib/sponsors';

// Public: the LIVE CUP board — the time-boxed esports ranking for the active
// sponsored cup. Only runs played while the cup is live appear here. Returns
// null season when no cup is running, so the game hides the CUP tab.
export async function GET() {
  const season = await getActiveSeason();
  if (!season || season.status !== 'active') {
    return NextResponse.json({ season: null, entries: [], total: 0 });
  }

  const [entries, total] = await Promise.all([
    getCupTop(season.id, 250).catch(() => []),
    getCupCount(season.id).catch(() => 0),
  ]);

  let sponsorName: string | undefined;
  if (season.sponsorId) {
    const sponsors = await listSponsors();
    sponsorName = sponsors.find((s) => s.id === season.sponsorId)?.name;
  }

  return NextResponse.json({
    season: {
      id: season.id,
      name: season.name,
      endsAt: season.endsAt || null,
      sponsorName: sponsorName || null,
    },
    entries,
    total,
  });
}
