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

export async function submitEntry(
  entry: BoardEntry
): Promise<{ rank: number; improved: boolean }> {
  // banned players (caught cheating) silently can't post - the client gets
  // a normal-looking response so there's nothing to probe or work around
  if (await isBanned(entry.address)) {
    return { rank: 0, improved: false };
  }
  if (kvUrl && kvToken) {
    const changed = (await redis([
      'ZADD',
      BOARD_KEY,
      'GT',
      'CH',
      entry.score,
      entry.address,
    ])) as number;
    const improved = changed > 0;
    if (improved) {
      await redis(['HSET', ENTRIES_KEY, entry.address, JSON.stringify(entry)]);
    } else if (entry.name) {
      // allow a name change to apply without beating the personal best
      const raw = (await redis(['HGET', ENTRIES_KEY, entry.address])) as
        | string
        | null;
      if (raw) {
        try {
          const stored = JSON.parse(raw) as BoardEntry;
          if (stored.name !== entry.name) {
            stored.name = entry.name;
            await redis(['HSET', ENTRIES_KEY, entry.address, JSON.stringify(stored)]);
          }
        } catch {
          // leave a corrupt row alone
        }
      }
    }
    const rank = (await redis(['ZREVRANK', BOARD_KEY, entry.address])) as
      | number
      | null;
    return { rank: rank === null ? 0 : rank + 1, improved };
  }

  const existing = memoryBoard.get(entry.address);
  const improved = !existing || entry.score > existing.score;
  if (improved) {
    memoryBoard.set(entry.address, entry);
  } else if (existing && entry.name && existing.name !== entry.name) {
    existing.name = entry.name;
  }
  return { rank: memoryRank(entry.address), improved };
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

// Every stored entry (one per address: their best run). Used by the admin
// stats endpoint to aggregate - the board only keeps a player's best run,
// so these numbers describe best-runs, not every session played.
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
}

const memFlagged = new Map<string, FlaggedRun>();

// Heuristics tuned to catch "too good to be human" runs, not good players:
// absolute score outliers, kill rates beyond human APM, and score-per-kill
// ratios close to the theoretical cap for the whole run.
export function suspicionReason(entry: BoardEntry): string | null {
  if (entry.score >= 75_000) return 'HIGH SCORE OUTLIER';
  if (entry.time > 0 && entry.kills / entry.time > 8) return 'KILL RATE > 8/S';
  if (entry.kills > 0 && entry.score / entry.kills > 6000) return 'SCORE/KILL NEAR CAP';
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
