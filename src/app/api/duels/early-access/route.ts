import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { getAccountHolder, holderTiers } from '@/lib/holder';
import { isOnEarlyAccess, joinEarlyAccess } from '@/lib/earlyaccess';

export const dynamic = 'force-dynamic';

// Where this player stands for DUELS early access. Read-only.
export async function GET(req: NextRequest) {
  if (!(await rateLimit('early_read', clientIp(req), 30, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const minHold = holderTiers()[0].min;
  const session = await getSession();
  if (!session.siwe) return NextResponse.json({ signedIn: false, minHold });
  const address = session.siwe.address;
  const [status, onList] = await Promise.all([getAccountHolder(address), isOnEarlyAccess(address)]);
  return NextResponse.json({ signedIn: true, minHold, holder: status?.tier ?? null, onList });
}

// Join: only a signed-in wallet whose tier the server has just read on-chain.
export async function POST(req: NextRequest) {
  if (!(await rateLimit('early_join', clientIp(req), 10, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const session = await getSession();
  if (!session.siwe) return NextResponse.json({ error: 'wallet_required' }, { status: 401 });
  const status = await getAccountHolder(session.siwe.address, true);
  if (!status) return NextResponse.json({ error: 'chain_unavailable' }, { status: 503 });
  if (!status.tier) return NextResponse.json({ error: 'not_a_holder', minHold: holderTiers()[0].min }, { status: 403 });
  await joinEarlyAccess(session.siwe.address, status.tier);
  return NextResponse.json({ ok: true, onList: true, holder: status.tier });
}
