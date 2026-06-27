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
    recentBuys: { itemId: string; priceUsd: number; buyer: string; at: number }[];
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
    top: { name: string | null; address: string; score: number; level: number; kills: number; pilot: string; verified: boolean; at: number | null }[];
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
function fmtAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

// ---- team players table with moderation (derank / ban) ----
interface PlayerRow {
  id: string;
  name: string | null;
  wallet: string | null;
  isWallet: boolean;
  games: number;
  spendUsd: number;
  lastSeen: number | null;
  banned: boolean;
}

// short, stable handle for the wallet/guest id (the technical key)
function shortId(p: PlayerRow): string {
  if (p.wallet) return `${p.wallet.slice(0, 6)}…${p.wallet.slice(-4)}`;
  return p.id.startsWith('guest:') ? `guest ${p.id.slice(6, 12)}` : p.id;
}

function PlayersTable({ token }: { token: string }) {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function loadPlayers() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/players?key=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setPlayers(data.players);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load players.');
    } finally {
      setBusy(false);
    }
  }

  async function moderate(p: PlayerRow, action: 'derank' | 'ban' | 'unban') {
    const verb = action === 'ban' ? 'BAN' : action === 'unban' ? 'unban' : 'derank';
    if (action !== 'unban' && !confirm(`${verb} ${shortId(p)}? ${action === 'ban' ? 'They will be removed AND blocked from re-ranking.' : 'Removes their score from the board.'}`)) return;
    setBusy(true);
    setNote('');
    try {
      const res = await fetch(`/api/admin/derank?key=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setNote(`✓ ${action} applied to ${shortId(p)}.`);
      await loadPlayers();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300/80">Players</h2>
        <button onClick={loadPlayers} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">
          {players ? 'Refresh' : 'Load players'}
        </button>
      </div>
      {err && <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-300">{err}</div>}
      {note && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{note}</div>}
      {players && (
        players.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No players tracked yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2">Call sign</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">Spent</th>
                  <th className="px-3 py-2 text-right">Last seen</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {players.map((p) => (
                  <tr key={p.id} className={p.banned ? 'bg-red-500/[0.06]' : ''}>
                    <td className="px-3 py-2">
                      {p.name ? (
                        <span className="font-medium text-white/90">{p.name}</span>
                      ) : (
                        <span className="italic text-amber-300/70">unnamed</span>
                      )}
                      {p.banned && <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">BANNED</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-white/50">{shortId(p)}</span>
                      {p.isWallet ? <span className="ml-2 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-300">WALLET</span> : <span className="ml-2 text-[10px] text-white/30">guest</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/70">{fmtNum(p.games)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-300/90">{fmtUsd(p.spendUsd)}</td>
                    <td className="px-3 py-2 text-right text-white/40">{p.lastSeen ? fmtAgo(p.lastSeen) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => moderate(p, 'derank')} disabled={busy} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20 disabled:opacity-40">Derank</button>
                        {p.banned ? (
                          <button onClick={() => moderate(p, 'unban')} disabled={busy} className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40">Unban</button>
                        ) : (
                          <button onClick={() => moderate(p, 'ban')} disabled={busy} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300 hover:bg-red-500/25 disabled:opacity-40">Ban</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}

// ---- sponsor / partnership manager (self-serve) ----
const SLOTS = ['loading', 'menu', 'partners'] as const;
type Slot = (typeof SLOTS)[number];
interface Sponsor {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  accentColor?: string;
  socials?: { twitter?: string; telegram?: string; website?: string };
  slots: Slot[];
  active: boolean;
  order: number;
}
const emptySponsor = (): Sponsor => ({ id: '', name: '', tagline: '', logoUrl: '', accentColor: '', socials: {}, slots: ['loading', 'partners'], active: true, order: 0 });

interface AdMetric { impressions: number; clicks: number; ctrPct: number }

function SponsorsManager({ token }: { token: string }) {
  const [list, setList] = useState<Sponsor[] | null>(null);
  const [metrics, setMetrics] = useState<Record<string, AdMetric>>({});
  const [form, setForm] = useState<Sponsor | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputCls = 'rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60';

  async function load() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/sponsors?key=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setList(data.sponsors);
      setMetrics(data.metrics || {});
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!form) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/sponsors?key=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`✓ Saved ${data.sponsor.name}.`);
      setForm(null);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  }

  async function remove(s: Sponsor) {
    if (!confirm(`Delete partner "${s.name}"?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/sponsors?key=${encodeURIComponent(token)}&id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Delete failed.'); }
    finally { setBusy(false); }
  }

  function toggleSlot(slot: Slot) {
    if (!form) return;
    const has = form.slots.includes(slot);
    setForm({ ...form, slots: has ? form.slots.filter((x) => x !== slot) : [...form.slots, slot] });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300/80">Sponsors &amp; Partners</h2>
        <div className="flex gap-2">
          {list && <button onClick={() => setForm(emptySponsor())} className="rounded-md bg-cyan-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400">+ Add partner</button>}
          <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{list ? 'Refresh' : 'Load'}</button>
        </div>
      </div>
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}

      {/* editor */}
      {form && (
        <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Partner name (e.g. $PEPE)" className={inputCls} />
            <input value={form.tagline || ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Tagline (optional)" className={inputCls} />
            <input value={form.logoUrl || ''} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="Logo image URL (https://…)" className={inputCls} />
            <input value={form.accentColor || ''} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} placeholder="Accent color #hex (optional)" className={inputCls} />
            <input value={form.socials?.twitter || ''} onChange={(e) => setForm({ ...form, socials: { ...form.socials, twitter: e.target.value } })} placeholder="X / Twitter URL" className={inputCls} />
            <input value={form.socials?.telegram || ''} onChange={(e) => setForm({ ...form, socials: { ...form.socials, telegram: e.target.value } })} placeholder="Telegram URL" className={inputCls} />
            <input value={form.socials?.website || ''} onChange={(e) => setForm({ ...form, socials: { ...form.socials, website: e.target.value } })} placeholder="Website URL" className={inputCls} />
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })} placeholder="Sort order" className={inputCls} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-white/40">Show in:</span>
            {SLOTS.map((slot) => (
              <label key={slot} className="flex items-center gap-1.5 text-white/80">
                <input type="checkbox" checked={form.slots.includes(slot)} onChange={() => toggleSlot(slot)} /> {slot}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-white/80">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> active
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy || !form.name} className="rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40">Save</button>
            <button onClick={() => setForm(null)} className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Cancel</button>
          </div>
        </div>
      )}

      {/* list */}
      {list && (list.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No partners yet. Add one to show it in the game.</div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-8 w-8 rounded object-contain" /> : <div className="h-8 w-8 rounded bg-white/10" />}
                <div>
                  <div className="text-sm font-medium text-white/90">{s.name} {!s.active && <span className="ml-1 text-[10px] text-white/30">(inactive)</span>}</div>
                  <div className="text-xs text-white/40">{s.slots.join(' · ') || 'no slots'}</div>
                  <div className="mt-0.5 text-[11px] text-cyan-300/70">
                    {(metrics[s.id]?.impressions || 0).toLocaleString()} impressions · {(metrics[s.id]?.clicks || 0).toLocaleString()} clicks · {metrics[s.id]?.ctrPct || 0}% CTR
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setForm({ ...emptySponsor(), ...s, socials: s.socials || {} })} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Edit</button>
                <button onClick={() => remove(s)} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300 hover:bg-red-500/25">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
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

// ---- live leaderboard (top ranked players) ----
function LeaderboardView({ rows }: { rows: Stats['leaderboard']['top'] }) {
  if (!rows || rows.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No ranked players yet.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
          <tr>
            <th className="px-3 py-2 w-10">#</th>
            <th className="px-3 py-2">Pilot</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-right">Wave</th>
            <th className="px-3 py-2 text-right">Kills</th>
            <th className="px-3 py-2">Ship</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => {
            const medal = i === 0 ? 'text-amber-300' : i === 1 ? 'text-slate-200' : i === 2 ? 'text-orange-400' : 'text-white/40';
            const name = r.name || (r.address.startsWith('0x') ? `${r.address.slice(0, 6)}…${r.address.slice(-4)}` : 'guest');
            return (
              <tr key={r.address + i} className={i < 3 ? 'bg-white/[0.02]' : ''}>
                <td className={`px-3 py-2 font-bold tabular-nums ${medal}`}>{i + 1}</td>
                <td className="px-3 py-2 text-white/90">{name} {r.verified && <span className="ml-1 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-300">✓</span>}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-white">{fmtNum(r.score)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-white/60">{r.level}</td>
                <td className="px-3 py-2 text-right tabular-nums text-white/60">{fmtNum(r.kills)}</td>
                <td className="px-3 py-2 text-white/50">{r.pilot}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- announcements ("make content" shown in-game) ----
interface Announcement { id: string; title: string; body: string; active: boolean; createdAt: number }
function AnnouncementsManager({ token }: { token: string }) {
  const [list, setList] = useState<Announcement[] | null>(null);
  const [form, setForm] = useState<{ id?: string; title: string; body: string; active: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputCls = 'w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60';

  async function load() {
    setBusy(true);
    try { const r = await fetch(`/api/admin/announcements?key=${encodeURIComponent(token)}`, { cache: 'no-store' }); const d = await r.json(); if (r.ok) setList(d.announcements); } finally { setBusy(false); }
  }
  async function save() {
    if (!form) return; setBusy(true);
    try { await fetch(`/api/admin/announcements?key=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setForm(null); await load(); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return; setBusy(true);
    try { await fetch(`/api/admin/announcements?key=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' }); await load(); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Announcements (shown in-game)</h3>
        <div className="flex gap-2">
          {list && <button onClick={() => setForm({ title: '', body: '', active: true })} className="rounded-md bg-cyan-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400">+ New</button>}
          <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{list ? 'Refresh' : 'Load'}</button>
        </div>
      </div>
      {form && (
        <div className="mb-3 space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className={inputCls} />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Body" rows={3} className={inputCls} />
          <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> active</label>
          <div className="flex gap-2"><button onClick={save} disabled={busy || !form.title} className="rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40">Save</button><button onClick={() => setForm(null)} className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Cancel</button></div>
        </div>
      )}
      {list && (list.length === 0 ? <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No announcements.</div> : (
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div><div className="text-sm font-medium text-white/90">{a.title} {!a.active && <span className="text-[10px] text-white/30">(hidden)</span>}</div><div className="text-xs text-white/50">{a.body}</div></div>
              <div className="flex shrink-0 gap-1.5"><button onClick={() => setForm({ id: a.id, title: a.title, body: a.body, active: a.active })} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Edit</button><button onClick={() => remove(a.id)} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300 hover:bg-red-500/25">Delete</button></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- player feedback inbox ----
interface FeedbackItem { id: string; text: string; from: string; at: number }
function FeedbackInbox({ token }: { token: string }) {
  const [list, setList] = useState<FeedbackItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try { const r = await fetch(`/api/admin/feedback?key=${encodeURIComponent(token)}`, { cache: 'no-store' }); const d = await r.json(); if (r.ok) setList(d.feedback); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Player feedback inbox</h3>
        <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{list ? 'Refresh' : 'Load'}</button>
      </div>
      {list && (list.length === 0 ? <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No feedback yet.</div> : (
        <div className="space-y-2">
          {list.map((f) => (
            <div key={f.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="text-sm text-white/85">{f.text}</div>
              <div className="mt-1 flex gap-3 text-[11px] text-white/35"><span className="font-mono">{f.from}</span><span>{fmtAgo(f.at)}</span></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- tournament rewards: seasons, prize tables, grants & USDC payouts ----
interface PrizeTier { fromRank: number; toRank: number; itemId?: string; usd?: number }
interface Season { id: string; name: string; sponsorId?: string; prizes: PrizeTier[]; status: 'draft' | 'active' | 'ended'; createdAt: number }
interface WinnerRow { rank: number; address: string; name?: string; score: number; verified: boolean; itemId?: string; usd?: number; granted?: boolean; paid?: boolean; txHash?: string; note?: string }
interface PayoutBatch { id: string; seasonId: string; createdAt: number; status: string; tokenSymbol: string; network: string; rows: WinnerRow[]; totalUsd: number }

const REWARD_ITEMS = [
  'trail_champion', 'drone_champion', 'color_gold', 'color_void', 'color_emerald', 'color_ice',
  'trail_ember', 'trail_ion', 'trail_void', 'consumable_revive', 'consumable_shield', 'consumable_health',
];
const emptySeason = (): Season => ({ id: '', name: '', sponsorId: '', status: 'draft', createdAt: 0, prizes: [{ fromRank: 1, toRank: 1, usd: 50, itemId: 'trail_champion' }] });

function short(addr: string) { return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr; }

function RewardsManager({ token }: { token: string }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [payouts, setPayouts] = useState<PayoutBatch[]>([]);
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; network: string; autoSend: boolean } | null>(null);
  const [form, setForm] = useState<Season | null>(null);
  const [winners, setWinners] = useState<{ seasonId: string; rows: WinnerRow[] } | null>(null);
  const [exported, setExported] = useState<{ csv: string; paste: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputCls = 'rounded-md border border-white/15 bg-white/[0.05] px-2 py-1.5 text-sm outline-none focus:border-cyan-400/60';

  async function load() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/rewards?key=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setSeasons(data.seasons); setPayouts(data.payouts || []);
      setTokenInfo({ symbol: data.payout.token.symbol, network: data.payout.token.network, autoSend: data.payout.autoSend });
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setBusy(false); }
  }

  async function saveSeason() {
    if (!form) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/rewards?key=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`✓ Saved ${data.season.name}.`); setForm(null); await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  }

  async function removeSeason(s: Season) {
    if (!confirm(`Delete season "${s.name}"?`)) return;
    setBusy(true);
    try { await fetch(`/api/admin/rewards?key=${encodeURIComponent(token)}&id=${encodeURIComponent(s.id)}`, { method: 'DELETE' }); await load(); }
    finally { setBusy(false); }
  }

  async function runWinners(seasonId: string, grant: boolean, createPayout: boolean) {
    setBusy(true); setMsg(''); setExported(null);
    try {
      const res = await fetch(`/api/admin/rewards/winners?key=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seasonId, grant, createPayout }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setWinners({ seasonId, rows: data.winners });
      if (grant) setMsg('✓ Cosmetic prizes granted to the winning wallets.');
      if (createPayout && data.payout) setMsg(`✓ Payout batch created: ${data.payout.rows.length} wallets, ${data.payout.totalUsd} ${tokenInfo?.symbol}.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusy(false); }
  }

  async function payoutAction(payoutId: string, action: 'export' | 'send' | 'mark-sent') {
    if (action === 'send' && !confirm('Send real funds now from the server payout wallet?')) return;
    if (action === 'mark-sent' && !confirm('Mark this batch as paid?')) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/rewards/payout?key=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payoutId, action, confirm: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      if (action === 'export') { setExported({ csv: data.export.csv, paste: data.export.disperse.pasteFormat }); setMsg('✓ Batch ready to sign from your wallet (copy below).'); }
      else setMsg(`✓ ${action === 'send' ? 'Sent' : 'Marked paid'}.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusy(false); }
  }

  function setPrize(i: number, patch: Partial<PrizeTier>) {
    if (!form) return;
    const prizes = form.prizes.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    setForm({ ...form, prizes });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300/80">Tournaments &amp; Rewards</h2>
        <div className="flex gap-2">
          {seasons && <button onClick={() => setForm(emptySeason())} className="rounded-md bg-cyan-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400">+ New season</button>}
          <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{seasons ? 'Refresh' : 'Load'}</button>
        </div>
      </div>
      {tokenInfo && (
        <div className="mb-3 text-[11px] text-white/40">
          Payout token: <span className="text-white/70">{tokenInfo.symbol}</span> on <span className="text-white/70">{tokenInfo.network}</span> · auto-send {tokenInfo.autoSend ? <span className="text-emerald-300">configured</span> : <span className="text-amber-300">off (export &amp; sign yourself)</span>}
        </div>
      )}
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}

      {/* season editor */}
      {form && (
        <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Season name (e.g. WEEK 1 — $PEPE CUP)" className={inputCls} />
            <input value={form.sponsorId || ''} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })} placeholder="Presenting sponsor id (optional)" className={inputCls} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Season['status'] })} className={inputCls}>
              <option value="draft">draft</option><option value="active">active</option><option value="ended">ended</option>
            </select>
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/50">Prize table (rank → reward)</div>
          <div className="mt-2 space-y-2">
            {form.prizes.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-white/40">Rank</span>
                <input type="number" value={p.fromRank} onChange={(e) => setPrize(i, { fromRank: parseInt(e.target.value, 10) || 1 })} className={`${inputCls} w-16`} />
                <span className="text-white/40">to</span>
                <input type="number" value={p.toRank} onChange={(e) => setPrize(i, { toRank: parseInt(e.target.value, 10) || 1 })} className={`${inputCls} w-16`} />
                <select value={p.itemId || ''} onChange={(e) => setPrize(i, { itemId: e.target.value || undefined })} className={inputCls}>
                  <option value="">— no cosmetic —</option>
                  {REWARD_ITEMS.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <span className="text-white/40">{tokenInfo?.symbol || 'USDC'}</span>
                <input type="number" value={p.usd ?? ''} onChange={(e) => setPrize(i, { usd: parseFloat(e.target.value) || undefined })} placeholder="0" className={`${inputCls} w-20`} />
                <button onClick={() => setForm({ ...form, prizes: form.prizes.filter((_, idx) => idx !== i) })} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300">✕</button>
              </div>
            ))}
            <button onClick={() => setForm({ ...form, prizes: [...form.prizes, { fromRank: form.prizes.length + 1, toRank: form.prizes.length + 1 }] })} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">+ Add tier</button>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={saveSeason} disabled={busy || !form.name} className="rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40">Save season</button>
            <button onClick={() => setForm(null)} className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Cancel</button>
          </div>
        </div>
      )}

      {/* season list */}
      {seasons && (seasons.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No seasons yet. Create one, set a prize table, then snapshot the board to reward the leaders.</div>
      ) : (
        <div className="space-y-3">
          {seasons.map((s) => (
            <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-white/90">{s.name} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>{s.status}</span></div>
                  <div className="text-[11px] text-white/40">{s.prizes.map((p) => `#${p.fromRank}${p.toRank !== p.fromRank ? `-${p.toRank}` : ''}: ${[p.itemId, p.usd ? `${p.usd} ${tokenInfo?.symbol || 'USDC'}` : null].filter(Boolean).join(' + ')}`).join('  ·  ')}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => runWinners(s.id, false, false)} disabled={busy} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Preview winners</button>
                  <button onClick={() => runWinners(s.id, true, false)} disabled={busy} className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/30">Grant cosmetics</button>
                  <button onClick={() => runWinners(s.id, false, true)} disabled={busy} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30">Create payout</button>
                  <button onClick={() => setForm({ ...emptySeason(), ...s })} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Edit</button>
                  <button onClick={() => removeSeason(s)} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300 hover:bg-red-500/25">Delete</button>
                </div>
              </div>

              {/* computed winners preview for this season */}
              {winners && winners.seasonId === s.id && (
                <div className="mt-3 overflow-x-auto rounded-md border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-white/40"><tr><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Player</th><th className="px-2 py-1.5">Wallet</th><th className="px-2 py-1.5">Reward</th><th className="px-2 py-1.5">Status</th></tr></thead>
                    <tbody>
                      {winners.rows.map((w) => (
                        <tr key={w.rank} className="border-t border-white/5">
                          <td className="px-2 py-1.5">{w.rank}</td>
                          <td className="px-2 py-1.5">{w.name || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-white/50">{short(w.address)}</td>
                          <td className="px-2 py-1.5">{[w.itemId, w.usd ? `${w.usd} ${tokenInfo?.symbol}` : null].filter(Boolean).join(' + ') || '—'}</td>
                          <td className="px-2 py-1.5">{w.note ? <span className="text-amber-300/80">{w.note}</span> : w.granted ? <span className="text-emerald-300">granted</span> : <span className="text-white/40">ready</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* payouts */}
      {payouts.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-300/70">Payout batches</h3>
          <div className="space-y-2">
            {payouts.map((b) => (
              <div key={b.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-white/85">{b.rows.length} wallets · <span className="font-semibold text-white">{b.totalUsd} {b.tokenSymbol}</span> <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${b.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>{b.status}</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => payoutAction(b.id, 'export')} disabled={busy} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30">Export to sign</button>
                    {tokenInfo?.autoSend && <button onClick={() => payoutAction(b.id, 'send')} disabled={busy} className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30">Auto-send</button>}
                    <button onClick={() => payoutAction(b.id, 'mark-sent')} disabled={busy} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Mark paid</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* export output */}
      {exported && (
        <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-300/70">Disperse.app paste (address, amount)</div>
          <textarea readOnly value={exported.paste} className="h-24 w-full rounded-md border border-white/15 bg-black/40 p-2 font-mono text-xs text-white/80" />
          <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-cyan-300/70">CSV</div>
          <textarea readOnly value={exported.csv} className="h-24 w-full rounded-md border border-white/15 bg-black/40 p-2 font-mono text-xs text-white/80" />
          <div className="mt-2 text-[11px] text-white/40">Paste the first block into disperse.app (or a Safe batch) with your treasury wallet and sign one transaction to pay everyone. Then hit “Mark paid”.</div>
        </div>
      )}
    </section>
  );
}

const TABS = ['Overview', 'Leaderboard', 'Rewards', 'Players', 'Sponsors', 'Content', 'Actions'] as const;
type Tab = (typeof TABS)[number];

function Dashboard(p: DashboardProps) {
  const { token, setToken, stats, error, loading, load, t, lb, mk, lo } = p;
  const { maxRuns, maxPilot, maxRev, maxItemRev, maxPilotRuns, maxDroneRuns } = p;
  const [tab, setTab] = useState<Tab>('Overview');

  const persistentWarn = stats && !stats.persistent;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-[#0a0c12] via-[#080808] to-[#050608] text-white">
      {/* premium branded header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0c12]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Raid Shooter" className="h-8 w-auto" />
          <div className="mr-auto">
            <div className="text-sm font-bold tracking-[0.2em] text-white">TEAM CONSOLE</div>
            <div className="text-[11px] text-white/35">Manage the live game · token stays on this device</div>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(token)}
            placeholder="ADMIN_STATS_TOKEN"
            className="min-w-[180px] rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          />
          <button onClick={() => load(token)} disabled={loading || !token} className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-40">
            {loading ? 'Loading…' : stats ? 'Refresh' : 'Load'}
          </button>
        </div>
        {/* tab nav */}
        {stats && (
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
            {TABS.map((tb) => (
              <button key={tb} onClick={() => setTab(tb)}
                className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${tab === tb ? 'text-white' : 'text-white/40 hover:text-white/70'}`}>
                {tb}
                {tab === tb && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-cyan-400" />}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        {stats && t && lb && mk && lo && (
          <div className="space-y-8">
            {persistentWarn && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                ⚠️ No persistent store connected — these numbers reset on every redeploy. Wire up KV
                (KV_REST_API_URL / KV_REST_API_TOKEN).
              </div>
            )}

            {/* ===== OVERVIEW ===== */}
            {tab === 'Overview' && (<>
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

              <h3 className="mt-5 mb-2 text-xs uppercase tracking-wider text-white/40">Recent purchases</h3>
              {mk.recentBuys.length === 0 ? (
                <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">
                  No verified purchases yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                  {mk.recentBuys.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="truncate font-medium text-white/80">{b.itemId}</span>
                      <span className="shrink-0 font-mono text-xs text-white/40">{b.buyer}</span>
                      <span className="shrink-0 w-16 text-right text-emerald-300/90 tabular-nums">{fmtUsd(b.priceUsd)}</span>
                      <span className="shrink-0 w-20 text-right text-white/40">{fmtAgo(b.at)}</span>
                    </div>
                  ))}
                </div>
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
            </>)}

            {/* ===== LEADERBOARD ===== */}
            {tab === 'Leaderboard' && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-300/80">
                Shooterboard · top 25
              </h2>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Submitters" value={fmtNum(lb.players.total)} sub={`${lb.players.verified} wallet · ${lb.players.guests} guest`} />
                <Stat label="Top score" value={fmtNum(lb.score.top)} sub={`avg ${fmtNum(lb.score.average)}`} />
                <Stat label="Median run" value={fmtDuration(lb.runTimeSeconds.median)} sub={`longest ${fmtDuration(lb.runTimeSeconds.longest)}`} />
                <Stat label="Active (30d)" value={fmtNum(lb.activity.last30Days)} sub={`${lb.activity.lastDay} today`} />
              </div>
              <LeaderboardView rows={lb.top} />
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
            )}

            {/* ===== REWARDS ===== */}
            {tab === 'Rewards' && <RewardsManager token={token} />}

            {/* ===== PLAYERS ===== */}
            {tab === 'Players' && <PlayersTable token={token} />}

            {/* ===== SPONSORS ===== */}
            {tab === 'Sponsors' && <SponsorsManager token={token} />}

            {/* ===== CONTENT ===== */}
            {tab === 'Content' && (
              <section className="space-y-8">
                <AnnouncementsManager token={token} />
                <FeedbackInbox token={token} />
              </section>
            )}

            {/* ===== ACTIONS ===== */}
            {tab === 'Actions' && <AdminActions token={token} />}

            <p className="pb-8 text-xs text-white/30">
              {stats.note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
