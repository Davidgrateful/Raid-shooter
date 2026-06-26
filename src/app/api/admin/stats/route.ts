import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getAllEntries, isPersistent, type BoardEntry } from '@/lib/leaderboard';

// Dev-only player stats, aggregated from the leaderboard. Gated behind
// ADMIN_STATS_TOKEN so it's never public. Note: the board stores ONE entry
// per address (their best run), so these describe best-runs and unique
// score-submitters - not raw session counts or total playtime. For true
// DAU/session/retention numbers we'd need per-run event logging.

function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_STATS_TOKEN;
  if (!expected) {
    return false;
  }
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = bearer || req.nextUrl.searchParams.get('key') || '';
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

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
  if (!process.env.ADMIN_STATS_TOKEN) {
    return NextResponse.json(
      { error: 'ADMIN_STATS_TOKEN is not set. Set it in your env to enable this endpoint.' },
      { status: 503 }
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entries: BoardEntry[] = await getAllEntries();
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
      ? 'Numbers describe best-run-per-player, not raw sessions.'
      : 'WARNING: no persistent store - these reset on redeploy.',

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
  });
}
