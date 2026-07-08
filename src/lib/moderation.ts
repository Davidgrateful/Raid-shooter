// Cross-board moderation. The all-time Shooterboard, every sponsored cup, and
// the weekly ladder are separate stores, so removing a cheater from one used
// to leave their score standing on the others. These helpers fan a derank/ban
// out across ALL of them so a flagged run disappears everywhere at once.
//
// Kept in its own module (not leaderboard.ts) to avoid an import cycle:
// cup.ts / weekly.ts already import the BoardEntry type from leaderboard.ts.

import { removeEntry, banPlayer, unbanPlayer, getEntry, submitEntry, type BoardEntry } from '@/lib/leaderboard';
import { removeFromCup } from '@/lib/cup';
import { removeFromWeekly } from '@/lib/weekly';
import { listSeasons } from '@/lib/rewards';
import { kvUrl, kvToken, redisCommand } from '@/lib/kv';

export interface PurgeResult {
  allTime: boolean;
  cups: number; // how many cup boards a row was removed from
  weekly: boolean;
}

// Safety net for accidental moderation: before a derank/ban wipes a score we
// stash the removed all-time entry here so it can be put back with one click.
// (Restore re-posts to the all-time board; cup/weekly re-attach on the player's
// next run.) Keyed by board key; kept ~30 days.
const REMOVED_KEY = 'shooterboard:removed';
const REMOVED_TTL = 30 * 86400;
const memRemoved = new Map<string, { entry: BoardEntry; at: number }>();

async function snapshotRemoval(key: string): Promise<void> {
  try {
    const entry = await getEntry(key);
    if (!entry) return;
    if (kvUrl && kvToken) {
      await redisCommand(['HSET', REMOVED_KEY, key, JSON.stringify({ entry, at: Date.now() })]);
      await redisCommand(['EXPIRE', REMOVED_KEY, REMOVED_TTL]);
    } else {
      memRemoved.set(key, { entry, at: Date.now() });
    }
  } catch {
    // snapshot is best-effort - never block the removal itself
  }
}

// Put a removed score back on the all-time board and lift any ban. Returns the
// restored score, or restored:false if there was nothing snapshotted.
export async function restoreScore(key: string): Promise<{ restored: boolean; score?: number }> {
  let rec: { entry: BoardEntry; at: number } | null = null;
  if (kvUrl && kvToken) {
    const raw = (await redisCommand(['HGET', REMOVED_KEY, key])) as string | null;
    if (raw) { try { rec = JSON.parse(raw); } catch { rec = null; } }
  } else {
    rec = memRemoved.get(key) || null;
  }
  if (!rec || !rec.entry) return { restored: false };
  await unbanPlayer(key);          // must lift the ban first, or submitEntry no-ops
  await submitEntry(rec.entry);    // re-adds to the all-time board (GT keeps the higher of the two)
  if (kvUrl && kvToken) { await redisCommand(['HDEL', REMOVED_KEY, key]); } else { memRemoved.delete(key); }
  return { restored: true, score: rec.entry.score };
}

// Recently-removed snapshots (for an admin "undo" list). Newest first.
export async function listRemoved(): Promise<Array<{ key: string; entry: BoardEntry; at: number }>> {
  const out: Array<{ key: string; entry: BoardEntry; at: number }> = [];
  if (kvUrl && kvToken) {
    const raw = (await redisCommand(['HGETALL', REMOVED_KEY])) as unknown;
    const pairs: Array<[string, string]> = [];
    if (Array.isArray(raw)) { for (let i = 0; i < raw.length; i += 2) pairs.push([String(raw[i]), String(raw[i + 1])]); }
    else if (raw && typeof raw === 'object') { for (const [k, v] of Object.entries(raw as Record<string, unknown>)) pairs.push([k, String(v)]); }
    for (const [k, v] of pairs) { try { const r = JSON.parse(v); out.push({ key: k, entry: r.entry, at: r.at }); } catch { /* skip */ } }
  } else {
    for (const [k, r] of memRemoved.entries()) out.push({ key: k, entry: r.entry, at: r.at });
  }
  return out.sort((a, b) => b.at - a.at);
}

// Remove one identity's score from all-time + every cup season + this week's
// ladder. Best-effort per board so one failure never blocks the others.
export async function purgeScoresEverywhere(key: string): Promise<PurgeResult> {
  const result: PurgeResult = { allTime: false, cups: 0, weekly: false };

  await snapshotRemoval(key); // stash for one-click restore before we wipe it
  result.allTime = await removeEntry(key).catch(() => false);

  try {
    const seasons = await listSeasons();
    for (const s of seasons) {
      const removed = await removeFromCup(s.id, key).catch(() => false);
      if (removed) result.cups++;
    }
  } catch {
    // season list unavailable - all-time removal still stands
  }

  result.weekly = await removeFromWeekly(key).catch(() => false);
  return result;
}

// Ban (remove everywhere + block future submissions). banPlayer already strips
// the all-time row and adds the ban; we additionally clear the cup + weekly
// boards so the block is total.
export async function banEverywhere(key: string): Promise<PurgeResult> {
  await snapshotRemoval(key); // stash before the ban wipes the score
  await banPlayer(key);
  const result: PurgeResult = { allTime: true, cups: 0, weekly: false };
  try {
    const seasons = await listSeasons();
    for (const s of seasons) {
      const removed = await removeFromCup(s.id, key).catch(() => false);
      if (removed) result.cups++;
    }
  } catch {
    // best-effort
  }
  result.weekly = await removeFromWeekly(key).catch(() => false);
  return result;
}
