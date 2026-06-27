import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import {
  getSeason,
  computeWinners,
  grantCosmeticPrizes,
  createPayoutBatch,
} from '@/lib/rewards';
import { tokenConfig } from '@/lib/payout';

// Admin: compute the current winners for a season and, optionally, act on
// them. Body: { seasonId, grant?: boolean, createPayout?: boolean }.
//   - always returns the computed winners (preview)
//   - grant:true        -> grants the cosmetic prizes to the top wallets
//   - createPayout:true  -> creates a pending USDC payout batch for the round
export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | { seasonId?: string; grant?: boolean; createPayout?: boolean }
    | null;
  const season = body?.seasonId ? await getSeason(body.seasonId) : null;
  if (!season) {
    return NextResponse.json({ error: 'Unknown seasonId' }, { status: 400 });
  }

  let winners = await computeWinners(season);

  if (body?.grant) {
    winners = await grantCosmeticPrizes(winners);
  }

  let payout = null;
  if (body?.createPayout) {
    const token = tokenConfig();
    payout = await createPayoutBatch(season, winners, token.symbol, token.network);
  }

  return NextResponse.json({
    ok: true,
    season: { id: season.id, name: season.name },
    winners,
    granted: !!body?.grant,
    payout,
  });
}
