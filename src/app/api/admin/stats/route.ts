import { NextRequest, NextResponse } from 'next/server';
import { getAllEntries, isPersistent, type BoardEntry } from '@/lib/leaderboard';
import { getTrackingStats, getLoadoutStats, getMarketStats, getRecentBuys } from '@/lib/stats';
import { marketEnabled, baseNetwork } from '@/lib/market';
import { adminGate } from '@/lib/admin-auth';

// Dev-only stats dashboard data, gated behind ADMIN_STATS_TOKEN. Combines
// run/session tracking (every player), market revenue, loadout usage, the
// leaderboard, and live market config - everything about the game in one
// place, with no secrets ever returned.

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  const [entries, tracking, market, recentBuys] = await Promise.all([
    getAllEntries() as Promise<BoardEntry[]>,
    getTrackingStats(14),
    getMarketStats(14),
    getRecentBuys(20),
  ]);
  // loadout rates are relative to total runs, so compute after tracking
  const loadout = await getLoadoutStats(tracking.runsAllTime);
  const now = Date.now();
  const DAY = 86_400_000;

  const times = entries.map((e) => e.time || 0).filter((t) => t > 0);
  const scores = entries.map((e) => e.score || 0);

  // pilot popularity (by best-run entry)
  const pilotCounts: Record<string, number> = {};
  for (const e of entries) {
    const p = e.pilot || 'unknown';
    pilotCounts[p] = (pilotCounts[p] || 0) + 1;
  }
  const topPilots = Object.entries(pilotCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([pilot, count]) => ({ pilot, count }));

  const within = (ms: number) => entries.filter((e) => e.at && now - e.at <= ms).length;

  const totalSeconds = times.reduce((a, b) => a + b, 0);

  return NextResponse.json({
    persistent: isPersistent(),
    // if false, you're reading per-instance memory and numbers reset on
    // every redeploy/cold start - wire up KV for stable stats
    note: isPersistent()
      ? 'tracking = every player/run; leaderboard = best-run-per-submitter.'
      : 'WARNING: no persistent store - these reset on redeploy.',

    // counts EVERY player and run (incl. guests who never submit a score)
    tracking,

    // revenue + conversion, recorded only from server-verified payments
    market: {
      ...market,
      // share of unique players who have ever paid
      conversionPct:
        tracking.uniquePlayersAllTime > 0
          ? Math.round((market.uniqueBuyers / tracking.uniquePlayersAllTime) * 1000) / 10
          : 0,
      revenuePerBuyerUsd:
        market.uniqueBuyers > 0
          ? Math.round((market.revenueUsdAllTime / market.uniqueBuyers) * 100) / 100
          : 0,
      recentBuys,
    },

    // which pilots/drones players actually run with, across every run
    loadout,

    // live storefront config (no secrets) so you can see at a glance
    // whether payments are actually live
    config: {
      paymentsEnabled: marketEnabled,
      network: baseNetwork,
      treasurySet: !!(process.env.NEXT_PUBLIC_BASE_TREASURY || '').trim(),
      customRpc: !!process.env.BASE_RPC_URL,
      walletConnectConfigured: !!process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
      sessionSecretSet: !!process.env.SESSION_SECRET,
    },

    // derived from the leaderboard: best run per score-submitter only
    leaderboard: {
      players: {
        total: entries.length,
        verified: entries.filter((e) => e.verified).length,
        guests: entries.filter((e) => !e.verified).length,
      },
      activity: {
        lastDay: within(DAY),
        last7Days: within(7 * DAY),
        last30Days: within(30 * DAY),
        newestRunAt: entries.reduce((m, e) => Math.max(m, e.at || 0), 0) || null,
      },
      runTimeSeconds: {
        // per best-run; not lifetime playtime
        average: avg(times),
        median: median(times),
        longest: times.length ? Math.max(...times) : 0,
        combinedBestRuns: totalSeconds,
      },
      score: {
        top: scores.length ? Math.max(...scores) : 0,
        average: avg(scores),
        median: median(scores),
      },
      topPilots,
      // top 25 ranked players so the team can see the live board in console
      top: [...entries]
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map((e) => ({
          name: e.name || null,
          address: e.address,
          score: e.score,
          level: e.level,
          kills: e.kills,
          pilot: e.pilot,
          verified: !!e.verified,
          at: e.at || null,
        })),
    },
  });
}
