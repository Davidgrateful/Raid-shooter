import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile } from '@/lib/profile';

export async function GET() {
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ authenticated: false, items: [], consumables: {} });
  }
  try {
    const profile = await getProfile(session.siwe.address.toLowerCase());
    return NextResponse.json({ authenticated: true, ...profile });
  } catch {
    return NextResponse.json({ error: 'profile_unavailable' }, { status: 503 });
  }
}
