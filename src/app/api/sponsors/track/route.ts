import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/admetrics';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// Public: record a sponsor impression or click so the admin can report reach
// and CTR per partner. Body: { id: "<sponsorId>", type: "impression"|"click" }.
// Rate-limited per IP so the counters can't be trivially inflated.
export async function POST(req: NextRequest) {
  const allowed = await rateLimit('adtrack', clientIp(req), 120, 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { id?: string; type?: string } | null;
  const type = body?.type === 'click' ? 'click' : 'impression';
  if (!body?.id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await trackEvent(body.id, type);
  return NextResponse.json({ ok: true });
}
