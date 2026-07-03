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
} from '@/lib/referral';

// The reward both sides earn once a referral is confirmed. A consumable boost
// (only meaningful for wallet players, who have a profile to hold it) — never
// a competitive edge, since a run that spends a boost is excluded from the
// ranked board. Guests still get recruiter-board credit and the social win.
const REFERRAL_REWARD = 'consumable_shield';
// A referred pilot only counts once they prove they actually played.
const QUALIFYING_SCORE = 5000;

// Resolve the caller's stable identity (wallet address or guest id).
async function identityOf(): Promise<{ identity: string; verified: boolean }> {
  const session = await getSession();
  if (session.siwe) return { identity: session.siwe.address.toLowerCase(), verified: true };
  return { identity: await getOrCreateGuestId(session), verified: false };
}

async function reward(identity: string) {
  if (!/^0x[0-9a-f]{40}$/i.test(identity)) return; // guests have no profile
  const item = getItem(REFERRAL_REWARD);
  if (item) await grantItem(identity, item).catch(() => {});
}

// GET: this player's own referral code + invite count, plus the top recruiters
// board for the in-game "INVITE" screen.
export async function GET() {
  const { identity } = await identityOf();
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
    | { action?: string; ref?: string; callSign?: string; score?: number }
    | null;
  if (!body?.action) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { identity } = await identityOf();
  // mint/keep this player's own code (so they can invite others immediately)
  const myCode = await ensureCode(identity, body.callSign);

  if (body.action === 'track') {
    if (!body.ref) return NextResponse.json({ error: 'ref_required' }, { status: 400 });
    const bound = await bindReferrer(identity, body.ref);
    return NextResponse.json({ ok: true, bound, code: myCode });
  }

  if (body.action === 'claim') {
    const score = Number(body.score) || 0;
    if (score < QUALIFYING_SCORE) {
      return NextResponse.json({ ok: true, credited: false, reason: 'below_threshold', code: myCode });
    }
    const referrerCode = await getReferrerCode(identity);
    if (!referrerCode) {
      return NextResponse.json({ ok: true, credited: false, reason: 'no_referrer', code: myCode });
    }
    const result = await creditReferral(identity);
    if (!result) {
      return NextResponse.json({ ok: true, credited: false, reason: 'already_credited', code: myCode });
    }
    // reward both the referred pilot and the recruiter
    await reward(identity);
    await reward(result.owner);
    return NextResponse.json({ ok: true, credited: true, recruiterTotal: result.total, code: myCode });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
