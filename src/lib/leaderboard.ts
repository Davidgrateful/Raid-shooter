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

const BOARD_KEY = 'shooterboard';
const ENTRIES_KEY = 'shooterboard:entries';

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Whether a shared, persistent backend is configured. Without it the board
// uses per-instance in-memory storage, which on serverless means players
// can't see each other's scores — surfaced to the client so the failure is
// visible instead of silent.
export function isPersistent(): boolean {
  return !!(kvUrl && kvToken);
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(kvUrl!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status}`);
  }
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

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
