import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { grantItem } from '@/lib/profile';
import { getItem } from '@/lib/market';

// Manually grant a catalog item to a wallet - used to comp a player who
// paid but didn't receive their item, or to reward a verified account.
// Body: { address: "0x...", itemId: "drone_voltmite" }.
export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'players.moderate');
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const address = (body?.address as string | undefined)?.trim().toLowerCase();
  const itemId = (body?.itemId as string | undefined)?.trim();

  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Valid wallet address required.' }, { status: 400 });
  }
  const item = itemId ? getItem(itemId) : undefined;
  if (!item) {
    return NextResponse.json({ error: `Unknown itemId: ${itemId || '(none)'}` }, { status: 400 });
  }

  const profile = await grantItem(address, item);
  await audit({ actor: auth.identity.actor, action: 'player.grant', target: address, detail: item.id });
  return NextResponse.json({
    ok: true,
    granted: item.id,
    address,
    profile: { items: profile.items, consumables: profile.consumables },
  });
}
