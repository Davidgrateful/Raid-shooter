import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { getInbox, markInboxRead } from '@/lib/inbox';

// The player's own inbox: targeted messages (payout confirmations, cup
// thank-yous, direct notes). Identity resolves the same way scores do -
// a verified wallet by address, otherwise the durable guest token (falling
// back to the session cookie id), so a message reaches the same identity a
// player's runs are keyed under.
async function identityFor(req: NextRequest): Promise<string | null> {
  const session = await getSession();
  if (session.siwe) return session.siwe.address.toLowerCase();
  const body = await req.json().catch(() => null);
  const rawGuestToken = body?.guestToken;
  const clientGuest =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  return clientGuest || (await getOrCreateGuestId(session));
}

// GET reads the guest token from the query string (?guestToken=...) so it can
// stay a simple GET; wallet players are resolved from their session cookie.
export async function GET(req: NextRequest) {
  const session = await getSession();
  let key: string | null = null;
  if (session.siwe) {
    key = session.siwe.address.toLowerCase();
  } else {
    const raw = req.nextUrl.searchParams.get('guestToken') || '';
    key = /^[a-z0-9-]{8,40}$/i.test(raw)
      ? `guest:${raw.toLowerCase()}`
      : await getOrCreateGuestId(session);
  }
  if (!key) return NextResponse.json({ messages: [], unread: 0 });
  try {
    const inbox = await getInbox(key);
    return NextResponse.json(inbox);
  } catch {
    return NextResponse.json({ messages: [], unread: 0 });
  }
}

// POST { guestToken? } marks the inbox read (clears the unread badge).
export async function POST(req: NextRequest) {
  const key = await identityFor(req);
  if (!key) return NextResponse.json({ ok: false });
  try {
    await markInboxRead(key);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
