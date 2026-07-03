import { NextResponse } from 'next/server';
import { getActiveSeason } from '@/lib/rewards';
import { listSponsors } from '@/lib/sponsors';

// Public: the currently active tournament season, summarized for the game
// client (menu/leaderboard banner). Presentational fields only - the full
// prize table and payout state stay behind the admin gate.
export async function GET() {
  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ season: null });
  }

  // headline prize = what rank #1 takes home; pool = every tier summed
  let prize1Usd = 0;
  let poolUsd = 0;
  for (const tier of season.prizes) {
    const perWallet = tier.usd || 0;
    poolUsd += perWallet * Math.max(0, tier.toRank - tier.fromRank + 1);
    if (tier.fromRank <= 1 && tier.toRank >= 1) {
      prize1Usd = perWallet;
    }
  }

  let sponsorName: string | undefined;
  if (season.sponsorId) {
    const sponsors = await listSponsors();
    sponsorName = sponsors.find((s) => s.id === season.sponsorId)?.name;
  }

  return NextResponse.json({
    season: {
      id: season.id,
      live: season.status === 'active',
      name: season.name,
      prize1Usd,
      poolUsd,
      endsAt: season.endsAt || null,
      sponsorName: sponsorName || null,
      prizes: season.prizes.map((t) => ({
        fromRank: t.fromRank,
        toRank: t.toRank,
        itemId: t.itemId || null,
        usd: t.usd || 0,
      })),
    },
  });
}
