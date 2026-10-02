import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { redeemRunTicket, runFitsTicket, runTicketRequired } from '@/lib/runs';
import { sendToInbox } from '@/lib/inbox';
import { recordPlay } from '@/lib/streak';
import { getDuel, isDuelId, submitDuelRun, viewOf } from '@/lib/duels';
import { duelCaller, guestFromQuery, nameFor } from '@/lib/duelapi';
import { cleanGhost, saveGhost } from '@/lib/duelGhost';

export const dynamic = 'force-dynamic';

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

// One duel, as this viewer may see it (the seed only if they may still fly it).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await rateLimit('duel_read', clientIp(req), 60, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const code = (id || '').toUpperCase();
  if (!isDuelId(code)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const duel = await getDuel(code);
  if (!duel) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const caller = await duelCaller(guestFromQuery(req));
  return NextResponse.json({ duel: viewOf(duel, caller.key) });
}

// Submit this caller's run of the duel - once, with a run ticket like any run.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await rateLimit('duel_submit', clientIp(req), 10, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const code = (id || '').toUpperCase();
  if (!isDuelId(code)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const caller = await duelCaller(body.guestToken);
  if (!caller.key) return NextResponse.json({ error: 'identity_required' }, { status: 401 });
  const { score, pilot, level, kills, time } = body;
  if (!isInt(score, 0, 100_000_000) || typeof pilot !== 'string' || !/^[A-Z0-9 ]{1,16}$/.test(pilot)
    || !isInt(level, 1, 10_000) || !isInt(kills, 0, 10_000_000) || !isInt(time, 0, 86_400)) {
    return NextResponse.json({ error: 'invalid_run' }, { status: 400 });
  }
  const name = nameFor(caller, body);
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (!caller.verified) {
    const ok = await verifyTurnstile(body.turnstileToken as string | undefined, clientIp(req));
    if (!ok) return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
  }

  // a duel run is a real run: same ticket rule as the boards (lib/runs.ts)
  const ticket = await redeemRunTicket(body.runTicket, caller.key);
  if (ticket && !runFitsTicket(time, ticket)) {
    return NextResponse.json({ error: 'run_time_mismatch' }, { status: 400 });
  }
  if (!ticket && runTicketRequired()) {
    return NextResponse.json({ error: 'run_ticket_required' }, { status: 403 });
  }

  const result = await submitDuelRun(code, {
    key: caller.key, name, verified: caller.verified,
    score, pilot, level, kills, time, at: Date.now(),
  });
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : result.error === 'busy' ? 503 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  // the run's path, for the other pilot to race (lib/duelGhost.ts). Drawing
  // only: a ghost that fails to clean or save never touches the result.
  const ghost = cleanGhost(body.ghost);
  if (ghost) {
    const n = result.duel.entries.findIndex((e) => e.key === caller.key);
    if (n >= 0) await saveGhost(result.duel, n, ghost).catch(() => {});
  }

  // a ticketed duel run is a real play for the daily streak, like any run
  // (it never feeds the boards' score records - duels are bragging rights)
  if (ticket) recordPlay(caller.key).catch(() => {});

  // settled: tell the other pilot how it went, wherever they are
  if (result.settled) {
    const other = result.duel.entries.find((e) => e.key !== caller.key);
    if (other) {
      const diff = other.score - score;
      const verdict = diff > 0 ? `You won by ${diff.toLocaleString()}.` : diff < 0 ? `They won by ${(-diff).toLocaleString()}.` : 'A dead heat.';
      sendToInbox(other.key, {
        kind: 'system',
        title: `Duel ${code}: ${name} flew your raid`,
        body: `${other.score.toLocaleString()} vs ${score.toLocaleString()}. ${verdict}`,
        meta: { url: `/duel/${code}` },
      }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true, settled: result.settled, duel: viewOf(result.duel, caller.key) });
}
