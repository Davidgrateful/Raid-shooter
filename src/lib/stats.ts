// Lightweight run/session tracking. Unlike the leaderboard (which keeps
// only each player's best run), this counts EVERY run and EVERY player -
// including guests who never submit a score - so we get true unique-player,
// session, playtime and daily-active numbers. Redis when configured, with
// an in-memory mirror so local dev still works.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const PLAYERS_ALL = 'stats:players:all';
const RUNS_TOTAL = 'stats:runs:total';
const SESSIONS_TOTAL = 'stats:sessions:total'; // completed runs (run_end)
const PLAYTIME_TOTAL = 'stats:playtime:total'; // seconds
const DAY_TTL = 60 * 60 * 24 * 120; // keep daily keys ~120 days

// keys partitioned by UTC day so daily-active / charts are cheap to read
function dayKey(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

function recentDayKeys(n: number): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(now - i * 86_400_000)));
  }
  return keys;
}

// ---- in-memory fallback (per instance; ephemeral on serverless) ----
const mem = {
  playersAll: new Set<string>(),
  runsTotal: 0,
  sessionsTotal: 0,
  playtimeTotal: 0,
  dayPlayers: new Map<string, Set<string>>(),
  dayRuns: new Map<string, number>(),
  dayPlaytime: new Map<string, number>(),
};

export async function trackRunStart(playerId: string): Promise<void> {
  const day = dayKey(new Date());
  if (isKvConfigured()) {
    await Promise.all([
      redisCommand(['SADD', PLAYERS_ALL, playerId]),
      redisCommand(['SADD', `stats:players:${day}`, playerId]),
      redisCommand(['EXPIRE', `stats:players:${day}`, DAY_TTL]),
      redisCommand(['INCR', RUNS_TOTAL]),
      redisCommand(['INCR', `stats:runs:${day}`]),
      redisCommand(['EXPIRE', `stats:runs:${day}`, DAY_TTL]),
    ]);
    return;
  }
  mem.playersAll.add(playerId);
  if (!mem.dayPlayers.has(day)) mem.dayPlayers.set(day, new Set());
  mem.dayPlayers.get(day)!.add(playerId);
  mem.runsTotal += 1;
  mem.dayRuns.set(day, (mem.dayRuns.get(day) || 0) + 1);
}

export async function trackRunEnd(playerId: string, durationSec: number): Promise<void> {
  const dur = Math.max(0, Math.min(86_400, Math.floor(durationSec || 0)));
  const day = dayKey(new Date());
  if (isKvConfigured()) {
    await Promise.all([
      redisCommand(['INCR', SESSIONS_TOTAL]),
      redisCommand(['INCRBY', PLAYTIME_TOTAL, dur]),
      redisCommand(['INCRBY', `stats:playtime:${day}`, dur]),
      redisCommand(['EXPIRE', `stats:playtime:${day}`, DAY_TTL]),
      // count the player even if their run_start was missed
      redisCommand(['SADD', PLAYERS_ALL, playerId]),
    ]);
    return;
  }
  mem.sessionsTotal += 1;
  mem.playtimeTotal += dur;
  mem.dayPlaytime.set(day, (mem.dayPlaytime.get(day) || 0) + dur);
  mem.playersAll.add(playerId);
}

export interface DailyStat {
  date: string; // YYYYMMDD (UTC)
  players: number;
  runs: number;
  playtimeSeconds: number;
}

export interface TrackingStats {
  uniquePlayersAllTime: number;
  runsAllTime: number;
  completedRunsAllTime: number;
  playtimeSecondsAllTime: number;
  activeToday: number;
  active7Days: number;
  runsToday: number;
  playtimeTodaySeconds: number;
  daily: DailyStat[];
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function getTrackingStats(days = 14): Promise<TrackingStats> {
  const dayKeys = recentDayKeys(days);
  const today = dayKeys[dayKeys.length - 1];

  if (isKvConfigured()) {
    const [uniqueAll, runsAll, sessionsAll, playtimeAll] = await Promise.all([
      redisCommand(['SCARD', PLAYERS_ALL]),
      redisCommand(['GET', RUNS_TOTAL]),
      redisCommand(['GET', SESSIONS_TOTAL]),
      redisCommand(['GET', PLAYTIME_TOTAL]),
    ]);

    // counters via MGET (two calls), unique daily players via SCARD each
    const runsByDay = (await redisCommand([
      'MGET',
      ...dayKeys.map((d) => `stats:runs:${d}`),
    ])) as (string | null)[];
    const playtimeByDay = (await redisCommand([
      'MGET',
      ...dayKeys.map((d) => `stats:playtime:${d}`),
    ])) as (string | null)[];
    const playersByDay = (await Promise.all(
      dayKeys.map((d) => redisCommand(['SCARD', `stats:players:${d}`]))
    )) as number[];

    const daily: DailyStat[] = dayKeys.map((date, i) => ({
      date,
      players: num(playersByDay[i]),
      runs: num(runsByDay[i]),
      playtimeSeconds: num(playtimeByDay[i]),
    }));

    const last7 = daily.slice(-7).reduce((s, d) => s + d.players, 0);
    const todayStat = daily[daily.length - 1];

    return {
      uniquePlayersAllTime: num(uniqueAll),
      runsAllTime: num(runsAll),
      completedRunsAllTime: num(sessionsAll),
      playtimeSecondsAllTime: num(playtimeAll),
      activeToday: todayStat.players,
      // approx (sum of daily uniques; a player active 2 days counts twice)
      active7Days: last7,
      runsToday: todayStat.runs,
      playtimeTodaySeconds: todayStat.playtimeSeconds,
      daily,
    };
  }

  // in-memory
  const daily: DailyStat[] = dayKeys.map((date) => ({
    date,
    players: mem.dayPlayers.get(date)?.size || 0,
    runs: mem.dayRuns.get(date) || 0,
    playtimeSeconds: mem.dayPlaytime.get(date) || 0,
  }));
  return {
    uniquePlayersAllTime: mem.playersAll.size,
    runsAllTime: mem.runsTotal,
    completedRunsAllTime: mem.sessionsTotal,
    playtimeSecondsAllTime: mem.playtimeTotal,
    activeToday: mem.dayPlayers.get(today)?.size || 0,
    active7Days: daily.slice(-7).reduce((s, d) => s + d.players, 0),
    runsToday: mem.dayRuns.get(today) || 0,
    playtimeTodaySeconds: mem.dayPlaytime.get(today) || 0,
    daily,
  };
}
