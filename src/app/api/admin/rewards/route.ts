import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import {
  listSeasons,
  upsertSeason,
  deleteSeason,
  listPayouts,
  type Season,
} from '@/lib/rewards';
import { canAutoSend, tokenConfig } from '@/lib/payout';

// Admin: tournament seasons + payout history. The operator builds prize
// tables (rank -> cosmetic and/or USDC) and runs reward rounds entirely from
// the dashboard.
export async function GET(req: NextRequest) {
  const denied = await adminGate(req, 'rewards.view');
  if (denied) return denied;
  const [seasons, payouts] = await Promise.all([listSeasons(), listPayouts()]);
  const token = tokenConfig();
  return NextResponse.json({
    seasons,
    payouts,
    payout: {
      token: { symbol: token.symbol, address: token.address, network: token.network, decimals: token.decimals },
      autoSend: canAutoSend(),
    },
  });
}

export async function POST(req: NextRequest) {
  const denied = await adminGate(req, 'rewards.manage');
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Partial<Season> | null;
  if (!body || !body.name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const season = await upsertSeason(body);
  return NextResponse.json({ ok: true, season });
}

export async function DELETE(req: NextRequest) {
  const denied = await adminGate(req, 'rewards.manage');
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get('id') || '';
  const removed = await deleteSeason(id);
  return NextResponse.json({ ok: removed });
}
