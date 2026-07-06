// Weekly ladder: a board that resets every Monday 00:00 UTC. Runs post here
// alongside the all-time Shooterboard (best score per identity per week), so
// newcomers always have a fresh field they can actually rank on. Ephemeral by
// design - keys expire a couple of weeks out. Redis-backed when configured,
// in-memory fallback for dev, same as every other store here.

import { kvUrl, kvToken, redisCommand } from '@/lib/kv';
import type { BoardEntry } from '@/lib/leaderboard';

const redis = redisCommand;

// Monday-based week key, UTC: "2026-W28" style (year + ISO-ish week number
// derived from the Monday date so keys sort and never collide across years).
export function weekKey(now = Date.now()): string {
  const d = new Date(now);
  // roll back to Monday 00:00 UTC
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const back = (day + 6) % 7; // days since Monday
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back);
  const m = new Date(monday);
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}-${String(m.getUTCDate()).padStart(2, '0')}`;
}

// when the current week's board resets (next Monday 00:00 UTC)
export function weekResetsAt(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getUTCDay();
  const back = (day + 6) % 7;
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back);
  return monday + 7 * 86400000;
}

function boardKey(week: string): string { return `weekly:board:${week}`; }
function entriesKey(week: string): string { return `weekly:entries:${week}`; }

// in-memory fallback (per instance)
const memBoards = new Map<string, Map<string, BoardEntry>>();
function memBoard(week: string): Map<string, BoardEntry> {
  let b = memBoards.get(week);
  if (!b) { b = new Map(); memBoards.set(week, b); }
  return b;
}

// Post a run to this week's ladder (best per identity, GT semantics).
export async function submitWeekly(entry: BoardEntry): Promise<void> {
  const week = weekKey();
  if (kvUrl && kvToken) {
    const changed = (await redis(['ZADD', boardKey(week), 'GT', 'CH', entry.score, entry.address])) as number;
    if (changed > 0) {
      await redis(['HSET', entriesKey(week), entry.address, JSON.stringify(entry)]);
    }
    // weekly boards are ephemeral - self-clean two weeks out
    await redis(['EXPIRE', boardKey(week), 21 * 86400]);
    await redis(['EXPIRE', entriesKey(week), 21 * 86400]);
    return;
  }
  const b = memBoard(week);
  const existing = b.get(entry.address);
  if (!existing || entry.score > existing.score) b.set(entry.address, entry);
}

export async function getWeeklyTop(limit = 250): Promise<BoardEntry[]> {
  const week = weekKey();
  if (kvUrl && kvToken) {
    const ids = (await redis(['ZRANGE', boardKey(week), 0, limit - 1, 'REV'])) as string[];
    if (!ids || ids.length === 0) return [];
    const raw = (await redis(['HMGET', entriesKey(week), ...ids])) as (string | null)[];
    const out: BoardEntry[] = [];
    for (const item of raw) {
      if (item) { try { out.push(JSON.parse(item) as BoardEntry); } catch { /* skip corrupt row */ } }
    }
    return out;
  }
  return [...memBoard(week).values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getWeeklyCount(): Promise<number> {
  const week = weekKey();
  if (kvUrl && kvToken) {
    const n = (await redis(['ZCARD', boardKey(week)])) as number;
    return n || 0;
  }
  return memBoard(week).size;
}
