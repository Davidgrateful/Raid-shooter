import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { spendConsumable } from '@/lib/profile';

// Spends one charge of an owned consumable. The effect itself happens
// client side (heal/shield/revive) - this just decrements the stockpile
// so it can't be reused after a refresh or on another device.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ error: 'wallet_required' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const itemId = body?.itemId as string | undefined;
  if (!itemId || !/^consumable_[a-z]+$/.test(itemId)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const address = session.siwe.address.toLowerCase();
    const spent = await spendConsumable(address, itemId);
    if (!spent) {
      return NextResponse.json({ error: 'none_left' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 503 });
  }
}
