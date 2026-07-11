'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TIER_COLORS, tierFromScore, displayName } from '@/lib/tiers';
import { BoardBackdrop } from '@/components/BoardBackdrop';
import { PilotIcon, type Cosmetics } from '@/components/PilotIcon';

// The DEFAULT in-game leaderboard. When the player opens SHOOTERBOARD the
// engine hands the screen to this overlay (window.__htmlBoard flags the canvas
// board off), so the one board everyone sees is the cool one - podium, tier
// colors, live refresh - identical inside the game and at /leaderboard.

interface Entry {
  address: string;
  name?: string;
  score: number;
  kills: number;
  pilot: string;
  verified?: boolean;
  cosmetics?: Cosmetics;
}

interface CupSeason { id: string; name: string; endsAt: number | null; sponsorName: string | null }

const REFRESH_MS = 15_000;

function TierChip({ score }: { score: number }) {
  const tier = tierFromScore(score);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-black tracking-widest"
      style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}1a`, border: `1px solid ${TIER_COLORS[tier]}40` }}
    >
      {tier}
    </span>
  );
}

function timeLeft(endsAt: number | null): string {
  if (!endsAt) return '';
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'ENDED';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}D ${h}H` : h > 0 ? `${h}H ${m}M` : `${m}M`;
}

// today's key in the same local-date format the game engine uses (daily.js)
function dailyKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function BoardOverlay() {
  const [openState, setOpenState] = useState(false);
  const [tab, setTab] = useState<'all' | 'cup' | 'daily' | 'weekly'>('all');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [me, setMe] = useState<string | null>(null);
  const [season, setSeason] = useState<CupSeason | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [weekResets, setWeekResets] = useState<number | null>(null);
  const myRowRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // the engine flags the canvas board off and this overlay on
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlBoard = 1;
    const onState = (e: Event) => {
      const s = (e as CustomEvent).detail;
      setOpenState(s === 'board');
    };
    window.addEventListener('raidshooter:state', onState as EventListener);

    // Belt-and-suspenders: also POLL the live engine state. If this component
    // mounts after the engine already entered 'board', or the state event was
    // missed / an older engine build never re-dispatched it, the event alone
    // would leave the overlay closed while the canvas board is gated off -
    // i.e. an EMPTY leaderboard ("people not showing"). Polling $.state makes
    // the overlay always reflect reality.
    const iv = setInterval(() => {
      const st = (window as unknown as { $?: { state?: string } }).$?.state;
      if (st === 'board' || st === 'menu' || st === 'play') {
        setOpenState((prev) => (st === 'board') !== prev ? st === 'board' : prev);
      }
    }, 300);

    return () => {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      clearInterval(iv);
    };
  }, []);

  const fetchBoard = useCallback((which: 'all' | 'cup' | 'daily' | 'weekly') => {
    setLoading(true);
    const url =
      which === 'cup' ? '/api/cup'
      : which === 'daily' ? `/api/dailyrun?day=${dailyKey()}`
      : which === 'weekly' ? '/api/weekly'
      : '/api/leaderboard?limit=1000';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        // daily entries are keyed `identity` (wallet or guest id); normalize
        // to the Entry shape the renderer uses
        const rows: Entry[] = (d.entries || []).map((e: Record<string, unknown>) => ({
          address: (e.address as string) || (e.identity as string) || '',
          name: e.name as string | undefined,
          score: (e.score as number) || 0,
          kills: (e.kills as number) || 0,
          pilot: (e.pilot as string) || '',
          verified: !!e.verified,
          cosmetics: e.cosmetics as Cosmetics | undefined,
        }));
        setEntries(rows);
        setTotal(typeof d.total === 'number' ? d.total : rows.length);
        if (which === 'cup' && d.season) setSeason(d.season);
        if (which === 'weekly' && d.resetsAt) setWeekResets(d.resetsAt);
        setUpdatedAt(Date.now());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // on open: session identity (own-row highlight), season (cup tab), board
  useEffect(() => {
    if (!openState) return;
    fetch('/api/siwe/session')
      .then((r) => r.json())
      .then((d) => setMe(d.authenticated && d.address ? d.address.toLowerCase() : d.guestId || null))
      .catch(() => {});
    fetch('/api/season')
      .then((r) => r.json())
      .then((d) => setSeason(d.season && d.season.live ? { id: d.season.id, name: d.season.name, endsAt: d.season.endsAt, sponsorName: d.season.sponsorName } : null))
      .catch(() => {});
    fetchBoard(tab);
    const iv = setInterval(() => fetchBoard(tab), REFRESH_MS);
    return () => clearInterval(iv);
  }, [openState, tab, fetchBoard]);

  if (!openState) return null;

  const podium = tab === 'all' ? entries.slice(0, 3) : [];
  const rest = tab === 'all' ? entries.slice(3) : entries;
  const cupLabel = season ? season.name : 'LIVE CUP';
  const myIndex = me ? entries.findIndex((e) => e.address === me) : -1;

  const jumpToMe = () => {
    myRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const toMenu = () => {
    try { (window as unknown as { $: { setState: (s: string) => void } }).$.setState('menu'); } catch { /* engine not ready */ }
  };

  const podiumMeta = [
    { label: 'CHAMPION', ring: '#ffd75e', glow: 'rgba(255,215,94,0.14)' },
    { label: 'RUNNER UP', ring: '#c9d1e8', glow: 'rgba(201,209,232,0.10)' },
    { label: 'THIRD', ring: '#d08a4a', glow: 'rgba(208,138,74,0.10)' },
  ];

  return (
    <div
      data-game-ui=""
      className="fixed inset-0 z-40 flex flex-col text-white"
      style={{
        background:
          'radial-gradient(900px 450px at 80% -10%, rgba(51,230,255,0.07), transparent 60%),' +
          'radial-gradient(700px 350px at 10% 110%, rgba(255,215,94,0.05), transparent 55%), #06070c',
      }}
    >
      {/* ambient blurred combat behind the rows: ships firing at enemies */}
      <BoardBackdrop />

      {/* scanlines */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px)' }} />

      {/* header: title on its own line, controls beneath it - keeps the
          top-right corner clear of the site's Connect Wallet button */}
      <div className="relative z-10 px-4 pb-2 pt-4 sm:px-8">
        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-cyan-300">Live rankings</div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl" style={{ textShadow: '0 0 24px rgba(51,230,255,0.25)' }}>
          {tab === 'cup' ? (
            <span className="text-amber-300">{cupLabel.toUpperCase()}</span>
          ) : tab === 'daily' ? (
            <span className="text-sky-300">DAILY RUN</span>
          ) : tab === 'weekly' ? (
            <span className="text-emerald-300">WEEKLY LADDER</span>
          ) : (
            <>SHOOTER<span className="text-cyan-300">BOARD</span></>
          )}
        </h1>
        <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-white/15 text-[11px] font-black uppercase tracking-wider">
          <button onClick={() => setTab('all')} className={`px-3 py-1.5 ${tab === 'all' ? 'bg-cyan-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>All-time</button>
          {season && (
            <button onClick={() => setTab('cup')} className={`px-3 py-1.5 ${tab === 'cup' ? 'bg-amber-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>{cupLabel.length > 12 ? 'Cup' : cupLabel}</button>
          )}
          <button onClick={() => setTab('weekly')} className={`px-3 py-1.5 ${tab === 'weekly' ? 'bg-emerald-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>Weekly</button>
          <button onClick={() => setTab('daily')} className={`px-3 py-1.5 ${tab === 'daily' ? 'bg-sky-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>Daily</button>
        </div>
      </div>

      {/* cup meta strip */}
      {tab === 'cup' && season && (
        <div className="relative z-10 px-4 pb-1 text-[11px] font-mono text-amber-200/80 sm:px-8">
          {season.sponsorName ? `WITH ${season.sponsorName.toUpperCase()} · ` : ''}
          {season.endsAt ? `ENDS IN ${timeLeft(season.endsAt)} · ` : ''}ONLY RUNS DURING THE CUP COUNT
        </div>
      )}

      {/* weekly meta strip */}
      {tab === 'weekly' && weekResets && (
        <div className="relative z-10 px-4 pb-1 font-mono text-[11px] text-emerald-200/80 sm:px-8">
          FRESH BOARD EVERY MONDAY · RESETS IN {timeLeft(weekResets)}
        </div>
      )}

      {/* board body */}
      <div ref={listRef} className="relative z-10 flex-1 overflow-y-auto px-4 pb-24 pt-3 sm:px-8">
        {entries.length === 0 ? (
          <div className="mt-16 text-center text-sm text-white/50">
            {loading ? 'LOADING…' : tab === 'cup' ? 'NO CUP RUNS YET — PLAY TO ENTER' : tab === 'daily' ? 'NO DAILY RUNS YET — ONE SEEDED ATTEMPT PER DAY' : tab === 'weekly' ? 'NO RUNS THIS WEEK YET — FRESH BOARD, CLAIM IT' : 'NO PILOTS RANKED YET'}
          </div>
        ) : (
          <>
            {podium.length === 3 && (
              <div className="mx-auto mb-5 flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end">
                {[1, 0, 2].map((pi) => {
                  const e = podium[pi];
                  const m = podiumMeta[pi];
                  const isMe = me && e.address === me;
                  return (
                    <div
                      key={e.address}
                      ref={isMe ? myRowRef : undefined}
                      className={`flex-1 rounded-xl border p-3 text-center ${pi === 0 ? 'sm:-mt-3' : ''}`}
                      style={{ borderColor: isMe ? '#ffd75e' : `${m.ring}55`, background: `linear-gradient(180deg, ${m.glow}, rgba(10,12,20,0.6))` }}
                    >
                      <div className="text-[9px] font-black tracking-[0.3em]" style={{ color: m.ring }}>{m.label}</div>
                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        <PilotIcon cosmetics={e.cosmetics} size={20} pilotName={e.pilot} />
                        <span className="truncate text-base font-extrabold tracking-wide">
                          {displayName(e.name, e.address)}
                          {e.verified && <span className="ml-1 text-cyan-300">✓</span>}
                          {isMe && <span className="ml-1 text-amber-300">· YOU</span>}
                        </span>
                      </div>
                      <div className="font-mono text-xl font-black tabular-nums" style={{ color: m.ring }}>{e.score.toLocaleString()}</div>
                      <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-white/40">
                        <TierChip score={e.score} /><span>{e.kills.toLocaleString()} kills</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {rest.map((e, i) => {
                const rank = (podium.length === 3 ? 4 : 1) + i;
                const isMe = me && e.address === me;
                return (
                  <div
                    key={e.address}
                    ref={isMe ? myRowRef : undefined}
                    className={`grid grid-cols-[2.6rem_1fr_auto] items-center gap-2 border-t border-white/[0.04] px-3 py-2 text-sm first:border-t-0 sm:grid-cols-[3rem_1fr_5.5rem_6.5rem] ${isMe ? 'bg-amber-400/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <span className="font-mono text-white/40 tabular-nums">{String(rank).padStart(2, '0')}</span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold tracking-wide">
                      <PilotIcon cosmetics={e.cosmetics} size={18} pilotName={e.pilot} />
                      <span className="truncate">
                        {displayName(e.name, e.address)}
                        {e.verified && <span className="ml-1 text-cyan-300">✓</span>}
                        {isMe && <span className="ml-1.5 text-[10px] font-black text-amber-300">YOU</span>}
                      </span>
                    </span>
                    <span className="hidden sm:block"><TierChip score={e.score} /></span>
                    <span className="text-right font-mono font-bold tabular-nums" style={{ color: TIER_COLORS[tierFromScore(e.score)] }}>{e.score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-white/30">{total.toLocaleString()} pilot{total === 1 ? '' : 's'} ranked — every score earned, never bought.</p>
          </>
        )}
      </div>

      {/* footer actions */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-8">
        {myIndex >= 0 && (
          <button onClick={jumpToMe} className="pointer-events-auto rounded-lg border border-amber-300/40 bg-amber-400/15 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-amber-200 hover:bg-amber-400/25">
            Jump to me · #{myIndex + 1}
          </button>
        )}
        <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300/90">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {loading ? 'Live · syncing' : updatedAt ? `Live · ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Live'}
        </span>
        <button
          onClick={() => fetchBoard(tab)}
          disabled={loading}
          className="pointer-events-auto rounded-lg border border-white/20 bg-white/[0.06] px-5 py-2 text-[11px] font-black uppercase tracking-wider text-white/80 hover:bg-white/[0.12] disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
        <button onClick={toMenu} className="pointer-events-auto rounded-lg bg-cyan-400 px-6 py-2 text-[11px] font-black uppercase tracking-wider text-black hover:bg-cyan-300">
          Back to menu
        </button>
      </div>
    </div>
  );
}
