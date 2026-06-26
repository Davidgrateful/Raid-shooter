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
