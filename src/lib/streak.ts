// Daily play streak, tracked per leaderboard-style identity key (wallet
// address or "guest:<id>") so it works with zero wallet/crypto involvement -
// a pure retention hook for casual/web2 players. Every 3 consecutive
// calendar days played unlocks one free consumable grant; the streak keeps
// counting past that, re-arming every additional 3 days.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const DAYS_KEY = 'streak:days';
const LAST_KEY = 'streak:last';
const CLAIMED_KEY = 'streak:claimed';
const PILOT_KEY = 'streak:pilotclaimed';
const FREEZE_KEY = 'streak:freeze'; // '1' once this streak's single freeze is spent

export const STREAK_GOAL_DAYS = 3;
export const STREAK_REWARD_ITEM_ID = 'consumable_shield';

// 30-day streak board: reaching day 30 grants one fixed pilot to everyone,
// once. A purchasable pilot (not premium/sponsor), so it's a real reward
// without touching the paid tier. Cosmetic only, never affects a run.
export const STREAK_PILOT_GOAL_DAYS = 30;
export const STREAK_PILOT_ITEM_ID = 'pilot_atlasbeam';

const redis = redisCommand;
const memDays = new Map<string, number>();
const memLast = new Map<string, string>();
const memClaimed = new Map<string, number>();
const memPilot = new Map<string, number>();
const memFreeze = new Map<string, boolean>();

function localDateKey(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Called once per menu visit. Idempotent within a single day - repeated
// calls the same day don't inflate the streak.
export async function recordPlay(key: string): Promise<number> {
  const today = localDateKey(0);
  const yesterday = localDateKey(1);
  const dayBefore = localDateKey(2);

  // Streak progression with a ONE-TIME "freeze": exactly one missed day per
  // streak is forgiven, so real life doesn't nuke a month-long run - but it is
  // NOT an every-other-day loophole. Returns the new day count and the new
  // freeze-used flag from the previous state.
  //   last === yesterday        -> normal continue (freeze untouched)
  //   last === dayBefore & fresh -> forgive the gap, consume the one freeze
  //   otherwise                 -> reset streak to 1 and refresh the freeze
  function progress(last: string | null, prevDays: number, freezeUsed: boolean) {
    if (last === yesterday) return { days: prevDays + 1, freeze: freezeUsed };
    if (last === dayBefore && !freezeUsed) return { days: prevDays + 1, freeze: true };
    return { days: 1, freeze: false };
  }

  if (isKvConfigured()) {
    const last = (await redis(['HGET', LAST_KEY, key])) as string | null;
    if (last === today) {
      const days = (await redis(['HGET', DAYS_KEY, key])) as string | null;
      return days ? parseInt(days, 10) : 1;
    }
    const prevDays = parseInt(((await redis(['HGET', DAYS_KEY, key])) as string | null) || '0', 10);
    const freezeUsed = ((await redis(['HGET', FREEZE_KEY, key])) as string | null) === '1';
    const next = progress(last, prevDays, freezeUsed);
    await redis(['HSET', LAST_KEY, key, today]);
    await redis(['HSET', DAYS_KEY, key, next.days]);
    await redis(['HSET', FREEZE_KEY, key, next.freeze ? '1' : '0']);
    return next.days;
  }

  const last = memLast.get(key) || null;
  if (last === today) return memDays.get(key) || 1;
  const next = progress(last, memDays.get(key) || 0, memFreeze.get(key) === true);
  memLast.set(key, today);
  memDays.set(key, next.days);
  memFreeze.set(key, next.freeze);
  return next.days;
}

export async function getStreak(key: string): Promise<{ days: number; claimedAt: number; pilotClaimed: boolean }> {
  if (isKvConfigured()) {
    const days = (await redis(['HGET', DAYS_KEY, key])) as string | null;
    const claimed = (await redis(['HGET', CLAIMED_KEY, key])) as string | null;
    const pilot = (await redis(['HGET', PILOT_KEY, key])) as string | null;
    return {
      days: days ? parseInt(days, 10) : 0,
      claimedAt: claimed ? parseInt(claimed, 10) : 0,
      pilotClaimed: !!pilot,
    };
  }
  return { days: memDays.get(key) || 0, claimedAt: memClaimed.get(key) || 0, pilotClaimed: memPilot.has(key) };
}

// Claim the Day-30 pilot. One-time per identity: succeeds only once the
// streak has reached 30 days and the pilot hasn't already been granted.
export async function claimStreakPilot(
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { days, pilotClaimed } = await getStreak(key);
  if (pilotClaimed) return { ok: false, error: 'already_claimed' };
  if (days < STREAK_PILOT_GOAL_DAYS) return { ok: false, error: 'not_ready' };
  if (isKvConfigured()) {
    await redis(['HSET', PILOT_KEY, key, days]);
  } else {
    memPilot.set(key, days);
  }
  return { ok: true };
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
