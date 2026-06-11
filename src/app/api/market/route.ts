import { NextResponse } from 'next/server';
import { CATALOG, marketEnabled, treasury, baseNetwork } from '@/lib/market';

export async function GET() {
  return NextResponse.json({
    enabled: marketEnabled,
    treasury: marketEnabled ? treasury : null,
    network: baseNetwork,
    items: CATALOG,
  });
}
