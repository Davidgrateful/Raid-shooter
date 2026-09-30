import { NextResponse } from 'next/server';
import { getActiveSeason } from '@/lib/rewards';
import { listSponsors } from '@/lib/sponsors';
import { settleExpiredSeasons } from '@/lib/cup-lifecycle';

// Public: the currently active tournament season, summarized for the game
// client (menu/leaderboard banner). Presentational fields only - the full
// prize table and payout state stay behind the admin gate.
export async function GET() {
  // Lazy cup settlement, no cron needed: a cup whose endsAt has passed gets
  // flipped to 'ended' + a thanks broadcast here. Awaited so the response
  // this call returns already reflects the closed state; it's idempotent and
  // cheap (a no-op once every cup is settled).
  await settleExpiredSeasons().catch(() => {});
  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ season: null });
  }

  // headline prize = what rank #1 takes home; pool = every tier summed
  let prize1Usd = 0;
  let poolUsd = 0;
  // $RAIDSHOOTER prizes are counted in tokens, never converted to dollars
  let prize1Tokens = 0;
  let poolTokens = 0;
  for (const tier of season.prizes) {
    const perWallet = tier.usd || 0;
    const wallets = Math.max(0, tier.toRank - tier.fromRank + 1);
    poolUsd += perWallet * wallets;
    poolTokens += (tier.tokens || 0) * wallets;
    if (tier.fromRank <= 1 && tier.toRank >= 1) {
      prize1Usd = perWallet;
      prize1Tokens = tier.tokens || 0;
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
      prize1Tokens,
      poolTokens,
      endsAt: season.endsAt || null,
      sponsorName: sponsorName || null,
      requiredPilotId: season.requiredPilotId || null,
      prizes: season.prizes.map((t) => ({
        fromRank: t.fromRank,
        toRank: t.toRank,
        itemId: t.itemId || null,
        usd: t.usd || 0,
        tokens: t.tokens || 0,
      })),
    },
  });
}
