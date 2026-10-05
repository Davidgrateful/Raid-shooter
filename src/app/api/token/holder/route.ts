import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { getAccountHolderStatus, getHolderStatus, holderTiers } from '@/lib/holder';
import { accountAddresses } from '@/lib/accounts';

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
  // ?fresh=1 re-reads the chain (the Armory asks after a token payment, so
  // the balance it shows is not the pre-payment one); still rate limited above
  const fresh = req.nextUrl.searchParams.get('fresh') === '1';
  // the BALANCE is the signed-in wallet's own - it is what pays in the Armory;
  // the TIER is the account's best wallet, linked sign-ins included
  const signer = session.siwe.signer || session.siwe.address;
  const [status, best] = await Promise.all([
    getHolderStatus(signer, fresh),
    accountAddresses(session.siwe.address).then((all) => getAccountHolderStatus(all, fresh)),
  ]);
  return NextResponse.json({
    signedIn: true,
    tiers,
    // null = the chain could not be read and there was no earlier answer
    checked: !!status,
    balance: status?.balance ?? null,
    tier: best?.tier ?? status?.tier ?? null,
  });
}
