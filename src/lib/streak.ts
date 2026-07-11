// Daily play streak, tracked per leaderboard-style identity key (wallet
// address or "guest:<id>") so it works with zero wallet/crypto involvement -
// a pure retention hook for casual/web2 players. Every 3 consecutive
// calendar days played unlocks one free consumable grant; the streak keeps
// counting past that, re-arming every additional 3 days.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const DAYS_KEY = 'streak:days';
const LAST_KEY = 'streak:last';
const CLAIMED_KEY = 'streak:claimed';

export const STREAK_GOAL_DAYS = 3;
export const STREAK_REWARD_ITEM_ID = 'consumable_shield';

const redis = redisCommand;
const memDays = new Map<string, number>();
const memLast = new Map<string, string>();
const memClaimed = new Map<string, number>();

function localDateKey(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Called once per menu visit. Idempotent within a single day - repeated
// calls the same day don't inflate the streak.
export async function recordPlay(key: string): Promise<number> {
  const today = localDateKey(0);
  const yesterday = localDateKey(1);

  if (isKvConfigured()) {
    const last = (await redis(['HGET', LAST_KEY, key])) as string | null;
    if (last === today) {
      const days = (await redis(['HGET', DAYS_KEY, key])) as string | null;
      return days ? parseInt(days, 10) : 1;
    }
    const prevDays = (await redis(['HGET', DAYS_KEY, key])) as string | null;
    const newDays = last === yesterday ? (prevDays ? parseInt(prevDays, 10) : 0) + 1 : 1;
    await redis(['HSET', LAST_KEY, key, today]);
    await redis(['HSET', DAYS_KEY, key, newDays]);
    return newDays;
  }

  const last = memLast.get(key);
  if (last === today) return memDays.get(key) || 1;
  const newDays = last === yesterday ? (memDays.get(key) || 0) + 1 : 1;
  memLast.set(key, today);
  memDays.set(key, newDays);
  return newDays;
}

export async function getStreak(key: string): Promise<{ days: number; claimedAt: number }> {
  if (isKvConfigured()) {
    const days = (await redis(['HGET', DAYS_KEY, key])) as string | null;
    const claimed = (await redis(['HGET', CLAIMED_KEY, key])) as string | null;
    return { days: days ? parseInt(days, 10) : 0, claimedAt: claimed ? parseInt(claimed, 10) : 0 };
  }
  return { days: memDays.get(key) || 0, claimedAt: memClaimed.get(key) || 0 };
}

export async function claimStreak(key: string): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const { days, claimedAt } = await getStreak(key);
  if (days < STREAK_GOAL_DAYS || days - claimedAt < STREAK_GOAL_DAYS) {
    return { ok: false, error: 'not_ready' };
  }
  if (isKvConfigured()) {
    await redis(['HSET', CLAIMED_KEY, key, days]);
  } else {
    memClaimed.set(key, days);
  }
  return { ok: true, days };
}
