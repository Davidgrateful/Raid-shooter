import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { getHolderStatus, holderTiers } from '@/lib/holder';

export const dynamic = 'force-dynamic';

// The signed-in wallet's $RAIDSHOOTER holder tier, plus the tier ladder the
// deck explains. Guests get the ladder only - a balance is read solely for the
// wallet the session proves, never for an address a caller supplies.
export async function GET(req: NextRequest) {
  if (!(await rateLimit('holder', clientIp(req), 30, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const tiers = holderTiers();
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ signedIn: false, tiers });
  }
  const status = await getHolderStatus(session.siwe.address);
  return NextResponse.json({
    signedIn: true,
    tiers,
    // null = the chain could not be read and there was no earlier answer
    checked: !!status,
    balance: status?.balance ?? null,
    tier: status?.tier ?? null,
  });
}
