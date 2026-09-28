import { randomBytes } from 'crypto';
import { isKvConfigured, redisCommand } from '@/lib/kv';

/*==============================================================================
RUN LEDGER

The score a client submits is, and will stay, a number the client computed -
the game runs in the browser. What the server CAN own is the evidence around
it, and until now it owned none: a score arrived with no record that a run had
ever started, and every reward that asked "did this player actually play?"
(the daily streak, a referral credit) answered from nothing at all, or from a
number in the same request.

This file gives the server two facts of its own:

  RUN TICKETS    Issued when a run starts, redeemed exactly once when its
                 score is submitted. A ticket carries the server's own clock,
                 so a submission claiming a 600-second run on a ticket issued
                 40 seconds ago is an impossibility, not a judgement call.
                 Game time is built from clamped Date.now() deltas
                 (game.js updateDelta), so an honest run's claimed time can
                 never exceed the wall-clock time since its ticket - pauses
                 only widen the gap in the honest direction.

  ACCEPTED RUNS  Written only when a TICKETED run is accepted. The streak and
                 referral routes read this instead of trusting the request.

What this does NOT do: prove a score was earned. A patient forger can start a
run, wait, and submit an invented number that fits the elapsed time. That is
why the payout review queue still matters, and why an unticketed run is
flagged rather than silently trusted.
==============================================================================*/

/** A run may not outlast this. Matches the leaderboard's 86,400s time bound. */
const TICKET_TTL_S = 24 * 60 * 60;
/** Slack for request latency and the client clock rounding its seconds down. */
const TIME_GRACE_S = 20;
/** How long "played recently" evidence is kept. */
const LAST_RUN_TTL_S = 48 * 60 * 60;

const ticketKey = (id: string) => `runticket:${id}`;
const lastRunKey = (identity: string) => `run:last:${identity}`;
const BEST_KEY = 'run:best';

const TICKET_ID = /^[a-f0-9]{32}$/;

interface Ticket { identity: string; issuedAt: number }

// in-memory fallback, same shape as every other store in this app
const memTickets = new Map<string, { t: Ticket; exp: number }>();
const memLast = new Map<string, number>();
const memBest = new Map<string, number>();

/** Operator switch: once every live client sends tickets, refuse runs without one. */
export function runTicketRequired(): boolean {
  return process.env.REQUIRE_RUN_TICKET === '1';
}

export async function issueRunTicket(identity: string, now = Date.now()): Promise<{ id: string; issuedAt: number }> {
  const id = randomBytes(16).toString('hex');
  const t: Ticket = { identity, issuedAt: now };
  if (isKvConfigured()) {
    await redisCommand(['SET', ticketKey(id), JSON.stringify(t), 'EX', TICKET_TTL_S]);
  } else {
    memTickets.set(id, { t, exp: now + TICKET_TTL_S * 1000 });
  }
  return { id, issuedAt: now };
}

/**
 * Spend a ticket. Single use by construction (GETDEL / delete-on-read), so a
 * second submission cannot ride the same ticket. Returns null for an unknown,
 * expired, already-spent, or someone-else's ticket - and a ticket presented by
 * the wrong identity is still consumed, so it cannot be tried again elsewhere.
 */
export async function redeemRunTicket(id: unknown, identity: string, now = Date.now()): Promise<Ticket | null> {
  if (typeof id !== 'string' || !TICKET_ID.test(id)) return null;
  let t: Ticket | null = null;
  if (isKvConfigured()) {
    const raw = (await redisCommand(['GETDEL', ticketKey(id)])) as string | null;
    if (raw) { try { t = JSON.parse(raw) as Ticket; } catch { t = null; } }
  } else {
    const hit = memTickets.get(id);
    memTickets.delete(id);
    if (hit && hit.exp > now) t = hit.t;
  }
  if (!t || t.identity !== identity) return null;
  return t;
}

/** Could a run of `claimedSeconds` have been played since this ticket was issued? */
export function runFitsTicket(claimedSeconds: number, ticket: Ticket, now = Date.now()): boolean {
  const realSeconds = (now - ticket.issuedAt) / 1000;
  return claimedSeconds <= realSeconds + TIME_GRACE_S;
}

/** Record a ticketed, accepted run. The only writer of the "played" evidence. */
export async function recordAcceptedRun(identity: string, score: number, now = Date.now()): Promise<void> {
  if (isKvConfigured()) {
    await redisCommand(['SET', lastRunKey(identity), now, 'EX', LAST_RUN_TTL_S]);
    await redisCommand(['ZADD', BEST_KEY, 'GT', score, identity]);
    return;
  }
  memLast.set(identity, now);
  memBest.set(identity, Math.max(memBest.get(identity) || 0, score));
}

/** Has this identity had a ticketed run accepted since `sinceMs`? */
export async function hasAcceptedRunSince(identity: string, sinceMs: number): Promise<boolean> {
  let at = 0;
  if (isKvConfigured()) {
    at = Number((await redisCommand(['GET', lastRunKey(identity)])) || 0);
  } else {
    at = memLast.get(identity) || 0;
  }
  return at >= sinceMs;
}

/** Best ticketed, accepted score this identity has ever posted (0 if none). */
export async function bestAcceptedScore(identity: string): Promise<number> {
  if (isKvConfigured()) {
    return Number((await redisCommand(['ZSCORE', BEST_KEY, identity])) || 0);
  }
  return memBest.get(identity) || 0;
}
