'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useSwitchChain, useChainId } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { parseUnits } from 'viem';

// Minimal ERC-20 transfer ABI for paying winners directly from the operator's
// connected wallet (USDC on Base).
const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// token.network ('base' | 'baseSepolia') -> chain id
const CHAIN_ID: Record<string, number> = { base: 8453, baseSepolia: 84532 };
import { useSIWE } from '@/hooks/useSIWE';

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

export interface Me { actor: string; role: string; roleLabel: string; scopes: string[] }

function authHeaders(token: string): HeadersInit {
  // wallet admins carry a session cookie (sent automatically); break-glass
  // token admins send a Bearer header. Empty token => cookie-only.
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Resolve identity (role + scopes) via /api/admin/me, then load stats.
  async function resolveAuth(tok: string): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/me', { cache: 'no-store', headers: authHeaders(tok) });
      if (!res.ok) { setMe(null); return false; }
      const identity = (await res.json()) as Me;
      setMe(identity);
      if (identity.scopes.includes('stats.view')) await load(tok);
      return true;
    } catch { setMe(null); return false; }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('key');
    if (fromUrl) window.history.replaceState({}, '', window.location.pathname);
    const saved = fromUrl || localStorage.getItem('admin_stats_token') || '';
    setToken(saved);
    // try token first (if any), otherwise a wallet-session cookie
    resolveAuth(saved).finally(() => setAuthChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(t: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/stats`, { cache: 'no-store', headers: authHeaders(t) });
      if (res.status === 401) throw new Error('Not authorized (401).');
      if (res.status === 503) throw new Error('Admin auth is not configured on the server (503).');
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = (await res.json()) as Stats;
      setStats(data);
      if (t) localStorage.setItem('admin_stats_token', t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithToken(tok: string) {
    setToken(tok);
    const ok = await resolveAuth(tok);
    if (!ok) setError('That token was rejected.');
  }
  function signOut() {
    localStorage.removeItem('admin_stats_token');
    setToken(''); setMe(null); setStats(null);
  }

  if (!authChecked) {
    return <div className="fixed inset-0 grid place-items-center bg-[#08090d] text-white/40 text-sm">Checking access…</div>;
  }
  if (!me) {
    return <LoginScreen onToken={loginWithToken} onWalletAuthed={() => resolveAuth('')} error={error} />;
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

  return <Dashboard {...{ token, setToken, me, signOut, stats, error, loading, load, t, lb, mk, lo, maxRuns, maxPilot, maxRev, maxItemRev, maxPilotRuns, maxDroneRuns }} />;
}

// ---- login: wallet sign-in (primary) + break-glass token (recovery) ----
function LoginScreen({ onToken, onWalletAuthed, error }: { onToken: (t: string) => void; onWalletAuthed: () => void; error: string }) {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const { authenticated, signIn, loading: siweLoading } = useSIWE();
  const [tok, setTok] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);

  // once a wallet SIWE session exists, hand back to the resolver
  useEffect(() => { if (authenticated) onWalletAuthed(); }, [authenticated, onWalletAuthed]);

  return (
    <div className="fixed inset-0 grid place-items-center bg-gradient-to-b from-[#0a0c12] to-[#060709] px-6 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Raid Shooter" className="h-9 w-auto" />
          <div>
            <div className="text-sm font-bold tracking-[0.2em]">TEAM CONSOLE</div>
            <div className="text-[11px] text-white/40">Sign in to manage the live game</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {!isConnected ? (
            <button onClick={() => open()} className="w-full rounded-lg bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-black hover:bg-cyan-400">
              Connect wallet
            </button>
          ) : !authenticated ? (
            <button onClick={() => { setBusy(true); signIn().finally(() => setBusy(false)); }} disabled={busy || siweLoading}
              className="w-full rounded-lg bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50">
              {busy || siweLoading ? 'Signing…' : 'Sign in with wallet'}
            </button>
          ) : (
            <div className="text-sm text-white/60">Signed in — loading…</div>
          )}
          <p className="mt-3 text-center text-[11px] text-white/35">Your wallet address must be on the admin roster.</p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <button onClick={() => setShowToken((v) => !v)} className="mt-5 w-full text-center text-[11px] text-white/30 hover:text-white/60">
          {showToken ? 'Hide' : 'Use recovery token instead'}
        </button>
        {showToken && (
          <div className="mt-2 flex gap-2">
            <input type="password" value={tok} onChange={(e) => setTok(e.target.value)} placeholder="ADMIN_STATS_TOKEN"
              onKeyDown={(e) => e.key === 'Enter' && onToken(tok)}
              className="flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60" />
            <button onClick={() => onToken(tok)} disabled={!tok} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40">Enter</button>
          </div>
        )}
      </div>
    </div>
  );
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
      const res = await fetch(`/api/admin/players`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setPlayers(data.players);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load players.');
    } finally {
      setBusy(false);
    }
  }

  async function moderate(p: PlayerRow, action: 'derank' | 'ban' | 'unban' | 'restore') {
    const verb = action === 'ban' ? 'BAN' : action === 'unban' ? 'unban' : action === 'restore' ? 'restore' : 'derank';
    // only the destructive actions confirm; unban/restore are the safe undo path
    if ((action === 'derank' || action === 'ban') && !confirm(`${verb} ${shortId(p)}? ${action === 'ban' ? 'They will be removed from every board AND blocked from re-ranking.' : 'Removes their score from all-time, every cup, and the weekly board.'} You can Restore it afterward.`)) return;
    setBusy(true);
    setNote('');
    try {
      const res = await fetch(`/api/admin/derank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: p.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      if (action === 'restore') {
        setNote(data.restored ? `✓ Restored ${shortId(p)}${typeof data.score === 'number' ? ` (${data.score.toLocaleString()} pts)` : ''}.` : `Nothing to restore for ${shortId(p)} — no removed score on file.`);
      } else {
        setNote(`✓ ${action} applied to ${shortId(p)}.`);
      }
      await loadPlayers();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  // Manual recovery when there's no snapshot to Restore from (e.g. a score
  // removed before the Restore feature existed): re-add it by value.
  async function readdScore(p: PlayerRow) {
    const raw = prompt(`Re-add a score for ${shortId(p)}.\nEnter the score value to put back on the board:`, '');
    if (raw === null) return;
    const score = Number(raw.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(score) || score <= 0) { setNote('Enter a positive number for the score.'); return; }
    const name = prompt('Optional call sign (leave blank to keep existing):', p.name || '') || '';
    setBusy(true);
    setNote('');
    try {
      const res = await fetch(`/api/admin/derank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: p.id, action: 'readd', score, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setNote(`✓ Set ${shortId(p)}'s score to ${score.toLocaleString()} pts (rank #${data.rank}).`);
      await loadPlayers();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Re-add failed.');
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
                        <button onClick={() => moderate(p, 'restore')} disabled={busy} title="Undo an accidental derank/ban - puts their snapshotted score back" className="rounded bg-sky-500/15 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/25 disabled:opacity-40">Restore</button>
                        <button onClick={() => readdScore(p)} disabled={busy} title="Manually re-add a score by value (when there's no snapshot to restore)" className="rounded bg-sky-500/10 px-2 py-1 text-xs text-sky-200/80 hover:bg-sky-500/20 disabled:opacity-40">Re-add</button>
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
const SLOTS = ['loading', 'menu', 'partners', 'arena'] as const;
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
      const res = await fetch(`/api/admin/sponsors`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`/api/admin/sponsors`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form),
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
      const res = await fetch(`/api/admin/sponsors&id=${encodeURIComponent(s.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`/api/admin/player?id=${encodeURIComponent(lookupId.trim())}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`/api/admin/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      const res = await fetch(`/api/admin/leaderboard/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  me: Me;
  signOut: () => void;
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

// ---- suspicious-run review queue (anti-cheat gate before payouts) ----
interface FlaggedRun { id: string; address: string; name?: string; score: number; kills: number; combo: number; time: number; pilot: string; at: number; verified: boolean; reason: string }

function FlaggedRuns({ token }: { token: string }) {
  const [rows, setRows] = useState<FlaggedRun[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/flagged`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setRows(data.flagged);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setBusy(false); }
  }

  async function act(row: FlaggedRun, action: 'approve' | 'derank' | 'ban') {
    if (action !== 'approve' && !confirm(`${action.toUpperCase()} ${row.name || row.address}?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/flagged`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: row.id, address: row.address, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-red-300/80">Flagged runs — review before paying prizes</h2>
        <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{rows ? 'Refresh' : 'Load'}</button>
      </div>
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}
      {rows && (rows.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">Queue is clear. Outlier submissions land here automatically (they still rank until you act).</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-white/40"><tr><th className="px-2 py-1.5">Player</th><th className="px-2 py-1.5">Score</th><th className="px-2 py-1.5">Kills</th><th className="px-2 py-1.5">Time</th><th className="px-2 py-1.5">Reason</th><th className="px-2 py-1.5 text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-2 py-1.5">{r.name || '—'} <span className="font-mono text-white/40">{short(r.address)}</span>{r.verified && <span className="ml-1 text-emerald-300">✓</span>}</td>
                  <td className="px-2 py-1.5 font-semibold">{r.score.toLocaleString()}</td>
                  <td className="px-2 py-1.5">{r.kills}</td>
                  <td className="px-2 py-1.5">{r.time}s</td>
                  <td className="px-2 py-1.5 text-amber-300/80">{r.reason}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => act(r, 'approve')} className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-300 hover:bg-emerald-500/25">Approve</button>
                    <button onClick={() => act(r, 'derank')} className="ml-1.5 rounded bg-amber-500/15 px-2 py-1 text-amber-300 hover:bg-amber-500/25">Derank</button>
                    <button onClick={() => act(r, 'ban')} className="ml-1.5 rounded bg-red-500/15 px-2 py-1 text-red-300 hover:bg-red-500/25">Ban</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

interface WalletErrorEntry { id: string; at: number; kind: 'CONNECT_ERROR' | 'USER_REJECTED' | 'DISCONNECT_ERROR' | 'RECONNECT_TIMEOUT'; walletName?: string; message?: string; userAgent?: string }

// "Some people can connect, others can't" has no answer without real data.
// This panel is that data - every entry is a real failure AppKit reported
// from a real player's browser (wallet name, error message, UA), captured
// client-side and posted to /api/wallet/connect-error. Look here first the
// next time someone reports a wallet issue instead of guessing blind.
function WalletErrors({ token }: { token: string }) {
  const [rows, setRows] = useState<WalletErrorEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/wallet/connect-error`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setRows(data.errors);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setBusy(false); }
  }

  const kindColor: Record<WalletErrorEntry['kind'], string> = {
    CONNECT_ERROR: 'text-red-300/80',
    DISCONNECT_ERROR: 'text-red-300/80',
    USER_REJECTED: 'text-white/40',
    RECONNECT_TIMEOUT: 'text-amber-300/80',
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300/80">Wallet connect errors — recent, from real players</h2>
        <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{rows ? 'Refresh' : 'Load'}</button>
      </div>
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}
      {rows && (rows.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No wallet connect failures reported recently.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-white/40"><tr><th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Wallet</th><th className="px-2 py-1.5">Message</th><th className="px-2 py-1.5">Browser</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-2 py-1.5 text-white/50">{fmtAgo(r.at)}</td>
                  <td className={`px-2 py-1.5 font-semibold ${kindColor[r.kind]}`}>{r.kind.replace('_', ' ')}</td>
                  <td className="px-2 py-1.5">{r.walletName || '—'}</td>
                  <td className="px-2 py-1.5 text-white/70">{r.message || '—'}</td>
                  <td className="max-w-[260px] truncate px-2 py-1.5 text-white/30" title={r.userAgent}>{r.userAgent || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

interface ChatEntry { id: string; key: string; name: string; text: string; verified: boolean; at: number; }

function ChatModeration({ token }: { token: string }) {
  const [rows, setRows] = useState<ChatEntry[] | null>(null);
  const [muted, setMuted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setBusy(true); setMsg('');
    try {
      const [chatRes, mutedRes] = await Promise.all([
        fetch(`/api/chat`, { cache: 'no-store' }),
        fetch(`/api/admin/chat`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const chatData = await chatRes.json();
      const mutedData = await mutedRes.json();
      if (!chatRes.ok) throw new Error(chatData.error || `Failed (${chatRes.status})`);
      if (!mutedRes.ok) throw new Error(mutedData.error || `Failed (${mutedRes.status})`);
      setRows([...chatData.messages].reverse());
      setMuted(mutedData.muted || []);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setBusy(false); }
  }

  async function removeMessage(id: string) {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/chat?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to delete.'); }
    finally { setBusy(false); }
  }

  async function toggleMute(key: string, action: 'mute' | 'unmute') {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to update mute.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300/80">Top 20 chat moderation</h2>
        <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">{rows ? 'Refresh' : 'Load'}</button>
      </div>
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}
      {rows && (rows.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No chat messages yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-white/40"><tr><th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">Pilot</th><th className="px-2 py-1.5">Message</th><th className="px-2 py-1.5">Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const isMuted = muted.includes(r.key);
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-2 py-1.5 text-white/50">{fmtAgo(r.at)}</td>
                    <td className="px-2 py-1.5 font-semibold text-white/80">{r.name}{r.verified && <span className="ml-1 text-cyan-300">✓</span>}</td>
                    <td className="px-2 py-1.5 text-white/70">{r.text}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1.5">
                        <button onClick={() => removeMessage(r.id)} disabled={busy} className="rounded bg-red-500/15 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/25 disabled:opacity-40">Delete</button>
                        {isMuted ? (
                          <button onClick={() => toggleMute(r.key, 'unmute')} disabled={busy} className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20 disabled:opacity-40">Unmute</button>
                        ) : (
                          <button onClick={() => toggleMute(r.key, 'mute')} disabled={busy} className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/25 disabled:opacity-40">Mute</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

interface GuestMatch { guestKey: string; name?: string; score: number; kills: number; pilot: string; at: number }

function GuestRecovery({ token }: { token: string }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<GuestMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [walletInputs, setWalletInputs] = useState<Record<string, string>>({});

  async function search() {
    if (query.trim().length < 2) { setMsg('Type at least 2 characters of the player\'s old call sign.'); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/recover-guest?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMatches(data.matches);
      if (data.matches.length === 0) setMsg('No guest entries match that name.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Search failed.'); }
    finally { setBusy(false); }
  }

  async function recover(guestKey: string) {
    const walletAddress = (walletInputs[guestKey] || '').trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      setMsg('Enter a valid 0x wallet address for that row first.');
      return;
    }
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/admin/recover-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ guestKey, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`Merged into ${walletAddress} — score ${fmtNum(data.walletEntry?.score || 0)}, ${data.walletProfile?.items?.length || 0} items, ${Object.keys(data.walletProfile?.consumables || {}).length} consumable type(s).`);
      setMatches((prev) => (prev ? prev.filter((m) => m.guestKey !== guestKey) : prev));
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Recovery failed.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300/80">Recover lost guest progress — search by old call sign</h2>
      </div>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          placeholder="Player's call sign before they connected a wallet"
          className="flex-1 rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/50"
        />
        <button onClick={search} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">Search</button>
      </div>
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}
      {matches && matches.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-white/40"><tr><th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">Call sign</th><th className="px-2 py-1.5">Score</th><th className="px-2 py-1.5">Pilot</th><th className="px-2 py-1.5">Wallet to recover into</th><th className="px-2 py-1.5">Actions</th></tr></thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.guestKey} className="border-t border-white/5">
                  <td className="px-2 py-1.5 text-white/50">{fmtAgo(m.at)}</td>
                  <td className="px-2 py-1.5 font-semibold text-white/80">{m.name || '—'}</td>
                  <td className="px-2 py-1.5 tabular-nums text-white/70">{fmtNum(m.score)}</td>
                  <td className="px-2 py-1.5 text-white/50">{m.pilot}</td>
                  <td className="px-2 py-1.5">
                    <input
                      value={walletInputs[m.guestKey] || ''}
                      onChange={(e) => setWalletInputs((prev) => ({ ...prev, [m.guestKey]: e.target.value }))}
                      placeholder="0x..."
                      className="w-full rounded border border-white/15 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white placeholder-white/25 outline-none focus:border-cyan-400/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => recover(m.guestKey)} disabled={busy} className="rounded bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40">Merge into wallet</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

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

// ---- AI assistant: drafts announcements / replies / feedback digests ----
// Every result is a DRAFT the operator reviews before it goes anywhere. The
// assistant never posts or acts on its own - "Publish" below routes through
// the same announcements endpoint a human uses.
function AIAssistant({ token }: { token: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [autoReply, setAutoReply] = useState(false);
  const [brief, setBrief] = useState('');
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [replyMsg, setReplyMsg] = useState('');
  const [reply, setReply] = useState('');
  const [summary, setSummary] = useState('');
  const [testOut, setTestOut] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const inputCls = 'w-full rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60';

  useEffect(() => {
    fetch('/api/admin/ai', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setAutoReply(!!d.autoReply); })
      .catch(() => setEnabled(false));
  }, [token]);

  async function call(action: string, payload: object) {
    setBusy(action); setNote('');
    try {
      const r = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Failed (${r.status})`);
      return d;
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'AI request failed.');
      return null;
    } finally {
      setBusy('');
    }
  }

  async function publishDraft() {
    if (!draft) return;
    setBusy('publish');
    try {
      await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: draft.title, body: draft.body, active: true }),
      });
      setNote('✓ Published to the in-game news banner.');
      setDraft(null); setBrief('');
    } finally { setBusy(''); }
  }

  if (enabled === null) return null;

  return (
    <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300/80">AI assistant</h3>
        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200">DRAFTS ONLY</span>
      </div>
      {!enabled ? (
        <p className="mt-3 text-sm text-white/40">
          Off. Set <code className="rounded bg-white/10 px-1">ANTHROPIC_API_KEY</code> in the environment to turn on AI drafting.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {note && <div className="rounded-md bg-white/[0.04] p-2 text-xs text-white/70">{note}</div>}

          {/* live test — see the model actually respond */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <button onClick={async () => { setTestOut(''); const d = await call('test', {}); if (d) setTestOut(d.output || ''); }} disabled={!!busy} className="rounded-md bg-cyan-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-40">{busy === 'test' ? 'Pinging…' : 'Test the AI'}</button>
            <span className="text-xs text-white/50">Ping the model live to confirm it's working.</span>
            {testOut && <div className="w-full rounded-md bg-cyan-500/[0.06] p-2 text-sm text-cyan-100">🤖 {testOut}</div>}
          </div>

          {/* autonomous chat auto-reply toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-3">
            <div>
              <div className="text-xs font-semibold text-amber-200">Auto-reply in live chat</div>
              <div className="text-[11px] text-white/40">When on, the AI answers players&apos; questions in top-20 chat on its own (rate-limited, only when it adds value). It posts text only — it can never move money.</div>
            </div>
            <button
              onClick={async () => { const d = await call('set-autoreply', { on: !autoReply }); if (d) setAutoReply(!!d.autoReply); }}
              disabled={!!busy}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${autoReply ? 'bg-emerald-500/80 text-black hover:bg-emerald-400' : 'bg-white/10 text-white/70 hover:bg-white/20'} disabled:opacity-40`}
            >
              {autoReply ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* draft an announcement */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-white/60">Draft an announcement</div>
            <div className="flex gap-2">
              <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief, e.g. new cup starts Friday, $50 to top 5" className={inputCls} />
              <button onClick={async () => { const d = await call('draft-announcement', { brief }); if (d?.draft) setDraft(d.draft); }} disabled={!brief || !!busy} className="shrink-0 rounded-md bg-violet-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-violet-400 disabled:opacity-40">{busy === 'draft-announcement' ? 'Drafting…' : 'Draft'}</button>
            </div>
            {draft && (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={`${inputCls} mb-2 font-semibold`} />
                <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} className={inputCls} />
                <div className="mt-2 flex gap-2">
                  <button onClick={publishDraft} disabled={!!busy} className="rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>
                  <button onClick={() => setDraft(null)} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">Discard</button>
                </div>
              </div>
            )}
          </div>

          {/* draft a reply */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-white/60">Draft a reply to a player</div>
            <textarea value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)} rows={2} placeholder="Paste the player's message…" className={inputCls} />
            <button onClick={async () => { const d = await call('draft-reply', { message: replyMsg }); if (d?.reply) setReply(d.reply); }} disabled={!replyMsg || !!busy} className="rounded-md bg-violet-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-violet-400 disabled:opacity-40">{busy === 'draft-reply' ? 'Drafting…' : 'Draft reply'}</button>
            {reply && <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/80 whitespace-pre-wrap">{reply}</div>}
          </div>

          {/* summarize feedback */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-white/60">Summarize recent feedback</div>
            <button onClick={async () => { const d = await call('summarize-feedback', {}); if (d?.summary) setSummary(d.summary); }} disabled={!!busy} className="rounded-md bg-violet-500/80 px-3 py-1.5 text-xs font-semibold text-black hover:bg-violet-400 disabled:opacity-40">{busy === 'summarize-feedback' ? 'Summarizing…' : 'Summarize'}</button>
            {summary && <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/80 whitespace-pre-wrap">{summary}</div>}
          </div>
        </div>
      )}
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
    try { const r = await fetch(`/api/admin/announcements`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (r.ok) setList(d.announcements); } finally { setBusy(false); }
  }
  async function save() {
    if (!form) return; setBusy(true);
    try { await fetch(`/api/admin/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) }); setForm(null); await load(); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return; setBusy(true);
    try { await fetch(`/api/admin/announcements&id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); await load(); } finally { setBusy(false); }
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
    try { const r = await fetch(`/api/admin/feedback`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (r.ok) setList(d.feedback); } finally { setBusy(false); }
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
interface Season { id: string; name: string; sponsorId?: string; prizes: PrizeTier[]; status: 'draft' | 'active' | 'ended'; createdAt: number; endsAt?: number; requiredPilotId?: string; thanksMessage?: string }

// <input type="datetime-local"> speaks "YYYY-MM-DDTHH:MM" in local time
function msToLocalInput(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function localInputToMs(v: string): number | undefined {
  if (!v) return undefined;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}
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
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; network: string; autoSend: boolean; address: string; decimals: number } | null>(null);
  const { isConnected, address: walletAddress } = useAccount();
  const { open } = useAppKit();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const [payProgress, setPayProgress] = useState('');
  const [form, setForm] = useState<Season | null>(null);
  const [winners, setWinners] = useState<{ seasonId: string; rows: WinnerRow[] } | null>(null);
  const [exported, setExported] = useState<{ csv: string; paste: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputCls = 'rounded-md border border-white/15 bg-white/[0.05] px-2 py-1.5 text-sm outline-none focus:border-cyan-400/60';

  async function load() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/rewards`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setSeasons(data.seasons); setPayouts(data.payouts || []);
      setTokenInfo({ symbol: data.payout.token.symbol, network: data.payout.token.network, autoSend: data.payout.autoSend, address: data.payout.token.address, decimals: data.payout.token.decimals });
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setBusy(false); }
  }

  async function saveSeason() {
    if (!form) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/rewards`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMsg(`✓ Saved ${data.season.name}.`); setForm(null); await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  }

  async function removeSeason(s: Season) {
    if (!confirm(`Delete season "${s.name}"?`)) return;
    setBusy(true);
    try { await fetch(`/api/admin/rewards&id=${encodeURIComponent(s.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); await load(); }
    finally { setBusy(false); }
  }

  async function runWinners(seasonId: string, grant: boolean, createPayout: boolean) {
    setBusy(true); setMsg(''); setExported(null);
    try {
      const res = await fetch(`/api/admin/rewards/winners`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ seasonId, grant, createPayout }) });
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
      const res = await fetch(`/api/admin/rewards/payout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ payoutId, action, confirm: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      if (action === 'export') { setExported({ csv: data.export.csv, paste: data.export.disperse.pasteFormat }); setMsg('✓ Batch ready to sign from your wallet (copy below).'); }
      else setMsg(`✓ ${action === 'send' ? 'Sent' : 'Marked paid'}.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); }
    finally { setBusy(false); }
  }

  // Pay winners directly from the operator's OWN connected wallet: one USDC
  // transfer per recipient, signed in the wallet. Nothing server-side moves
  // funds. Tx hashes are recorded back so the batch shows paid + winners get
  // notified. A failed/declined transfer just leaves that row unpaid to
  // retry - the loop keeps going for the rest.
  async function payFromWallet(b: PayoutBatch) {
    if (!tokenInfo?.address) { setMsg('Payout token not configured.'); return; }
    const targetChain = CHAIN_ID[tokenInfo.network] || 8453;
    const recipients = b.rows.filter((r) => r.usd && r.usd > 0 && /^0x[0-9a-fA-F]{40}$/.test(r.address) && !r.paid);
    if (recipients.length === 0) { setMsg('Nothing left to pay in this batch.'); return; }
    if (!isConnected) { open(); return; }
    if (!confirm(`Pay ${recipients.length} winner(s) a total of ${recipients.reduce((s, r) => s + (r.usd || 0), 0)} ${tokenInfo.symbol} from your connected wallet? You'll sign one transaction per winner.`)) return;

    setBusy(true); setMsg(''); setPayProgress('');
    try {
      if (chainId !== targetChain) {
        setPayProgress(`Switching wallet to ${tokenInfo.network}…`);
        await switchChainAsync({ chainId: targetChain });
      }
      const results: { address: string; txHash: string }[] = [];
      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        setPayProgress(`Paying ${i + 1}/${recipients.length}: ${short(r.address)} — confirm in your wallet…`);
        try {
          const hash = await writeContractAsync({
            abi: ERC20_TRANSFER_ABI,
            address: tokenInfo.address as `0x${string}`,
            functionName: 'transfer',
            args: [r.address as `0x${string}`, parseUnits(String(r.usd), tokenInfo.decimals)],
            chainId: targetChain,
          });
          results.push({ address: r.address, txHash: hash });
        } catch {
          setPayProgress(`Skipped ${short(r.address)} (declined or failed) — you can retry this batch.`);
        }
      }
      if (results.length > 0) {
        await fetch(`/api/admin/rewards/payout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ payoutId: b.id, action: 'record-onchain', results }),
        });
      }
      setMsg(`✓ Paid ${results.length}/${recipients.length} winner(s) from your wallet.`);
      setPayProgress('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Wallet payment failed.');
      setPayProgress('');
    } finally { setBusy(false); }
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
            <input value={form.requiredPilotId || ''} onChange={(e) => setForm({ ...form, requiredPilotId: e.target.value.trim().toLowerCase() })} placeholder="Required pilot id to enter cup (optional, e.g. voltrider)" className={inputCls} />
            <input value={form.thanksMessage || ''} onChange={(e) => setForm({ ...form, thanksMessage: e.target.value })} placeholder="Thanks message when cup ends (optional — auto-sent to all players)" className={inputCls} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Season['status'] })} className={inputCls}>
              <option value="draft">draft</option><option value="active">active</option><option value="ended">ended</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-white/60">
              Ends
              <input
                type="datetime-local"
                value={msToLocalInput(form.endsAt)}
                onChange={(e) => setForm({ ...form, endsAt: localInputToMs(e.target.value) })}
                className={`flex-1 ${inputCls}`}
              />
            </label>
          </div>
          <div className="mt-1 text-[11px] text-white/35">The end time drives the in-game countdown (&quot;ENDS IN 2 DAYS&quot;). Leave empty for no countdown.</div>
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
                  <div className="text-sm font-medium text-white/90">{s.name} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>{s.status}</span>{s.endsAt ? <span className="ml-2 text-[11px] text-amber-300/70">ends {new Date(s.endsAt).toLocaleString()}</span> : null}</div>
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
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-300/70">Payout batches</h3>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            {isConnected
              ? <span className="text-white/50">Wallet <span className="font-mono text-emerald-300">{walletAddress ? short(walletAddress) : ''}</span> connected — use “Pay from my wallet” to send USDC directly.</span>
              : <button onClick={() => open()} className="rounded bg-violet-500/80 px-2 py-1 font-semibold text-black hover:bg-violet-400">Connect wallet to pay players</button>}
          </div>
          {payProgress && <div className="mb-2 rounded-md bg-violet-500/10 p-2 text-xs text-violet-200">{payProgress}</div>}
          <div className="space-y-2">
            {payouts.map((b) => (
              <div key={b.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-white/85">{b.rows.length} wallets · <span className="font-semibold text-white">{b.totalUsd} {b.tokenSymbol}</span> <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${b.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>{b.status}</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => payFromWallet(b)} disabled={busy || b.status === 'sent'} className="rounded bg-violet-500/80 px-2 py-1 text-xs font-semibold text-black hover:bg-violet-400 disabled:opacity-40">💜 Pay from my wallet</button>
                    <button onClick={() => payoutAction(b.id, 'export')} disabled={busy} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30">Export to sign</button>
                    {tokenInfo?.autoSend && <button onClick={() => payoutAction(b.id, 'send')} disabled={busy} className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30">Auto-send</button>}
                    <button onClick={() => payoutAction(b.id, 'mark-sent')} disabled={busy} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Mark paid</button>
                  </div>
                </div>
                {/* per-winner rows so the operator sees who gets what + paid state */}
                <div className="mt-2 space-y-0.5 border-t border-white/5 pt-2 text-[11px]">
                  {b.rows.map((w) => (
                    <div key={w.address} className="flex items-center justify-between gap-2 text-white/50">
                      <span>#{w.rank} <span className="font-mono">{short(w.address)}</span>{w.name ? ` · ${w.name}` : ''}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-white/70">{w.usd} {b.tokenSymbol}</span>
                        {w.paid
                          ? <a href={w.txHash ? `https://basescan.org/tx/${w.txHash}` : undefined} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline">paid{w.txHash ? ' ↗' : ''}</a>
                          : <span className="text-white/30">unpaid</span>}
                      </span>
                    </div>
                  ))}
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

// ---- Mission Control: health + a "needs attention" queue ----
interface HomeData {
  health: { activeToday: number; active7Days: number; runsToday: number; playersDelta: number | null; runsDelta: number | null; uniqueAllTime: number; daily: { date: string; players: number; runs: number }[] } | null;
  needs: { type: string; count: number; label: string; scope: string; cta: string }[];
  activeSeason: { name: string; endsAt: number | null } | null;
}
function MissionControl({ token, me, go }: { token: string; me: Me; go: (t: Tab) => void }) {
  const [d, setD] = useState<HomeData | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/home', { cache: 'no-store', headers: authHeaders(token) });
      if (res.ok) setD(await res.json());
    } finally { setBusy(false); }
  }
  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000); // keep the console live
    return () => clearInterval(iv);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  const h = d?.health;
  const now = new Date();
  return (
    <section>
      {/* professional header band */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-300/80">Mission Control</div>
          <h2 className="mt-1 text-xl font-bold">Welcome back, <span className="text-cyan-300">{ROLE_LABEL(me.role)}</span>.</h2>
          <p className="mt-0.5 text-sm text-white/40">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            {d?.activeSeason && <> · Active cup: <span className="text-amber-300/80">{d.activeSeason.name}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
          <button onClick={load} disabled={busy} className="rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-40">{busy ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {/* KPI tiles with mini trend bars */}
      {h && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="Active today" value={h.activeToday} delta={h.playersDelta} accent="#33e6ff" series={(h.daily || []).map((x) => x.players)} />
          <KpiTile label="Runs today" value={h.runsToday} delta={h.runsDelta} accent="#8affb0" series={(h.daily || []).map((x) => x.runs)} />
          <KpiTile label="Active · 7 days" value={h.active7Days} accent="#ffbb4d" />
          <KpiTile label="Players all-time" value={h.uniqueAllTime} accent="#c9a7ff" />
        </div>
      )}

      {/* needs attention */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">Needs attention</div>
          {d && <div className="text-[11px] text-white/30">{d.needs.length} open</div>}
        </div>
        {d && d.needs.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-sm text-emerald-300/90">✓ All clear — nothing waiting on you.</div>
        ) : (
          <div className="space-y-2">
            {(d?.needs || []).map((n, i) => (
              <button key={i} onClick={() => go(n.cta as Tab)} className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-cyan-400/40">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-sm font-bold text-amber-300">{n.count}</span>
                <span className="flex-1 text-sm text-white/85">{n.label}</span>
                <span className="shrink-0 text-xs text-cyan-300">Open {n.cta} →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// role id -> friendly label for the greeting
function ROLE_LABEL(role: string): string {
  const map: Record<string, string> = { owner: 'Owner', finance: 'Finance', community: 'Community', moderator: 'Moderator', analyst: 'Analyst' };
  return map[role] || role;
}

// a KPI tile with a delta pill and an optional 14-day sparkline
function KpiTile({ label, value, delta, accent, series }: { label: string; value: number; delta?: number | null; accent: string; series?: number[] }) {
  const pts = (series || []).slice(-14);
  const max = Math.max(1, ...pts);
  const w = 100, hgt = 26;
  const path = pts.length > 1
    ? pts.map((v, i) => `${(i / (pts.length - 1)) * w},${hgt - (v / max) * hgt}`).join(' ')
    : '';
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-white/35">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{value.toLocaleString()}</div>
        {delta != null && (
          <span className={`text-[11px] font-semibold ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-white/30'}`}>
            {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '—'}
          </span>
        )}
      </div>
      {path && (
        <svg viewBox={`0 0 ${w} ${hgt}`} className="mt-2 h-6 w-full overflow-visible" preserveAspectRatio="none">
          <polyline points={path} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
        </svg>
      )}
    </div>
  );
}

// ---- Admins management (owner only) ----
interface AdminRow { address: string; role: string; label?: string; addedAt: number }
interface RoleInfo { id: string; label: string; desc: string; scopes: string[] }
function AdminsManager({ token, me }: { token: string; me: Me }) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [addr, setAddr] = useState(''); const [role, setRole] = useState('moderator'); const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const inputCls = 'rounded-md border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60';
  async function load() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/admin/admins', { cache: 'no-store', headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setAdmins(data.admins); setRoles(data.roles);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); } finally { setBusy(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  async function addAdmin() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/admin/admins', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ address: addr, role, label }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAddr(''); setLabel(''); setMsg(`✓ ${data.admin.address.slice(0,6)}… added as ${data.admin.role}.`); await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); } finally { setBusy(false); }
  }
  async function remove(a: AdminRow) {
    if (!confirm(`Remove ${a.label || a.address} (${a.role})?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/admins?address=${encodeURIComponent(a.address)}`, { method: 'DELETE', headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not remove.');
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed.'); } finally { setBusy(false); }
  }
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-amber-300/80">Admins &amp; Roles</h2>
      <p className="mb-4 text-xs text-white/40">Add a teammate&apos;s wallet address and pick what they can do. They sign in by connecting that wallet.</p>
      {msg && <div className="mb-3 rounded-md border border-white/15 bg-white/[0.05] p-2 text-sm text-white/80">{msg}</div>}

      <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x… wallet address" className={inputCls} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button onClick={addAdmin} disabled={busy || !addr} className="rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40">Add</button>
        </div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name / label (optional)" className={`${inputCls} mt-2 w-full`} />
        {roles.find((r) => r.id === role) && <p className="mt-2 text-[11px] text-white/40">{roles.find((r) => r.id === role)!.desc}</p>}
      </div>

      {admins && (
        <div className="space-y-2">
          {admins.map((a) => (
            <div key={a.address} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div>
                <div className="text-sm font-medium">{a.label || <span className="font-mono text-white/70">{a.address.slice(0,10)}…{a.address.slice(-6)}</span>}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                  <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">{a.role}</span>
                  <span className="font-mono">{a.address.slice(0,6)}…{a.address.slice(-4)}</span>
                  {a.addedAt === 0 && <span className="text-white/25">env owner</span>}
                </div>
              </div>
              {a.addedAt !== 0 && a.address !== me.actor && (
                <button onClick={() => remove(a)} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-300 hover:bg-red-500/25">Remove</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Audit log ----
interface AuditRow { at: number; actor: string; action: string; target?: string; detail?: string }
function AuditLog({ token }: { token: string }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/audit', { cache: 'no-store', headers: authHeaders(token) });
      if (res.ok) setRows((await res.json()).entries);
    } finally { setBusy(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const who = (a: string) => a === 'token' ? 'recovery token' : `${a.slice(0,6)}…${a.slice(-4)}`;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300/80">Audit log</h2>
        <button onClick={load} disabled={busy} className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 disabled:opacity-40">Refresh</button>
      </div>
      {rows && (rows.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm text-white/40">No admin actions recorded yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-white/40"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/50">{fmtAgo(r.at)}</td>
                  <td className="px-3 py-2 font-mono text-white/60">{who(r.actor)}</td>
                  <td className="px-3 py-2"><span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">{r.action}</span> {r.detail && <span className="text-white/40">{r.detail}</span>}</td>
                  <td className="px-3 py-2 font-mono text-white/50">{r.target ? `${r.target.slice(0,10)}…` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

// each tab lists the scope that gates it; the tab only renders if the
// signed-in admin's role has that scope
const TAB_DEFS = [
  { id: 'Home', scope: 'stats.view' },
  { id: 'Overview', scope: 'stats.view' },
  { id: 'Leaderboard', scope: 'players.view' },
  { id: 'Rewards', scope: 'rewards.view' },
  { id: 'Players', scope: 'players.view' },
  { id: 'Sponsors', scope: 'sponsors.manage' },
  { id: 'Content', scope: 'content.manage' },
  { id: 'Actions', scope: 'players.moderate' },
  { id: 'Admins', scope: 'admins.manage' },
  { id: 'Audit', scope: 'audit.view' },
] as const;
type Tab = (typeof TAB_DEFS)[number]['id'];

function Dashboard(p: DashboardProps) {
  const { token, setToken, me, signOut, stats, error, loading, load, t, lb, mk, lo } = p;
  const can = (s: string) => me.scopes.includes(s);
  const TABS = TAB_DEFS.filter((d) => can(d.scope)).map((d) => d.id) as Tab[];
  const { maxRuns, maxPilot, maxRev, maxItemRev, maxPilotRuns, maxDroneRuns } = p;
  const [tab, setTab] = useState<Tab>(TABS[0] || 'Home');

  const persistentWarn = stats && !stats.persistent;
  const shortActor = me.actor === 'token' ? 'recovery token' : `${me.actor.slice(0, 6)}…${me.actor.slice(-4)}`;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-[#0a0c12] via-[#080808] to-[#050608] text-white">
      {/* premium branded header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0c12]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Raid Shooter" className="h-8 w-auto" />
          <div className="mr-auto">
            <div className="text-sm font-bold tracking-[0.2em] text-white">TEAM CONSOLE</div>
            <div className="text-[11px] text-white/35">Manage the live game</div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <span className="rounded bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">{me.roleLabel}</span>
            <span className="font-mono text-[11px] text-white/40">{shortActor}</span>
          </div>
          <button onClick={() => load(token)} disabled={loading} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-40">{loading ? '…' : 'Refresh'}</button>
          <button onClick={signOut} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-red-500/20">Sign out</button>
        </div>
        {/* tab nav */}
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${tab === tb ? 'text-white' : 'text-white/40 hover:text-white/70'}`}>
              {tb}
              {tab === tb && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-cyan-400" />}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* these tabs render independently of the analytics payload */}
        {tab === 'Home' && <MissionControl token={token} me={me} go={setTab} />}
        {tab === 'Admins' && <AdminsManager token={token} me={me} />}
        {tab === 'Audit' && <AuditLog token={token} />}

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
                <FlaggedRuns token={token} />
                <WalletErrors token={token} />
                <ChatModeration token={token} />
                <GuestRecovery token={token} />
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
                <AIAssistant token={token} />
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
