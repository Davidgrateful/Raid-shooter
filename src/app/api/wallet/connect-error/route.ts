import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { logWalletError, getWalletErrors } from '@/lib/walletErrors';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Public write: the client reports a wallet connect failure it observed from
// AppKit's own event stream (CONNECT_ERROR / USER_REJECTED / DISCONNECT_ERROR).
// No address or personal data - only what's needed to spot a pattern (wallet
// brand, error message, browser). Rate-limited per IP so this can't be spammed.
export async function POST(req: NextRequest) {
  if (!(await rateLimit('wallet-error', clientIp(req), 20, 60_000))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  if (kind !== 'CONNECT_ERROR' && kind !== 'USER_REJECTED' && kind !== 'DISCONNECT_ERROR') {
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
