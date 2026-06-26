'use client';

import { useEffect, useState } from 'react';

// Visual dev dashboard for /api/admin/stats. The token never ships in the
// bundle - it's typed in (or read from ?key=) and kept in localStorage on
// the viewer's own device only.

interface DailyStat {
  date: string;
  players: number;
  runs: number;
  playtimeSeconds: number;
}
interface Stats {
  persistent: boolean;
  note: string;
  tracking: {
    uniquePlayersAllTime: number;
    runsAllTime: number;
    completedRunsAllTime: number;
    playtimeSecondsAllTime: number;
    activeToday: number;
    active7Days: number;
    runsToday: number;
    playtimeTodaySeconds: number;
    daily: DailyStat[];
  };
  leaderboard: {
    players: { total: number; verified: number; guests: number };
    activity: { lastDay: number; last7Days: number; last30Days: number; newestRunAt: number | null };
    runTimeSeconds: { average: number; median: number; longest: number; combinedBestRuns: number };
    score: { top: number; average: number; median: number };
    topPilots: { pilot: string; count: number }[];
  };
}

function fmtDuration(sec: number): string {
  if (!sec) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}
function fmtDay(d: string): string {
  // YYYYMMDD -> MM/DD
  return `${d.slice(4, 6)}/${d.slice(6, 8)}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-24 shrink-0 truncate text-right text-white/50">{label}</div>
      <div className="h-5 flex-1 overflow-hidden rounded bg-white/[0.04]">
        <div className="h-full rounded bg-cyan-400/70" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 shrink-0 text-white/70 tabular-nums">
        {fmtNum(value)}
        {suffix || ''}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // hydrate token from ?key= or localStorage on first mount
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('key');
    const saved = fromUrl || localStorage.getItem('admin_stats_token') || '';
    if (saved) {
      setToken(saved);
      load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(t: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/stats?key=${encodeURIComponent(t)}`, { cache: 'no-store' });
      if (res.status === 401) throw new Error('Wrong token (401). Check the value matches ADMIN_STATS_TOKEN.');
      if (res.status === 503) throw new Error('ADMIN_STATS_TOKEN is not set on the server (503). Add it in Vercel and redeploy.');
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = (await res.json()) as Stats;
      setStats(data);
      localStorage.setItem('admin_stats_token', t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  const t = stats?.tracking;
  const lb = stats?.leaderboard;
  const maxRuns = t ? Math.max(1, ...t.daily.map((d) => d.runs)) : 1;
  const maxPilot = lb ? Math.max(1, ...lb.topPilots.map((p) => p.count)) : 1;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#080808] text-white">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-bold tracking-wide">RAID SHOOTER — DEV STATS</h1>
        <p className="mt-1 text-sm text-white/40">
          Live numbers from your players. Token stays on this device only.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(token)}
            placeholder="ADMIN_STATS_TOKEN"
            className="flex-1 min-w-[220px] rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          />
          <button
            onClick={() => load(token)}
            disabled={loading || !token}
            className="rounded-md bg-cyan-500/80 px-5 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-40"
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {stats && t && lb && (
          <div className="mt-6 space-y-8">
            {!stats.persistent && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                ⚠️ No persistent store connected — these numbers reset on every redeploy. Wire up KV
                (KV_REST_API_URL / KV_REST_API_TOKEN).
              </div>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-300/80">
                Players &amp; Sessions · everyone
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Unique players" value={fmtNum(t.uniquePlayersAllTime)} sub="all time" />
                <Stat label="Active today" value={fmtNum(t.activeToday)} sub={`${fmtNum(t.runsToday)} runs today`} />
                <Stat label="Active (7d)" value={fmtNum(t.active7Days)} sub="approx, summed daily" />
                <Stat label="Total runs" value={fmtNum(t.runsAllTime)} sub={`${fmtNum(t.completedRunsAllTime)} finished`} />
                <Stat label="Total playtime" value={fmtDuration(t.playtimeSecondsAllTime)} sub="all runs combined" />
                <Stat label="Playtime today" value={fmtDuration(t.playtimeTodaySeconds)} />
              </div>

              <h3 className="mt-5 mb-2 text-xs uppercase tracking-wider text-white/40">Runs per day (last 14)</h3>
              <div className="space-y-1.5">
                {t.daily.map((d) => (
                  <BarRow key={d.date} label={fmtDay(d.date)} value={d.runs} max={maxRuns} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-300/80">
                Leaderboard · score submitters only
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Submitters" value={fmtNum(lb.players.total)} sub={`${lb.players.verified} wallet · ${lb.players.guests} guest`} />
                <Stat label="Top score" value={fmtNum(lb.score.top)} sub={`avg ${fmtNum(lb.score.average)}`} />
                <Stat label="Median run" value={fmtDuration(lb.runTimeSeconds.median)} sub={`longest ${fmtDuration(lb.runTimeSeconds.longest)}`} />
                <Stat label="Active (30d)" value={fmtNum(lb.activity.last30Days)} sub={`${lb.activity.lastDay} today`} />
              </div>

              {lb.topPilots.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-xs uppercase tracking-wider text-white/40">Most-played pilots</h3>
                  <div className="space-y-1.5">
                    {lb.topPilots.slice(0, 10).map((p) => (
                      <BarRow key={p.pilot} label={p.pilot} value={p.count} max={maxPilot} />
                    ))}
                  </div>
                </>
              )}
            </section>

            <p className="pb-8 text-xs text-white/30">
              {stats.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
