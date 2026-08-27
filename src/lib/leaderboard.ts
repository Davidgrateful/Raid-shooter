// Shooterboard storage. Uses a Redis REST backend (Vercel KV / Upstash)
// when configured, falling back to an in-memory store so local dev works
// without any setup. On Vercel, set KV_REST_API_URL/KV_REST_API_TOKEN
// (or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) for persistence.

export interface BoardEntry {
  // Leaderboard member key: a wallet address for verified players, or a
  // "guest:<id>" handle for wallet-less guests. Used as the sorted-set
  // member and the display fallback for wallet players.
  address: string;
  name?: string;
  score: number;
  level: number;
  kills: number;
  combo: number;
  pilot: string;
  time: number;
  at: number;
  // True when the entry is backed by a connected wallet (SIWE).
  verified?: boolean;
  // True when the run used a paid combat consumable (health/shield/revive).
  // Recorded for operator audit before tournament payouts; the run ranks
  // normally either way - assists are a fair, bounded part of the loadout.
  assisted?: boolean;
  // Equipped loadout at submit time - purely cosmetic, rendered as a small
  // badge next to the player's row so a purchase is visible to every other
  // competitor scanning the board, not just the buyer. Never affects score
  // or rank. Sanitized server-side against a known-id allowlist before
  // storage (see route.ts) so a forged payload can't inject garbage into
  // every viewer's leaderboard render.
  cosmetics?: {
    pilotId?: string;
    shipColor?: string;
    trailHue?: number;
    droneId?: string;
  };
}

import { isKvConfigured, kvUrl, kvToken, redisCommand } from '@/lib/kv';

const BOARD_KEY = 'shooterboard';
const ENTRIES_KEY = 'shooterboard:entries';
const BANNED_KEY = 'shooterboard:banned';

// Whether a shared, persistent backend is configured. Without it the board
// uses per-instance in-memory storage, which on serverless means players
// can't see each other's scores — surfaced to the client so the failure is
// visible instead of silent.
export function isPersistent(): boolean {
  return isKvConfigured();
}

const redis = redisCommand;

// In-memory fallback (per server instance; fine for dev, ephemeral on serverless)
const memoryBoard = new Map<string, BoardEntry>();

function memoryRank(address: string): number {
  const sorted = [...memoryBoard.values()].sort((a, b) => b.score - a.score);
  return sorted.findIndex((e) => e.address === address) + 1;
}

// One submission per wallet per cooldown window; forged-run spam from a
// single wallet gets throttled even though runs are client-reported.
const SUBMIT_COOLDOWN_MS = 20_000;
const memoryCooldowns = new Map<string, number>();

/*==============================================================================
RUN IDEMPOTENCY

The board is CUMULATIVE (submitEntry ZINCRBYs), and a submission carried no
identity of any kind - no run id, no nonce, nothing the server issued. The only
guard was the 20s cooldown, which paces replays rather than preventing them.

Measured before this existed: capturing one valid POST and re-sending it
unchanged three times took an identity from 50,000 to 100,000 to 150,000, with
kills going 420 -> 1260. Nothing caught it. The structural bounds are wide by
design, the plausibility ratios are satisfied because the payload IS a real
run's shape, and suspicionReason only ever inspects the single entry - whose
numbers stay modest - never the accumulated total. At one submit per 20s that
is 180 replays an hour, and because computeWinners ranks off the (also
cumulative) cup board, it converts directly into cosmetic grants and USDC.

The fix is idempotency rather than rejection, because the client has a
LEGITIMATE retry that resends the exact same payload: shooterboard.js captures
the payload once so a cooldown 429 can be waited out and re-sent, which is what
stopped scores being silently lost to pacing. So a repeat must not error - it
must return the same answer as the first time and count once.

Ordering matters. This is claimed only AFTER the cooldown check passes, so a
run that was 429'd never claimed its signature and its retry is still the first
real submission. And a client that never sees the response (dropped connection
after the server applied it) retries into `duplicate`, gets its true standing
back, and is not double-counted.

This kills replay of a captured request. It does NOT stop a forger who varies
the numbers to mint a fresh signature - the score is client-authoritative, and
closing that needs server-issued run tokens, which is a different and much
larger design than this audit's remit.
==============================================================================*/
const RUN_SIG_TTL_MS = 24 * 3600 * 1000;
const memoryRuns = new Map<string, number>();

/** The immutable shape of one run. Two genuine runs matching on every one of
 *  these is not something a human produces. */
export function runSignature(e: {
  score: number; level: number; kills: number; combo: number; time: number; pilot: string;
}): string {
  return `${e.score}:${e.level}:${e.kills}:${e.combo}:${e.time}:${e.pilot}`;
}

/**
 * Claim this exact run for this identity. True the first time, false if the
 * same run has already been counted inside the TTL.
 */
export async function claimRunOnce(address: string, signature: string): Promise<boolean> {
  const k = `shooterboard:run:${address}:${signature}`;
  if (kvUrl && kvToken) {
    const r = (await redis(['SET', k, '1', 'PX', RUN_SIG_TTL_MS, 'NX'])) as string | null;
    return r === 'OK';
  }
  const now = Date.now();
  // the dev fallback is per-instance and unbounded otherwise; sweep expired
  // keys whenever the map gets big rather than on every call
  if (memoryRuns.size > 5000) {
    for (const [mk, at] of memoryRuns) { if (now - at >= RUN_SIG_TTL_MS) memoryRuns.delete(mk); }
  }
  const prev = memoryRuns.get(k);
  if (prev !== undefined && now - prev < RUN_SIG_TTL_MS) return false;
  memoryRuns.set(k, now);
  return true;
}

export async function checkSubmitAllowed(address: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const result = (await redis([
      'SET',
      `shooterboard:cooldown:${address}`,
      '1',
      'PX',
      SUBMIT_COOLDOWN_MS,
      'NX',
    ])) as string | null;
    return result === 'OK';
  }
  const last = memoryCooldowns.get(address) || 0;
  if (Date.now() - last < SUBMIT_COOLDOWN_MS) {
    return false;
  }
  memoryCooldowns.set(address, Date.now());
  return true;
}

// The board is CUMULATIVE: every run's score adds to a lifetime running
// total rather than only replacing a personal best. Consistent play keeps
// climbing the board, not just a single great run. `kills` accumulates the
// same way; name/level/combo/pilot/time/verified/cosmetics reflect the most
// recent run (there's no meaningful "cumulative" version of a snapshot
// field like equipped pilot). `improved` now means "this run moved the
// player UP in rank" (not merely "posted a higher score than before" -
// with cumulative totals every positive-score run raises the total, so
// rank movement is the meaningful signal for the personal-best chat
// callout, not raw score comparison).
export async function submitEntry(
  entry: BoardEntry
): Promise<{ rank: number; improved: boolean; total: number }> {
  // banned players (caught cheating) silently can't post - the client gets
  // a normal-looking response so there's nothing to probe or work around
  if (await isBanned(entry.address)) {
    return { rank: 0, improved: false, total: 0 };
  }
  if (kvUrl && kvToken) {
    const prevRank = (await redis(['ZREVRANK', BOARD_KEY, entry.address])) as number | null;
    const raw = (await redis(['HGET', ENTRIES_KEY, entry.address])) as string | null;
    let prevKills = 0;
    if (raw) {
      try { prevKills = (JSON.parse(raw) as BoardEntry).kills || 0; } catch { /* corrupt row, treat as fresh */ }
    }
    const newTotal = (await redis(['ZINCRBY', BOARD_KEY, entry.score, entry.address])) as string | number;
    const total = Number(newTotal);
    const stored: BoardEntry = { ...entry, score: total, kills: prevKills + entry.kills };
    await redis(['HSET', ENTRIES_KEY, entry.address, JSON.stringify(stored)]);
    const rank = (await redis(['ZREVRANK', BOARD_KEY, entry.address])) as number | null;
    const newRank = rank === null ? 0 : rank + 1;
    const improved = prevRank === null || (rank !== null && rank < prevRank);
    return { rank: newRank, improved, total };
  }

  const existing = memoryBoard.get(entry.address);
  const prevRankMem = existing ? memoryRank(entry.address) : 0;
  const total = (existing?.score || 0) + entry.score;
  const stored: BoardEntry = {
    ...entry,
    score: total,
    kills: (existing?.kills || 0) + entry.kills,
  };
  memoryBoard.set(entry.address, stored);
  const newRankMem = memoryRank(entry.address);
  const improved = !existing || newRankMem < prevRankMem;
  return { rank: newRankMem, improved, total };
}

/**
 * An identity's current standing without changing it. Used to answer a
 * duplicate submission with the player's real position rather than an error,
 * so a retry that arrives after the run already counted still gets the truth.
 */
export async function getStanding(address: string): Promise<{ rank: number; total: number }> {
  if (kvUrl && kvToken) {
    const [rank, score] = (await Promise.all([
      redis(['ZREVRANK', BOARD_KEY, address]),
      redis(['ZSCORE', BOARD_KEY, address]),
    ])) as [number | null, string | null];
    return { rank: rank === null ? 0 : rank + 1, total: score === null ? 0 : Number(score) };
  }
  const existing = memoryBoard.get(address);
  return { rank: existing ? memoryRank(address) : 0, total: existing?.score || 0 };
}

// Admin-only: set an identity's score to an EXACT value, overwriting
// whatever total they currently have. Unlike submitEntry (which adds to
// the running cumulative total - correct for real gameplay), this is for
// manual corrections ("put their score back to exactly 45,000") where an
// admin means "set", not "add". Bypasses the cumulative-add path entirely.
export async function setEntry(entry: BoardEntry): Promise<{ rank: number }> {
  if (kvUrl && kvToken) {
    await redis(['ZADD', BOARD_KEY, entry.score, entry.address]);
    await redis(['HSET', ENTRIES_KEY, entry.address, JSON.stringify(entry)]);
    const rank = (await redis(['ZREVRANK', BOARD_KEY, entry.address])) as number | null;
    return { rank: rank === null ? 0 : rank + 1 };
  }
  memoryBoard.set(entry.address, entry);
  return { rank: memoryRank(entry.address) };
}

// Carries a guest's rank over to their wallet the moment they connect, so
// upgrading to a verified badge never costs progress. Keeps whichever score
// is higher (guest run or any pre-existing wallet entry) under the wallet's
// key, then drops the now-orphaned guest row.
export async function mergeGuestIntoWallet(
  guestKey: string,
  walletKey: string
): Promise<void> {
  if (kvUrl && kvToken) {
    const guestRaw = (await redis(['HGET', ENTRIES_KEY, guestKey])) as
      | string
      | null;
    if (!guestRaw) {
      return;
    }
    let guestEntry: BoardEntry;
    try {
      guestEntry = JSON.parse(guestRaw) as BoardEntry;
    } catch {
      return;
    }

    const walletRaw = (await redis(['HGET', ENTRIES_KEY, walletKey])) as
      | string
      | null;
    let walletEntry: BoardEntry | null = null;
    if (walletRaw) {
      try {
        walletEntry = JSON.parse(walletRaw) as BoardEntry;
      } catch {
        walletEntry = null;
      }
    }

    const winner: BoardEntry =
      walletEntry && walletEntry.score >= guestEntry.score
        ? walletEntry
        : { ...guestEntry, name: walletEntry?.name ?? guestEntry.name };
    winner.address = walletKey;
    winner.verified = true;

    await redis(['ZADD', BOARD_KEY, winner.score, walletKey]);
    await redis(['HSET', ENTRIES_KEY, walletKey, JSON.stringify(winner)]);
    await redis(['ZREM', BOARD_KEY, guestKey]);
    await redis(['HDEL', ENTRIES_KEY, guestKey]);
    return;
  }

  const guestEntry = memoryBoard.get(guestKey);
  if (!guestEntry) {
    return;
  }
  const walletEntry = memoryBoard.get(walletKey);
  const winner: BoardEntry =
    walletEntry && walletEntry.score >= guestEntry.score
      ? walletEntry
      : { ...guestEntry, name: walletEntry?.name ?? guestEntry.name };
  winner.address = walletKey;
  winner.verified = true;
  memoryBoard.set(walletKey, winner);
  memoryBoard.delete(guestKey);
}

export async function getTop(limit = 50): Promise<BoardEntry[]> {
  if (kvUrl && kvToken) {
    const addresses = (await redis([
      'ZRANGE',
      BOARD_KEY,
      0,
      limit - 1,
      'REV',
    ])) as string[];
    if (!addresses || addresses.length === 0) {
      return [];
    }
    const raw = (await redis(['HMGET', ENTRIES_KEY, ...addresses])) as (
      | string
      | null
    )[];
    const entries: BoardEntry[] = [];
    for (const item of raw) {
      if (item) {
        try {
          entries.push(JSON.parse(item) as BoardEntry);
        } catch {
          // skip corrupt rows rather than failing the whole board
        }
      }
    }
    return entries;
  }

  return [...memoryBoard.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// In-memory ban set mirror (per instance; ephemeral on serverless)
const memoryBanned = new Set<string>();

// Whether a player is banned from the board (caught cheating). Banned keys
// can't submit and their scores are stripped on derank.
export async function isBanned(address: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const r = (await redis(['SISMEMBER', BANNED_KEY, address])) as number;
    return r === 1;
  }
  return memoryBanned.has(address);
}

// Remove a single player's score from the board (derank). Returns true if
// an entry was actually removed.
export async function removeEntry(address: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const removed = (await redis(['ZREM', BOARD_KEY, address])) as number;
    await redis(['HDEL', ENTRIES_KEY, address]);
    return removed > 0;
  }
  return memoryBoard.delete(address);
}

// Derank AND block future submissions. Used when a player is caught
// cheating - they're removed and can't repost a forged score.
export async function banPlayer(address: string): Promise<void> {
  if (kvUrl && kvToken) {
    await redis(['SADD', BANNED_KEY, address]);
  } else {
    memoryBanned.add(address);
  }
  await removeEntry(address);
}

// All banned keys, for annotating the admin players table.
export async function getBanned(): Promise<string[]> {
  if (kvUrl && kvToken) {
    const r = (await redis(['SMEMBERS', BANNED_KEY])) as string[];
    return r || [];
  }
  return [...memoryBanned];
}

// Lift a ban so the player can rank again.
export async function unbanPlayer(address: string): Promise<void> {
  if (kvUrl && kvToken) {
    await redis(['SREM', BANNED_KEY, address]);
  } else {
    memoryBanned.delete(address);
  }
}

// A single player's stored best-run entry, or null. For the admin player
// lookup / purchase-issue diagnosis.
export async function getEntry(address: string): Promise<BoardEntry | null> {
  if (kvUrl && kvToken) {
    const raw = (await redis(['HGET', ENTRIES_KEY, address])) as string | null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BoardEntry;
    } catch {
      return null;
    }
  }
  return memoryBoard.get(address) || null;
}

// Wipe the entire leaderboard (scores + entries). Irreversible - the admin
// route requires an explicit confirmation before calling this.
export async function resetBoard(): Promise<number> {
  if (kvUrl && kvToken) {
    const count = (await redis(['ZCARD', BOARD_KEY])) as number;
    await redis(['DEL', BOARD_KEY]);
    await redis(['DEL', ENTRIES_KEY]);
    return count || 0;
  }
  const count = memoryBoard.size;
  memoryBoard.clear();
  return count;
}

// Every stored entry (one per address: their cumulative lifetime total).
// Used by the admin stats endpoint to aggregate.
export async function getAllEntries(): Promise<BoardEntry[]> {
  if (kvUrl && kvToken) {
    const addresses = (await redis(['ZRANGE', BOARD_KEY, 0, -1, 'REV'])) as string[];
    if (!addresses || addresses.length === 0) {
      return [];
    }
    const raw = (await redis(['HMGET', ENTRIES_KEY, ...addresses])) as (string | null)[];
    const entries: BoardEntry[] = [];
    for (const item of raw) {
      if (item) {
        try {
          entries.push(JSON.parse(item) as BoardEntry);
        } catch {
          // skip corrupt rows rather than failing the whole board
        }
      }
    }
    return entries;
  }
  return [...memoryBoard.values()].sort((a, b) => b.score - a.score);
}

export async function updateName(
  address: string,
  name: string
): Promise<boolean> {
  if (kvUrl && kvToken) {
    const raw = (await redis(['HGET', ENTRIES_KEY, address])) as string | null;
    if (!raw) {
      return false;
    }
    try {
      const stored = JSON.parse(raw) as BoardEntry;
      stored.name = name;
      await redis(['HSET', ENTRIES_KEY, address, JSON.stringify(stored)]);
      return true;
    } catch {
      return false;
    }
  }
  const existing = memoryBoard.get(address);
  if (!existing) {
    return false;
  }
  existing.name = name;
  return true;
}

/*==============================================================================
Flagged-run review queue (anti-cheat)

Scores are client-reported, so before real-money rewards are paid the
operator needs eyes on outliers. Submissions that pass validation but look
suspicious get copied here for manual review - they still rank normally
(no false-positive punishment); the queue is the payout gate, not a block.
==============================================================================*/

const FLAGGED_KEY = 'shooterboard:flagged';

export interface FlaggedRun {
  id: string;
  address: string;
  name?: string;
  score: number;
  kills: number;
  combo: number;
  time: number;
  pilot: string;
  at: number;
  verified: boolean;
  reason: string;
  /*
   * The review queue is described as the anti-cheat gate for payouts, but it
   * used to drop the only two fields that say what the run was FLYING - so an
   * operator judging a flagged run had to go cross-reference the board by hand
   * to learn whether it spent a combat consumable or carried a drone. The
   * `assisted` flag exists specifically "for operator audit before tournament
   * payouts"; it was not reaching the audit.
   */
  assisted?: boolean;
  droneId?: string;
}

const memFlagged = new Map<string, FlaggedRun>();

// Heuristics tuned to catch "too good to be human" runs, not good players:
// absolute score outliers, kill rates beyond human APM, and score-per-kill
// ratios close to the theoretical cap for the whole run.
export function suspicionReason(entry: BoardEntry): string | null {
  // These only COPY a run to the review queue; they never block it. Tuned to
  // catch "too good to be human" outliers without drowning the queue in the
  // genuine high scores that long marathon runs now produce.
  if (entry.score >= 1_000_000) return 'HIGH SCORE OUTLIER';
  if (entry.time > 0 && entry.kills / entry.time > 18) return 'KILL RATE > 18/S';
  // per-kill ceiling is 6000 (boss at x8 combo); anything above is impossible
  if (entry.kills > 0 && entry.score / entry.kills > 6200) return 'SCORE/KILL OVER CAP';
  return null;
}

export async function flagRun(entry: BoardEntry, reason: string): Promise<void> {
  const flagged: FlaggedRun = {
    id: `${entry.address}:${entry.at}`,
    address: entry.address,
    name: entry.name,
    score: entry.score,
    kills: entry.kills,
    combo: entry.combo,
    time: entry.time,
    pilot: entry.pilot,
    at: entry.at,
    verified: !!entry.verified,
    reason,
    assisted: !!entry.assisted,
    droneId: entry.cosmetics?.droneId,
  };
  if (kvUrl && kvToken) {
    await redis(['HSET', FLAGGED_KEY, flagged.id, JSON.stringify(flagged)]);
  } else {
    memFlagged.set(flagged.id, flagged);
  }
}

export async function getFlagged(): Promise<FlaggedRun[]> {
  let rows: FlaggedRun[];
  if (kvUrl && kvToken) {
    const raw = (await redis(['HGETALL', FLAGGED_KEY])) as unknown;
    const vals: string[] = [];
    if (Array.isArray(raw)) {
      for (let i = 1; i < raw.length; i += 2) vals.push(String(raw[i]));
    } else if (raw && typeof raw === 'object') {
      for (const v of Object.values(raw as Record<string, unknown>)) vals.push(String(v));
    }
    rows = vals
      .map((v) => { try { return JSON.parse(v) as FlaggedRun; } catch { return null; } })
      .filter((r): r is FlaggedRun => !!r);
  } else {
    rows = [...memFlagged.values()];
  }
  return rows.sort((a, b) => b.at - a.at);
}

// Remove a run from the queue (after approve/derank/ban was applied).
export async function clearFlag(id: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const removed = (await redis(['HDEL', FLAGGED_KEY, id])) as number;
    return removed > 0;
  }
  return memFlagged.delete(id);
}

// Total number of ranked players (not just the page returned). Lets the UI
// show "OF N" accurately even when only a page of rows is fetched.
export async function getBoardCount(): Promise<number> {
  if (kvUrl && kvToken) {
    const n = (await redis(['ZCARD', BOARD_KEY])) as number;
    return n || 0;
  }
  return memoryBoard.size;
}
