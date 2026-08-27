// Daily Run mode storage: a separate, one-attempt-per-day competition on a
// board that resets every day. Kept apart from the endless Shooterboard so
// the two modes never mix. Redis-backed when configured, in-memory for dev.

import { isKvConfigured, kvUrl, kvToken, redisCommand } from '@/lib/kv';

export interface DailyEntry {
  identity: string; // wallet address or guest:<id>
  name?: string;
  score: number;
  pilot: string;
  at: number;
  verified?: boolean;
}

const redis = redisCommand;

// in-memory fallback (per instance)
const memBoards = new Map<string, Map<string, DailyEntry>>();
function memBoard(key: string): Map<string, DailyEntry> {
  let b = memBoards.get(key);
  if (!b) { b = new Map(); memBoards.set(key, b); }
  return b;
}

function boardKey(day: string): string { return `dailyrun:board:${day}`; }
function entriesKey(day: string): string { return `dailyrun:entries:${day}`; }

// One attempt per identity per day: true if they've already submitted today.
export async function hasPlayedDaily(day: string, identity: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const r = (await redis(['ZSCORE', boardKey(day), identity])) as string | null;
    return r !== null && r !== undefined;
  }
  return memBoard(day).has(identity);
}

export async function submitDaily(
  day: string,
  entry: DailyEntry
): Promise<{ accepted: boolean; rank: number }> {
  if (await hasPlayedDaily(day, entry.identity)) {
    // already played today - report their existing rank, don't overwrite
    const rank = await dailyRank(day, entry.identity);
    return { accepted: false, rank };
  }
  if (kvUrl && kvToken) {
    await redis(['ZADD', boardKey(day), entry.score, entry.identity]);
    await redis(['HSET', entriesKey(day), entry.identity, JSON.stringify(entry)]);
    // daily boards are ephemeral - expire a couple days out to self-clean
    await redis(['EXPIRE', boardKey(day), 3 * 86400]);
    await redis(['EXPIRE', entriesKey(day), 3 * 86400]);
  } else {
    memBoard(day).set(entry.identity, entry);
  }
  const rank = await dailyRank(day, entry.identity);
  return { accepted: true, rank };
}

export async function dailyRank(day: string, identity: string): Promise<number> {
  if (kvUrl && kvToken) {
    const r = (await redis(['ZREVRANK', boardKey(day), identity])) as number | null;
    return r === null || r === undefined ? 0 : r + 1;
  }
  const sorted = [...memBoard(day).values()].sort((a, b) => b.score - a.score);
  return sorted.findIndex((e) => e.identity === identity) + 1;
}

export async function getDailyTop(day: string, limit = 100): Promise<DailyEntry[]> {
  if (kvUrl && kvToken) {
    const ids = (await redis(['ZRANGE', boardKey(day), 0, limit - 1, 'REV'])) as string[];
    if (!ids || ids.length === 0) return [];
    const raw = (await redis(['HMGET', entriesKey(day), ...ids])) as (string | null)[];
    const out: DailyEntry[] = [];
    for (const item of raw) {
      if (item) { try { out.push(JSON.parse(item) as DailyEntry); } catch { /* skip */ } }
    }
    return out;
  }
  return [...memBoard(day).values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getDailyCount(day: string): Promise<number> {
  if (kvUrl && kvToken) {
    const n = (await redis(['ZCARD', boardKey(day)])) as number;
    return n || 0;
  }
  return memBoard(day).size;
}

/*
 * The day key is the CLIENT's local date, and that is deliberate: it has to
 * match the seed the player was actually given ($.dailyKey in daily.js).
 *
 * But format-checking it was the ONLY check on the write path, which made the
 * one-attempt-per-day rule meaningless. Every distinct well-formed string is a
 * different board with its own hasPlayedDaily() check, so posting day=2030-1-1,
 * 2030-1-2, ... bought unlimited attempts and let one player pre-occupy rank 1
 * on every future daily board before anyone else arrived.
 *
 * Local dates span UTC-12..UTC+14, so an honest client is at most one calendar
 * day either side of the server's UTC date. That is the whole legitimate range.
 * This also rejects strings that pass a format check but are not real dates
 * (2026-2-31), which Date.UTC would otherwise roll forward into March.
 *
 * `now` is injectable so the boundary can be tested without waiting for
 * midnight.
 */
export function dayWithinWindow(day: string, now = Date.now()): boolean {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(day);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const asUtc = Date.UTC(y, mo - 1, d);
  const back = new Date(asUtc);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return false;
  }
  const n = new Date(now);
  const serverMidnight = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.abs(asUtc - serverMidnight) <= 86_400_000;
}
