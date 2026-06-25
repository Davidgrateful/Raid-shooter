import { NextResponse } from 'next/server';

// Diagnostic for the onchain market config - never returns the full
// treasury address or secrets, just enough to tell what's misconfigured
// when the storefront is stuck on "PAYMENTS LIVE SOON".
export async function GET() {
  const raw = process.env.NEXT_PUBLIC_BASE_TREASURY || '';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const matchesFormat = /^0x[0-9a-f]{40}$/.test(lower);

  return NextResponse.json({
    treasurySet: raw.length > 0,
    treasuryLength: raw.length,
    treasuryHadWhitespace: raw !== trimmed,
    treasuryLooksValid: matchesFormat,
    treasuryPreview: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : null,
    network: process.env.NEXT_PUBLIC_BASE_NETWORK || '(unset, defaults to baseSepolia)',
    rpcUrlSet: !!process.env.BASE_RPC_URL,
    reownProjectIdSet: !!process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
    sessionSecretSet: !!process.env.SESSION_SECRET,
  });
}
