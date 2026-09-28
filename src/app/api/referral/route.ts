import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateGuestId, getSession } from '@/lib/session';
import { grantItem } from '@/lib/profile';
import { getItem } from '@/lib/market';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import {
  ensureCode,
  bindReferrer,
  creditReferral,
  getInviteCount,
  getTopRecruiters,
  getReferrerCode,
  reserveDailyCredit,
  releaseDailyCredit,
} from '@/lib/referral';
import { bestAcceptedScore } from '@/lib/runs';

// The reward both sides earn once a referral is confirmed. A consumable boost
// (only meaningful for wallet players, who have a profile to hold it) — never
// a competitive edge, since a run that spends a boost is excluded from the
// ranked board. Guests still get recruiter-board credit and the social win.
const REFERRAL_REWARD = 'consumable_shield';
// A referred pilot only counts once they prove they actually played.
const QUALIFYING_SCORE = 5000;

// Resolve the caller's stable identity (wallet address or guest id).
/*
 * Identity is resolved the way /api/leaderboard and the run ledger resolve it:
 * wallet, else the client's durable guest token, else the session cookie.
 *
 * It used to be wallet-or-cookie only, which mattered once qualification moved
 * to the run ledger: the check has to read the SAME identity that gets
 * credited. If it could read one player's real run and credit another
 * identity, a single genuine run would qualify any number of throwaway ones.
 * `legacy` is the cookie identity, kept so a binding recorded under the old
 * scheme is migrated rather than stranded.
 */
async function identityOf(req: NextRequest, body?: Record<string, unknown> | null): Promise<{
  identity: string; verified: boolean; legacy: string | null;
}> {
  const session = await getSession();
  if (session.siwe) return { identity: session.siwe.address.toLowerCase(), verified: true, legacy: null };
  const raw = body?.guestToken ?? req.nextUrl.searchParams.get('guestToken');
  const token = typeof raw === 'string' && /^[a-z0-9-]{8,40}$/i.test(raw) ? `guest:${raw.toLowerCase()}` : null;
  const cookie = await getOrCreateGuestId(session);
  return { identity: token || cookie, verified: false, legacy: token ? cookie : null };
}

async function reward(identity: string) {
  if (!/^0x[0-9a-f]{40}$/i.test(identity)) return; // guests have no profile
  const item = getItem(REFERRAL_REWARD);
  if (item) await grantItem(identity, item).catch(() => {});
}

// GET: this player's own referral code + invite count, plus the top recruiters
// board for the in-game "INVITE" screen.
export async function GET(req: NextRequest) {
  const { identity } = await identityOf(req);
  const callSign = ''; // client passes its call sign on POST; GET mints from identity
  const code = await ensureCode(identity, callSign);
  const [invites, top] = await Promise.all([
    getInviteCount(code),
    getTopRecruiters(25),
  ]);
  return NextResponse.json({ code, invites, top });
}

// POST: two actions.
//   { action: 'track', ref, callSign? } — a freshly-arrived pilot records who
//        invited them (bound once, first writer wins). callSign lets us mint a
//        nice code for THIS player at the same time.
//   { action: 'claim', score } — after a qualifying run, credit the referrer
//        and reward both sides. Idempotent per referred identity.
export async function POST(req: NextRequest) {
  const allowed = await rateLimit('referral', clientIp(req), 20, 60_000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = (await req.json().catch(() => null)) as
    | { action?: string; ref?: string; callSign?: string; score?: number; guestToken?: string }
    | null;
  if (!body?.action) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { identity, legacy } = await identityOf(req, body as Record<string, unknown> | null);
  // mint/keep this player's own code (so they can invite others immediately)
  const myCode = await ensureCode(identity, body.callSign);

  if (body.action === 'track') {
    // No referrer is the normal case, not an error. The client posts this on
    // every boot to mint the player's own call-sign code, and answering 400
    // meant every player without an invite link logged a failed request on
    // every load - and never received the code this very call had minted.
    if (!body.ref) return NextResponse.json({ ok: true, bound: false, code: myCode });
    const bound = await bindReferrer(identity, body.ref);
    return NextResponse.json({ ok: true, bound, code: myCode });
  }

  if (body.action === 'claim') {
    /*
     * Qualification comes from the run ledger, not the request. This used to
     * read `score` from the body, so a claim needed no run at all - a fresh
     * identity could post a number and credit its recruiter. The ledger only
     * holds scores from runs the server issued a ticket for and accepted.
     * `body.score` is still sent by older clients and is deliberately ignored.
     */
    const best = await bestAcceptedScore(identity);
    if (best < QUALIFYING_SCORE) {
      return NextResponse.json({ ok: true, credited: false, reason: 'below_threshold', code: myCode });
    }

    let referrerCode = await getReferrerCode(identity);
    if (!referrerCode && legacy && legacy !== identity) {
      // bound under the old cookie identity - carry it across once
      const old = await getReferrerCode(legacy);
      if (old && (await bindReferrer(identity, old))) referrerCode = old;
    }
    if (!referrerCode) {
      return NextResponse.json({ ok: true, credited: false, reason: 'no_referrer', code: myCode });
    }

    if (!(await reserveDailyCredit(referrerCode))) {
      return NextResponse.json({ ok: true, credited: false, reason: 'recruiter_daily_cap', code: myCode });
    }
    const result = await creditReferral(identity);
    if (!result) {
      await releaseDailyCredit(referrerCode);
      return NextResponse.json({ ok: true, credited: false, reason: 'already_credited', code: myCode });
    }
    // reward both the referred pilot and the recruiter
    await reward(identity);
    await reward(result.owner);
    return NextResponse.json({ ok: true, credited: true, recruiterTotal: result.total, code: myCode });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
