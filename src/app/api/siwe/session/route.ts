import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (session.siwe) {
    return NextResponse.json({ authenticated: true, address: session.siwe.address, chainId: session.siwe.chainId });
  }
  return NextResponse.json({ authenticated: false });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
