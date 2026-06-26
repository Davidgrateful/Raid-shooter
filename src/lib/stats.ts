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

// loadout (which pilot/drone players actually run with, across every run)
const PILOTS_HASH = 'stats:pilots';
const DRONES_HASH = 'stats:drones';
const RUNS_WITH_DRONE = 'stats:runs:withdrone';

// market / revenue
const PURCHASES_TOTAL = 'stats:purchases:total';
const REVENUE_TOTAL = 'stats:revenue:total'; // USD
const BUYERS_ALL = 'stats:buyers:all';
const ITEM_UNITS = 'stats:items:units'; // hash itemId -> units sold
const ITEM_REVENUE = 'stats:items:revenue'; // hash itemId -> USD

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
  pilots: new Map<string, number>(),
  drones: new Map<string, number>(),
  runsWithDrone: 0,
  purchasesTotal: 0,
  revenueTotal: 0,
  buyersAll: new Set<string>(),
  itemUnits: new Map<string, number>(),
  itemRevenue: new Map<string, number>(),
  dayPurchases: new Map<string, number>(),
  dayRevenue: new Map<string, number>(),
};

// sanitize ids before they become Redis hash fields / set members
function cleanId(s: string | undefined, fallback: string): string {
  const v = (s || '').toString().trim().slice(0, 48);
  return v.length ? v : fallback;
}

export async function trackRunStart(
  playerId: string,
  loadout?: { pilot?: string; drone?: string }
): Promise<void> {
  const day = dayKey(new Date());
  const pilot = cleanId(loadout?.pilot, 'unknown');
  // empty drone means "no drone equipped" - tracked as a NONE bucket so we
  // can show the equip rate honestly
  const drone = loadout?.drone ? cleanId(loadout.drone, 'unknown') : 'none';

  if (isKvConfigured()) {
    const ops: Promise<unknown>[] = [
      redisCommand(['SADD', PLAYERS_ALL, playerId]),
      redisCommand(['SADD', `stats:players:${day}`, playerId]),
      redisCommand(['EXPIRE', `stats:players:${day}`, DAY_TTL]),
      redisCommand(['INCR', RUNS_TOTAL]),
      redisCommand(['INCR', `stats:runs:${day}`]),
      redisCommand(['EXPIRE', `stats:runs:${day}`, DAY_TTL]),
      redisCommand(['HINCRBY', PILOTS_HASH, pilot, 1]),
      redisCommand(['HINCRBY', DRONES_HASH, drone, 1]),
    ];
    if (drone !== 'none') {
      ops.push(redisCommand(['INCR', RUNS_WITH_DRONE]));
    }
    await Promise.all(ops);
    return;
  }
  mem.playersAll.add(playerId);
  if (!mem.dayPlayers.has(day)) mem.dayPlayers.set(day, new Set());
  mem.dayPlayers.get(day)!.add(playerId);
  mem.runsTotal += 1;
  mem.dayRuns.set(day, (mem.dayRuns.get(day) || 0) + 1);
  mem.pilots.set(pilot, (mem.pilots.get(pilot) || 0) + 1);
  mem.drones.set(drone, (mem.drones.get(drone) || 0) + 1);
  if (drone !== 'none') mem.runsWithDrone += 1;
}

// Recorded only after a payment is server-verified, so revenue can't be
// faked by the client. priceUsd comes from the catalog, not the request.
export async function trackPurchase(
  playerId: string,
  item: { id: string; priceUsd: number }
): Promise<void> {
  const day = dayKey(new Date());
  const id = cleanId(item.id, 'unknown');
  const usd = Math.max(0, Number(item.priceUsd) || 0);
  if (isKvConfigured()) {
    await Promise.all([
      redisCommand(['INCR', PURCHASES_TOTAL]),
      redisCommand(['INCRBYFLOAT', REVENUE_TOTAL, usd]),
      redisCommand(['SADD', BUYERS_ALL, playerId]),
      redisCommand(['HINCRBY', ITEM_UNITS, id, 1]),
      redisCommand(['HINCRBYFLOAT', ITEM_REVENUE, id, usd]),
      redisCommand(['INCR', `stats:purchases:${day}`]),
      redisCommand(['EXPIRE', `stats:purchases:${day}`, DAY_TTL]),
      redisCommand(['INCRBYFLOAT', `stats:revenue:${day}`, usd]),
      redisCommand(['EXPIRE', `stats:revenue:${day}`, DAY_TTL]),
    ]);
    return;
  }
  mem.purchasesTotal += 1;
  mem.revenueTotal += usd;
  mem.buyersAll.add(playerId);
  mem.itemUnits.set(id, (mem.itemUnits.get(id) || 0) + 1);
  mem.itemRevenue.set(id, (mem.itemRevenue.get(id) || 0) + usd);
  mem.dayPurchases.set(day, (mem.dayPurchases.get(day) || 0) + 1);
  mem.dayRevenue.set(day, (mem.dayRevenue.get(day) || 0) + usd);
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

function flt(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

// Upstash REST returns HGETALL as a flat [field, value, field, value, ...]
function hashToPairs(v: unknown): [string, string][] {
  const out: [string, string][] = [];
  if (Array.isArray(v)) {
    for (let i = 0; i + 1 < v.length; i += 2) {
      out.push([String(v[i]), String(v[i + 1])]);
    }
  } else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out.push([k, String(val)]);
    }
  }
  return out;
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

export interface LoadoutStats {
  pilots: { id: string; runs: number }[];
  drones: { id: string; runs: number }[];
  runsWithDrone: number;
  droneEquipRatePct: number; // share of runs that had a drone equipped
}

export async function getLoadoutStats(runsAllTime: number): Promise<LoadoutStats> {
  let pilotPairs: [string, string][];
  let dronePairs: [string, string][];
  let withDrone: number;

  if (isKvConfigured()) {
    const [p, d, wd] = await Promise.all([
      redisCommand(['HGETALL', PILOTS_HASH]),
      redisCommand(['HGETALL', DRONES_HASH]),
      redisCommand(['GET', RUNS_WITH_DRONE]),
    ]);
    pilotPairs = hashToPairs(p);
    dronePairs = hashToPairs(d);
    withDrone = num(wd);
  } else {
    pilotPairs = [...mem.pilots.entries()].map(([k, v]) => [k, String(v)]);
    dronePairs = [...mem.drones.entries()].map(([k, v]) => [k, String(v)]);
    withDrone = mem.runsWithDrone;
  }

  const pilots = pilotPairs
    .map(([id, v]) => ({ id, runs: num(v) }))
    .sort((a, b) => b.runs - a.runs);
  const drones = dronePairs
    .map(([id, v]) => ({ id, runs: num(v) }))
    .sort((a, b) => b.runs - a.runs);

  return {
    pilots,
    drones,
    runsWithDrone: withDrone,
    droneEquipRatePct: runsAllTime > 0 ? Math.round((withDrone / runsAllTime) * 100) : 0,
  };
}

export interface MarketStats {
  revenueUsdAllTime: number;
  purchasesAllTime: number;
  uniqueBuyers: number;
  revenueTodayUsd: number;
  purchasesToday: number;
  topItems: { id: string; units: number; revenueUsd: number }[];
  dailyRevenueUsd: { date: string; revenueUsd: number; purchases: number }[];
}

export async function getMarketStats(days = 14): Promise<MarketStats> {
  const dayKeys = recentDayKeys(days);

  let revenueTotal: number, purchasesTotal: number, buyers: number;
  let unitPairs: [string, string][], revPairs: [string, string][];
  let dailyRevRaw: (string | null)[], dailyPurRaw: (string | null)[];

  if (isKvConfigured()) {
    const [rev, pur, buy, units, itemRev] = await Promise.all([
      redisCommand(['GET', REVENUE_TOTAL]),
      redisCommand(['GET', PURCHASES_TOTAL]),
      redisCommand(['SCARD', BUYERS_ALL]),
      redisCommand(['HGETALL', ITEM_UNITS]),
      redisCommand(['HGETALL', ITEM_REVENUE]),
    ]);
    revenueTotal = flt(rev);
    purchasesTotal = num(pur);
    buyers = num(buy);
    unitPairs = hashToPairs(units);
    revPairs = hashToPairs(itemRev);
    dailyRevRaw = (await redisCommand([
      'MGET',
      ...dayKeys.map((d) => `stats:revenue:${d}`),
    ])) as (string | null)[];
    dailyPurRaw = (await redisCommand([
      'MGET',
      ...dayKeys.map((d) => `stats:purchases:${d}`),
    ])) as (string | null)[];
  } else {
    revenueTotal = mem.revenueTotal;
    purchasesTotal = mem.purchasesTotal;
    buyers = mem.buyersAll.size;
    unitPairs = [...mem.itemUnits.entries()].map(([k, v]) => [k, String(v)]);
    revPairs = [...mem.itemRevenue.entries()].map(([k, v]) => [k, String(v)]);
    dailyRevRaw = dayKeys.map((d) => String(mem.dayRevenue.get(d) || 0));
    dailyPurRaw = dayKeys.map((d) => String(mem.dayPurchases.get(d) || 0));
  }

  const revById = new Map(revPairs.map(([id, v]) => [id, flt(v)]));
  const topItems = unitPairs
    .map(([id, v]) => ({ id, units: num(v), revenueUsd: round2(revById.get(id) || 0) }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd);

  const dailyRevenueUsd = dayKeys.map((date, i) => ({
    date,
    revenueUsd: round2(flt(dailyRevRaw[i])),
    purchases: num(dailyPurRaw[i]),
  }));

  const todayRow = dailyRevenueUsd[dailyRevenueUsd.length - 1];

  return {
    revenueUsdAllTime: round2(revenueTotal),
    purchasesAllTime: purchasesTotal,
    uniqueBuyers: buyers,
    revenueTodayUsd: todayRow.revenueUsd,
    purchasesToday: todayRow.purchases,
    topItems,
    dailyRevenueUsd,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
