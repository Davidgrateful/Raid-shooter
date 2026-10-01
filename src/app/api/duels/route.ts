import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { getHolderStatus, holderTiers } from '@/lib/holder';
import { verifyTurnstile } from '@/lib/turnstile';
import { createDuel, getDuelConfig, myDuels, viewOf, type DuelAccess } from '@/lib/duels';
import { duelCaller, guestFromQuery, nameFor, type DuelCaller } from '@/lib/duelapi';

export const dynamic = 'force-dynamic';

/*
 * DUELS - the deck's view (who may create one, your recent duels) and create.
 * See src/lib/duels.ts for the rules.
 */

type Gate = { ok: true } | { ok: false; reason: 'off' | 'sign_in' | 'not_a_holder' | 'chain_unavailable' };

async function canCreate(access: DuelAccess, caller: DuelCaller, fresh = false): Promise<Gate> {
  if (access === 'off') return { ok: false, reason: 'off' };
  if (access === 'all') return caller.key ? { ok: true } : { ok: false, reason: 'sign_in' };
  // holders first: a signed-in wallet the server has read a tier for on-chain
  if (!caller.address) return { ok: false, reason: 'sign_in' };
  const status = await getHolderStatus(caller.address, fresh);
  if (!status) return { ok: false, reason: 'chain_unavailable' };
  return status.tier ? { ok: true } : { ok: false, reason: 'not_a_holder' };
}

export async function GET(req: NextRequest) {
  if (!(await rateLimit('duels_read', clientIp(req), 60, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const caller = await duelCaller(guestFromQuery(req));
  const { access } = await getDuelConfig();
  const gate = await canCreate(access, caller);
  const mine = caller.key ? (await myDuels(caller.key, 5)).map((d) => viewOf(d, caller.key)) : [];
  return NextResponse.json({
    access,
    signedIn: caller.verified,
    canCreate: gate.ok,
    reason: gate.ok ? null : gate.reason,
    minHold: holderTiers()[0].min,
    mine,
  });
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit('duels_create', clientIp(req), 12, 3600_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const caller = await duelCaller(body.guestToken);
  const { access } = await getDuelConfig();
  const gate = await canCreate(access, caller, true);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: gate.reason === 'chain_unavailable' ? 503 : gate.reason === 'sign_in' ? 401 : 403 });
  }
  const name = nameFor(caller, body);
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (!caller.verified) {
    const ok = await verifyTurnstile(body.turnstileToken as string | undefined, clientIp(req));
    if (!ok) return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
  }
  const duel = await createDuel({ key: caller.key!, name, verified: caller.verified });
  return NextResponse.json({ ok: true, duel: viewOf(duel, caller.key) });
}
