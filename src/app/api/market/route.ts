import { NextResponse } from 'next/server';
import { PUBLIC_CATALOG, marketEnabled, treasury, baseNetwork, tokenPayEnabled } from '@/lib/market';
import { OFFICIAL_TOKEN_ADDRESS } from '@/lib/token';
import { tokenPrice } from '@/lib/tokenpay';

export async function GET() {
  return NextResponse.json({
    enabled: marketEnabled,
    treasury: marketEnabled ? treasury : null,
    network: baseNetwork,
    // $RAIDSHOOTER checkout: priceToken (whole tokens) is set on each item
    // only when it is switched on, so an old client simply never sees it
    token: tokenPayEnabled ? { enabled: true, address: OFFICIAL_TOKEN_ADDRESS } : { enabled: false },
    items: tokenPayEnabled
      ? PUBLIC_CATALOG.map((i) => ({ ...i, priceToken: tokenPrice(i.priceUsd) ?? undefined }))
      : PUBLIC_CATALOG,
  });
}
