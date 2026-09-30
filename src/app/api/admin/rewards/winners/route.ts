import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import {
  getSeason,
  computeWinners,
  grantCosmeticPrizes,
  createPayoutBatch,
} from '@/lib/rewards';
import { raidshooterPayoutToken, tokenConfig } from '@/lib/payout';

// Admin: compute the current winners for a season and, optionally, act on
// them. Body: { seasonId, grant?: boolean, createPayout?: boolean }.
//   - always returns the computed winners (preview)
//   - grant:true        -> grants the cosmetic prizes to the top wallets
//   - createPayout:true  -> creates a pending USDC payout batch for the round
export async function POST(req: NextRequest) {
  const denied = await adminGate(req, 'rewards.manage');
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

  // USDC prizes and $RAIDSHOOTER prizes are paid in separate batches - they
  // are different tokens, signed separately. A batch with nobody to pay in
  // its currency is simply not created.
  const payouts = [];
  if (body?.createPayout) {
    const usdc = tokenConfig();
    const rs = raidshooterPayoutToken();
    const a = await createPayoutBatch(season, winners, usdc.symbol, usdc.network, 'usdc');
    const b = await createPayoutBatch(season, winners, rs.symbol, rs.network, 'raidshooter');
    if (a) payouts.push(a);
    if (b) payouts.push(b);
  }
  const payout = payouts[0] ?? null;

  return NextResponse.json({
    ok: true,
    season: { id: season.id, name: season.name },
    winners,
    granted: !!body?.grant,
    payout,
    payouts,
  });
}
