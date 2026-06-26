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
  market: {
    revenueUsdAllTime: number;
    purchasesAllTime: number;
    uniqueBuyers: number;
    revenueTodayUsd: number;
    purchasesToday: number;
    conversionPct: number;
    revenuePerBuyerUsd: number;
    topItems: { id: string; units: number; revenueUsd: number }[];
    dailyRevenueUsd: { date: string; revenueUsd: number; purchases: number }[];
  };
  loadout: {
    pilots: { id: string; runs: number }[];
    drones: { id: string; runs: number }[];
    runsWithDrone: number;
    droneEquipRatePct: number;
  };
  config: {
    paymentsEnabled: boolean;
    network: string;
    treasurySet: boolean;
    customRpc: boolean;
    walletConnectConfigured: boolean;
    sessionSecretSet: boolean;
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
function fmtUsd(n: number): string {
  return `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function BarRow({ label, value, max, prefix, suffix }: { label: string; value: number; max: number; prefix?: string; suffix?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-24 shrink-0 truncate text-right text-white/50">{label}</div>
      <div className="h-5 flex-1 overflow-hidden rounded bg-white/[0.04]">
        <div className="h-full rounded bg-cyan-400/70" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 shrink-0 text-white/70 tabular-nums">
        {prefix || ''}
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
  const mk = stats?.market;
  const lo = stats?.loadout;
  const maxRuns = t ? Math.max(1, ...t.daily.map((d) => d.runs)) : 1;
  const maxPilot = lb ? Math.max(1, ...lb.topPilots.map((p) => p.count)) : 1;
  const maxRev = mk ? Math.max(1, ...mk.dailyRevenueUsd.map((d) => d.revenueUsd)) : 1;
  const maxItemRev = mk ? Math.max(1, ...mk.topItems.map((i) => i.revenueUsd)) : 1;
  const maxPilotRuns = lo ? Math.max(1, ...lo.pilots.map((p) => p.runs)) : 1;
  const maxDroneRuns = lo ? Math.max(1, ...lo.drones.map((d) => d.runs)) : 1;

  return <Dashboard {...{ token, setToken, stats, error, loading, load, t, lb, mk, lo, maxRuns, maxPilot, maxRev, maxItemRev, maxPilotRuns, maxDroneRuns }} />;
}

// ---- admin write actions (player lookup / grant / reset) ----
function AdminActions({ token }: { token: string }) {
  const [lookupId, setLookupId] = useState('');
  const [lookup, setLookup] = useState<unknown>(null);
  const [grantAddr, setGrantAddr] = useState('');
  const [grantItem, setGrantItem] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function callPlayer() {
    setBusy(true);
    setMsg('');
    setLookup(null);
    try {
      const res = await fetch(`/api/admin/player?id=${encodeURIComponent(lookupId.trim())}&key=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setLookup(data);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function callGrant() {
    if (!confirm(`Grant "${grantItem}" to ${grantAddr}?`)) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/grant?key=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: grantAddr.trim(), itemId: grantItem.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`✓ Granted ${data.granted} to ${data.address}. They now own ${data.profile.items.length} item(s).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Grant failed.');
    } finally {
      setBusy(false);
    }
  }

  async function callReset() {
    const phrase = prompt('This wipes the ENTIRE leaderboard and cannot be undone.\nType RESET to confirm:');
    if (phrase !== 'RESET') {
      setMsg('Reset cancelled.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/leaderboard/reset?key=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`✓ Leaderboard reset. Removed ${data.removed} entries. Reload to refresh stats.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60';

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-300/80">Admin actions</h2>
      <div className="space-y-5">
        {/* player lookup */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/40">Diagnose a player&apos;s purchases</div>
          <div className="flex flex-wrap gap-2">
            <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="0x… wallet or guest:id" className={`flex-1 min-w-[240px] ${inputCls}`} />
            <button onClick={callPlayer} disabled={busy || !lookupId} className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40">Look up</button>
          </div>
          {lookup != null && (
            <pre className="mt-3 max-h-72 overflow-auto rounded bg-black/40 p-3 text-xs text-white/70">{JSON.stringify(lookup, null, 2)}</pre>
          )}
        </div>

        {/* grant */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/40">Grant / comp an item to a wallet</div>
          <div className="flex flex-wrap gap-2">
            <input value={grantAddr} onChange={(e) => setGrantAddr(e.target.value)} placeholder="0x… wallet address" className={`flex-1 min-w-[240px] ${inputCls}`} />
            <input value={grantItem} onChange={(e) => setGrantItem(e.target.value)} placeholder="itemId e.g. drone_voltmite" className={`flex-1 min-w-[200px] ${inputCls}`} />
            <button onClick={callGrant} disabled={busy || !grantAddr || !grantItem} className="rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40">Grant</button>
          </div>
        </div>

        {/* reset */}
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-red-300/70">Danger zone</div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={callReset} disabled={busy} className="rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-40">Reset leaderboard</button>
            <span className="text-xs text-white/40">Wipes all scores. Asks for a typed confirmation.</span>
          </div>
        </div>

        {msg && <div className="rounded-md border border-white/15 bg-white/[0.05] p-3 text-sm text-white/80">{msg}</div>}
      </div>
    </section>
  );
}

interface DashboardProps {
  token: string;
  setToken: (v: string) => void;
  stats: Stats | null;
  error: string;
  loading: boolean;
  load: (t: string) => void;
  t?: Stats['tracking'];
  lb?: Stats['leaderboard'];
  mk?: Stats['market'];
  lo?: Stats['loadout'];
  maxRuns: number;
  maxPilot: number;
  maxRev: number;
  maxItemRev: number;
  maxPilotRuns: number;
  maxDroneRuns: number;
}

function ConfigPill({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const color = ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : warn ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : 'border-white/15 bg-white/[0.04] text-white/50';
  return <span className={`rounded-full border px-3 py-1 text-xs ${color}`}>{ok ? '● ' : '○ '}{label}</span>;
}

function Dashboard(p: DashboardProps) {
  const { token, setToken, stats, error, loading, load, t, lb, mk, lo } = p;
  const { maxRuns, maxPilot, maxRev, maxItemRev, maxPilotRuns, maxDroneRuns } = p;

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

        {stats && t && lb && mk && lo && (
          <div className="mt-6 space-y-8">
            {!stats.persistent && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                ⚠️ No persistent store connected — these numbers reset on every redeploy. Wire up KV
                (KV_REST_API_URL / KV_REST_API_TOKEN).
              </div>
            )}

            {/* live storefront / config conditions */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-300/80">
                Game &amp; Market conditions
              </h2>
              <div className="flex flex-wrap gap-2">
                <ConfigPill ok={stats.config.paymentsEnabled} warn={!stats.config.paymentsEnabled} label={stats.config.paymentsEnabled ? 'Payments LIVE' : 'Payments OFF (no treasury)'} />
                <ConfigPill ok={stats.config.network === 'base'} warn={stats.config.network !== 'base'} label={`Network: ${stats.config.network}${stats.config.network === 'base' ? '' : ' (testnet)'}`} />
                <ConfigPill ok={stats.config.treasurySet} label="Treasury set" />
                <ConfigPill ok={stats.persistent} warn={!stats.persistent} label={stats.persistent ? 'KV persistent' : 'KV OFF (data resets!)'} />
                <ConfigPill ok={stats.config.sessionSecretSet} warn={!stats.config.sessionSecretSet} label="Session secret" />
                <ConfigPill ok={stats.config.walletConnectConfigured} label="WalletConnect" />
                <ConfigPill ok={stats.config.customRpc} label="Custom RPC" />
              </div>
            </section>

            {/* revenue & market */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-300/80">
                Revenue &amp; Market
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Revenue" value={fmtUsd(mk.revenueUsdAllTime)} sub={`${fmtUsd(mk.revenueTodayUsd)} today`} />
                <Stat label="Purchases" value={fmtNum(mk.purchasesAllTime)} sub={`${fmtNum(mk.purchasesToday)} today`} />
                <Stat label="Paying players" value={fmtNum(mk.uniqueBuyers)} sub={`${fmtUsd(mk.revenuePerBuyerUsd)} / buyer`} />
                <Stat label="Conversion" value={`${mk.conversionPct}%`} sub="of all players" />
              </div>

              <h3 className="mt-5 mb-2 text-xs uppercase tracking-wider text-white/40">Revenue per day (last 14)</h3>
              <div className="space-y-1.5">
                {mk.dailyRevenueUsd.map((d) => (
                  <BarRow key={d.date} label={fmtDay(d.date)} value={d.revenueUsd} max={maxRev} prefix="$" />
                ))}
              </div>

              {mk.topItems.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-xs uppercase tracking-wider text-white/40">Top sellers (by revenue)</h3>
                  <div className="space-y-1.5">
                    {mk.topItems.slice(0, 12).map((it) => (
                      <BarRow key={it.id} label={it.id} value={it.revenueUsd} max={maxItemRev} prefix="$" suffix={` · ${it.units}u`} />
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* loadout usage */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-300/80">
                Loadout usage · every run
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Drone equip rate" value={`${lo.droneEquipRatePct}%`} sub={`${fmtNum(lo.runsWithDrone)} runs with a drone`} />
                <Stat label="Pilots used" value={fmtNum(lo.pilots.length)} />
                <Stat label="Drones used" value={fmtNum(lo.drones.filter((d) => d.id !== 'none').length)} />
              </div>

              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {lo.pilots.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs uppercase tracking-wider text-white/40">Pilot picks</h3>
                    <div className="space-y-1.5">
                      {lo.pilots.slice(0, 10).map((pl) => (
                        <BarRow key={pl.id} label={pl.id} value={pl.runs} max={maxPilotRuns} />
                      ))}
                    </div>
                  </div>
                )}
                {lo.drones.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs uppercase tracking-wider text-white/40">Drone picks (incl. none)</h3>
                    <div className="space-y-1.5">
                      {lo.drones.slice(0, 10).map((dr) => (
                        <BarRow key={dr.id} label={dr.id} value={dr.runs} max={maxDroneRuns} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

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

            <AdminActions token={token} />

            <p className="pb-8 text-xs text-white/30">
              {stats.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
