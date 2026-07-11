import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { logWalletError, getWalletErrors } from '@/lib/walletErrors';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Public write: the client reports a wallet connect failure it observed -
// either from AppKit's own event stream (CONNECT_ERROR / USER_REJECTED /
// DISCONNECT_ERROR) or a client-side watchdog (RECONNECT_TIMEOUT: wagmi's
// silent auto-reconnect on page load never resolved, almost always a
// returning player's WalletConnect pairing that's expired/dead - the exact
// "old players finding it hard to connect" shape, since only someone with a
// previously-persisted session hits this path at all). No address or
// personal data - only what's needed to spot a pattern. Rate-limited per IP.
export async function POST(req: NextRequest) {
  if (!(await rateLimit('wallet-error', clientIp(req), 20, 60_000))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const validKinds = ['CONNECT_ERROR', 'USER_REJECTED', 'DISCONNECT_ERROR', 'RECONNECT_TIMEOUT'];
  if (!validKinds.includes(kind)) {
    return NextResponse.json({ ok: false, error: 'invalid kind' }, { status: 400 });
  }
  await logWalletError({
    kind,
    walletName: typeof body.walletName === 'string' ? body.walletName.slice(0, 60) : undefined,
    message: typeof body.message === 'string' ? body.message.slice(0, 300) : undefined,
    userAgent: (req.headers.get('user-agent') || '').slice(0, 200),
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// Admin read: the recent-failures list for /admin.
export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'stats.view');
  if (!auth.ok) return auth.res;
  return NextResponse.json({ errors: await getWalletErrors() });
}
