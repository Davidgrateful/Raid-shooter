import { NextResponse } from 'next/server';
import { generateNonce } from 'siwe';
import { getSession } from '@/lib/session';

// Deliberately NOT rate limited. This route touches no Redis - it writes a
// nonce into the encrypted session cookie and returns. rateLimit() costs an
// INCR, so a limiter here would ADD a Redis operation to a route that
// currently performs none, spending exactly what it claims to defend.
export async function GET() {
  const session = await getSession();
  session.nonce = generateNonce();
  await session.save();
  return NextResponse.json({ nonce: session.nonce });
}
