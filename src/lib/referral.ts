// Referral system: players invite friends with a personal code
// (raidshooter.xyz/?ref=CODE). When an invited pilot plays and reaches a
// qualifying score, both sides earn a reward and the referrer climbs the
// recruiters board.
//
// Anti-abuse rules baked in here:
//   - a referred identity is bound to exactly one referrer, set once and
//     never overwritten (no swapping the credit around later),
//   - you can't refer yourself,
//   - a referral is credited at most once per referred identity (idempotent),
//   - credit only lands after the referred pilot proves activity (the caller
//     gates on a qualifying score before calling creditReferral).
// Redis-backed when configured, in-memory fallback for dev.

import { kvUrl, kvToken, redisCommand } from '@/lib/kv';

const redis = redisCommand;

const CODE_OWNER_KEY = 'referral:owner';     // hash: code -> identity
const IDENTITY_CODE_KEY = 'referral:code';   // hash: identity -> code
const REFERRER_KEY = 'referral:referrer';    // hash: referredIdentity -> code
const CREDITED_KEY = 'referral:credited';    // set: referredIdentity
const RECRUITERS_KEY = 'referral:recruiters'; // zset: code -> confirmed invites

// in-memory fallback
const memOwner = new Map<string, string>();
const memCode = new Map<string, string>();
const memReferrer = new Map<string, string>();
const memCredited = new Set<string>();
const memRecruiters = new Map<string, number>();

// A code is uppercase alphanumerics, 3-16 chars — matches the call-sign glyph
// set so it renders in the bitmap font and reads cleanly in a URL.
export function cleanCode(input: string): string {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

// Derive a stable code for an identity from their call sign, falling back to
// a short slice of a wallet/guest key. Guarantees a minimum length.
function deriveCode(identity: string, callSign?: string): string {
  let code = cleanCode(callSign || '');
  if (code.length < 3) {
    code = cleanCode(identity.replace(/^guest:/, 'G').replace(/^0x/, '')).slice(0, 8);
  }
  if (code.length < 3) code = 'PILOT' + Math.floor(1000 + Math.random() * 9000);
  return code;
}

// Get (or mint) this identity's referral code. If their preferred code is
// taken by someone else, a numeric suffix is appended until it's free.
export async function ensureCode(identity: string, callSign?: string): Promise<string> {
  const existing = await getCodeFor(identity);
  if (existing) return existing;

  let base = deriveCode(identity, callSign);
  let code = base;
  let n = 1;
  // resolve collisions against a different owner
  // (bounded loop; codes are cheap and the space is large)
  while (n < 50) {
    const owner = await ownerOf(code);
    if (!owner || owner === identity) break;
    n += 1;
    code = (base + n).slice(0, 16);
  }
  if (kvUrl && kvToken) {
    await redis(['HSET', CODE_OWNER_KEY, code, identity]);
    await redis(['HSET', IDENTITY_CODE_KEY, identity, code]);
  } else {
    memOwner.set(code, identity);
    memCode.set(identity, code);
  }
  return code;
}

export async function getCodeFor(identity: string): Promise<string | null> {
  if (kvUrl && kvToken) {
    return (await redis(['HGET', IDENTITY_CODE_KEY, identity])) as string | null;
  }
  return memCode.get(identity) || null;
}

export async function ownerOf(code: string): Promise<string | null> {
  const c = cleanCode(code);
  if (!c) return null;
  if (kvUrl && kvToken) {
    return (await redis(['HGET', CODE_OWNER_KEY, c])) as string | null;
  }
  return memOwner.get(c) || null;
}

// Bind a referred identity to the code that invited them. First writer wins:
// once someone is marked as referred, it never changes. Returns true if the
// binding was newly created.
export async function bindReferrer(referredIdentity: string, code: string): Promise<boolean> {
  const c = cleanCode(code);
  if (!c) return false;
  const owner = await ownerOf(c);
  if (!owner || owner === referredIdentity) return false; // self-referral / unknown code
  const already = await getReferrerCode(referredIdentity);
  if (already) return false;
  if (kvUrl && kvToken) {
    // NX so a race can't overwrite an existing binding
    const set = (await redis(['HSETNX', REFERRER_KEY, referredIdentity, c])) as number;
    return set === 1;
  }
  if (memReferrer.has(referredIdentity)) return false;
  memReferrer.set(referredIdentity, c);
  return true;
}

export async function getReferrerCode(referredIdentity: string): Promise<string | null> {
  if (kvUrl && kvToken) {
    return (await redis(['HGET', REFERRER_KEY, referredIdentity])) as string | null;
  }
  return memReferrer.get(referredIdentity) || null;
}

// Credit the referrer for a qualified referred pilot. Idempotent per referred
// identity. Returns the referrer's code and their new confirmed-invite total
// when credit is newly applied, or null if there's nothing to credit.
export async function creditReferral(
  referredIdentity: string
): Promise<{ code: string; owner: string; total: number } | null> {
  const code = await getReferrerCode(referredIdentity);
  if (!code) return null;
  const owner = await ownerOf(code);
  if (!owner || owner === referredIdentity) return null;

  // idempotency gate
  if (kvUrl && kvToken) {
    const added = (await redis(['SADD', CREDITED_KEY, referredIdentity])) as number;
    if (added !== 1) return null;
    const total = (await redis(['ZINCRBY', RECRUITERS_KEY, 1, code])) as number;
    return { code, owner, total: Number(total) || 0 };
  }
  if (memCredited.has(referredIdentity)) return null;
  memCredited.add(referredIdentity);
  const total = (memRecruiters.get(code) || 0) + 1;
  memRecruiters.set(code, total);
  return { code, owner, total };
}

export interface RecruiterRow { code: string; invites: number; owner: string | null; }

export async function getTopRecruiters(limit = 25): Promise<RecruiterRow[]> {
  if (kvUrl && kvToken) {
    const raw = (await redis(['ZRANGE', RECRUITERS_KEY, 0, limit - 1, 'REV', 'WITHSCORES'])) as string[];
    const rows: RecruiterRow[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      rows.push({ code: raw[i], invites: Number(raw[i + 1]) || 0, owner: null });
    }
    return rows;
  }
  return [...memRecruiters.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, invites]) => ({ code, invites, owner: memOwner.get(code) || null }));
}

// How many confirmed invites a code has (for the referrer's own stats view).
export async function getInviteCount(code: string): Promise<number> {
  const c = cleanCode(code);
  if (!c) return 0;
  if (kvUrl && kvToken) {
    const s = (await redis(['ZSCORE', RECRUITERS_KEY, c])) as string | null;
    return s ? Number(s) || 0 : 0;
  }
  return memRecruiters.get(c) || 0;
}
