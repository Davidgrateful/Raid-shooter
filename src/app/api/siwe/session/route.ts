import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (session.siwe) {
    return NextResponse.json({ authenticated: true, address: session.siwe.address, chainId: session.siwe.chainId, guestId: session.guestId || null });
  }
  // Guests carry an anonymous identity (once they've posted a score) so the
  // board can highlight their own row.
  return NextResponse.json({ authenticated: false, guestId: session.guestId || null });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
