import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { getDuel, isDuelId, roleOf } from '@/lib/duels';
import { duelCaller, guestFromQuery } from '@/lib/duelapi';
import { rivalGhost } from '@/lib/duelGhost';

export const dynamic = 'force-dynamic';

// The other pilot's ghost, for a caller who may still fly this duel (to race
// it) or already has (to see the path they raced). Nobody else: without the
// seed a path is meaningless, and the seed is only theirs too.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await rateLimit('duel_ghost', clientIp(req), 30, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const code = (id || '').toUpperCase();
  if (!isDuelId(code)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const duel = await getDuel(code);
  if (!duel) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const caller = await duelCaller(guestFromQuery(req));
  if (!caller.key) return NextResponse.json({ ghost: null });
  const { canFly, flown } = roleOf(duel, caller.key);
  if (!canFly && !flown) return NextResponse.json({ ghost: null });
  return NextResponse.json({ ghost: await rivalGhost(duel, caller.key) });
}
