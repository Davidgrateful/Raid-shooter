// Cross-board moderation. The all-time Shooterboard, every sponsored cup, and
// the weekly ladder are separate stores, so removing a cheater from one used
// to leave their score standing on the others. These helpers fan a derank/ban
// out across ALL of them so a flagged run disappears everywhere at once.
//
// Kept in its own module (not leaderboard.ts) to avoid an import cycle:
// cup.ts / weekly.ts already import the BoardEntry type from leaderboard.ts.

import { removeEntry, banPlayer } from '@/lib/leaderboard';
import { removeFromCup } from '@/lib/cup';
import { removeFromWeekly } from '@/lib/weekly';
import { listSeasons } from '@/lib/rewards';

export interface PurgeResult {
  allTime: boolean;
  cups: number; // how many cup boards a row was removed from
  weekly: boolean;
}

// Remove one identity's score from all-time + every cup season + this week's
// ladder. Best-effort per board so one failure never blocks the others.
export async function purgeScoresEverywhere(key: string): Promise<PurgeResult> {
  const result: PurgeResult = { allTime: false, cups: 0, weekly: false };

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
