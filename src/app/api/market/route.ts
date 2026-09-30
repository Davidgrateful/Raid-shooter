import { NextResponse } from 'next/server';
import { PUBLIC_CATALOG, marketEnabled, treasury, baseNetwork, liveTokenPay } from '@/lib/market';
import { OFFICIAL_TOKEN_ADDRESS } from '@/lib/token';
import { quote } from '@/lib/tokenpay';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tokenPay = await liveTokenPay();
  return NextResponse.json({
    enabled: marketEnabled,
    treasury: marketEnabled ? treasury : null,
    network: baseNetwork,
    // $RAIDSHOOTER checkout: priceToken (whole tokens) is set on each item
    // only when it is switched on, so an old client simply never sees it
    token: tokenPay
      ? { enabled: true, address: OFFICIAL_TOKEN_ADDRESS, discountPct: tokenPay.discountPct }
      : { enabled: false },
    items: tokenPay
      ? PUBLIC_CATALOG.map((i) => ({ ...i, priceToken: quote(i.priceUsd, tokenPay) ?? undefined }))
      : PUBLIC_CATALOG,
  });
}
