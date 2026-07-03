import { NextRequest, NextResponse } from 'next/server';

// Diagnostic for wallet connect ("Invalid App Configuration" / modal opens but
// never connects). Returns booleans + a short preview only - never a secret.
// The Reown project ID is a NEXT_PUBLIC value (already shipped to the browser),
// so a short preview here reveals nothing that isn't public.
//
// Two things must line up for AppKit to work:
//   1. NEXT_PUBLIC_REOWN_PROJECT_ID is set AND baked into the build (it's
//      inlined at build time, so setting it in Vercel then NOT redeploying
//      leaves the old build with no id -> "Invalid App Configuration").
//   2. The origin the app is served from is on the project's allowed-domains
//      list in the Reown dashboard. `origin` below is what THIS request came
//      from - it must match a verified domain exactly (scheme + host).
export async function GET(req: NextRequest) {
  const id = (process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '').trim();
  const host = req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : '';

  return NextResponse.json({
    reownProjectIdSet: id.length > 0,
    reownProjectIdLength: id.length,
    // a valid Reown project id is a 32-char hex string; flag obvious problems
    reownProjectIdLooksValid: /^[0-9a-f]{32}$/i.test(id),
    reownProjectIdPreview: id ? `${id.slice(0, 6)}…${id.slice(-4)}` : null,
    // the origin this request arrived on — must be an allowed domain in Reown
    origin,
    host,
    // reminders in priority order
    hint: id.length === 0
      ? 'Set NEXT_PUBLIC_REOWN_PROJECT_ID in Vercel and REDEPLOY (it bakes in at build time).'
      : `Add "${origin}" to the project's allowed domains at cloud.reown.com, then hard-refresh.`,
  });
}
