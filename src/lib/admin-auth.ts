import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

// Shared gate for every /api/admin/* route. Returns null when the caller is
// authorized, or a ready-to-return error response otherwise - so a missing
// token can never accidentally expose an admin action.
export function adminGate(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_STATS_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_STATS_TOKEN is not set. Set it in your env to enable admin endpoints.' },
      { status: 503 }
    );
  }
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = bearer || req.nextUrl.searchParams.get('key') || '';
  let ok = false;
  if (provided.length === expected.length) {
    ok = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
