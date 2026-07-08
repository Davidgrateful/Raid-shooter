// Cup-scoped leaderboard: a time-boxed board that only counts runs played
// while a sponsored cup (season) is live. This is the "esports" board that
// judges a tournament — separate from the all-time global Shooterboard so a
// monster score set months ago can't win a cup nobody competed in.
//
// Design: a cup run posts to BOTH boards. It still updates the player's
// all-time global best (same skill, same game), but the cup RANKING is judged
// only on scores set inside the cup window. Redis-backed when configured,
// in-memory fallback for dev — same as every other store here.

import { kvUrl, kvToken, redisCommand } from '@/lib/kv';
import type { BoardEntry } from '@/lib/leaderboard';

const redis = redisCommand;

function boardKey(seasonId: string): string { return `cup:board:${seasonId}`; }
function entriesKey(seasonId: string): string { return `cup:entries:${seasonId}`; }

// in-memory fallback (per instance)
const memBoards = new Map<string, Map<string, BoardEntry>>();
function memBoard(seasonId: string): Map<string, BoardEntry> {
  let b = memBoards.get(seasonId);
  if (!b) { b = new Map(); memBoards.set(seasonId, b); }
  return b;
}

// Post a run to a cup board. Keeps the best score per identity within the
// window (GT semantics), mirroring the global board's personal-best rule.
export async function submitCupEntry(seasonId: string, entry: BoardEntry): Promise<void> {
  if (kvUrl && kvToken) {
    const changed = (await redis(['ZADD', boardKey(seasonId), 'GT', 'CH', entry.score, entry.address])) as number;
    if (changed > 0) {
      await redis(['HSET', entriesKey(seasonId), entry.address, JSON.stringify(entry)]);
    }
    // cups are time-boxed; let the raw board self-clean a week after the run
    await redis(['EXPIRE', boardKey(seasonId), 14 * 86400]);
    await redis(['EXPIRE', entriesKey(seasonId), 14 * 86400]);
    return;
  }
  const b = memBoard(seasonId);
  const existing = b.get(entry.address);
  if (!existing || entry.score > existing.score) b.set(entry.address, entry);
}

export async function getCupTop(seasonId: string, limit = 100): Promise<BoardEntry[]> {
  if (kvUrl && kvToken) {
    const ids = (await redis(['ZRANGE', boardKey(seasonId), 0, limit - 1, 'REV'])) as string[];
    if (!ids || ids.length === 0) return [];
    const raw = (await redis(['HMGET', entriesKey(seasonId), ...ids])) as (string | null)[];
    const out: BoardEntry[] = [];
    for (const item of raw) {
      if (item) { try { out.push(JSON.parse(item) as BoardEntry); } catch { /* skip corrupt row */ } }
    }
    return out;
  }
  return [...memBoard(seasonId).values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// Strip one identity's score from a cup board (moderation: derank/ban). Used
// so a cheater removed from the all-time board also drops off the sponsored
// cup they were gaming. Returns true if a row was actually removed.
export async function removeFromCup(seasonId: string, key: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const removed = (await redis(['ZREM', boardKey(seasonId), key])) as number;
    await redis(['HDEL', entriesKey(seasonId), key]);
    return removed > 0;
  }
  return memBoard(seasonId).delete(key);
}

export async function getCupCount(seasonId: string): Promise<number> {
  if (kvUrl && kvToken) {
    const n = (await redis(['ZCARD', boardKey(seasonId)])) as number;
    return n || 0;
  }
  return memBoard(seasonId).size;
}
