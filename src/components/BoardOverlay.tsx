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

const REFRESH_MS = 5_000;

function TierChip({ score }: { score: number }) {
  const tier = tierFromScore(score);
  return (
    <span className="rs-badge" style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}1a` }}>
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
  // A failed fetch and an empty board are different facts. Without this the
  // standing block said "not ranked yet" when the board was simply down -
  // asserting a competitive position we had no way to know.
  const [boardError, setBoardError] = useState(false);
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
      .then((r) => {
        if (!r.ok) throw new Error('board_unavailable');
        return r.json();
      })
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
        setBoardError(false);
      })
      .catch(() => setBoardError(true))
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

  /*==========================================================================
  YOUR STANDING

  The board opened straight onto a list of strangers. The first question a
  competitive screen has to answer is "where am I", so that is now the first
  thing on it.

  A CRITICAL DISTINCTION, and the reason this block is worded carefully:
  the Shooterboard does NOT rank by best run. submitEntry() does a ZINCRBY, so
  every run ADDS to a cumulative total, and it is that total which sets your
  rank. Your best single raid ($.storage.score) is a different number that has
  no direct bearing on your position. Showing them side by side without saying
  so would imply a relationship that does not exist, so they are labelled for
  what they each actually are: BANKED (what ranks you) and BEST RUN (your
  record). Everything here is derived from the same `entries` array the list
  below renders - no second source, nothing computed server-side that the
  client then re-guesses.
  ==========================================================================*/
  const myEntry = myIndex >= 0 ? entries[myIndex] : null;
  const myRank = myIndex >= 0 ? myIndex + 1 : 0;
  const rival = myIndex > 0 ? entries[myIndex - 1] : null;
  // only a real gap, against the same cumulative quantity the board ranks on
  const gapToRival = rival && myEntry && rival.score > myEntry.score
    ? rival.score - myEntry.score + 1
    : 0;
  // the local best-run record, read from the engine's own storage
  const bestRun = (() => {
    try {
      const st = (window as unknown as { $?: { storage?: Record<string, number> } }).$?.storage;
      return Number(st?.['score'] || 0);
    } catch { return 0; }
  })();

  // The champion is not "one of three". Their card is taller, wider, lit, and
  // carries a bigger number - a player scanning this board should be able to
  // tell who is winning from across the room, without reading a rank.
  const podiumMeta = [
    { label: 'CHAMPION', ring: '#ffd75e', glow: 'rgba(255,215,94,0.18)' },
    { label: 'RUNNER UP', ring: '#c9d1e8', glow: 'rgba(201,209,232,0.09)' },
    { label: 'THIRD', ring: '#d08a4a', glow: 'rgba(208,138,74,0.09)' },
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
      {/* standing block is rendered below the header - see rs-sb-standing */}

      {/* a whisper of scanline texture - a third of what was here, so rows
          and scores read as clean type rather than through a screen door */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.012) 0 1px, transparent 1px 4px)' }} />

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
        <div className="rs-cut-sm mt-2 inline-flex overflow-hidden border border-white/15 text-[11px] font-black uppercase tracking-wider">
          <button onClick={() => setTab('all')} className={`px-3 py-1.5 ${tab === 'all' ? 'bg-cyan-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>All-time</button>
          {season && (
            <button onClick={() => setTab('cup')} className={`px-3 py-1.5 ${tab === 'cup' ? 'bg-amber-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>{cupLabel.length > 12 ? 'Cup' : cupLabel}</button>
          )}
          <button onClick={() => setTab('weekly')} className={`px-3 py-1.5 ${tab === 'weekly' ? 'bg-emerald-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>Weekly</button>
          <button onClick={() => setTab('daily')} className={`px-3 py-1.5 ${tab === 'daily' ? 'bg-sky-400 text-black' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>Daily</button>
        </div>
      </div>

      {/*====================================================================
      YOUR STANDING — the first thing on a competitive screen
      ====================================================================*/}
      <div className="rs-sb-standing relative z-10 px-4 sm:px-8">
        {loading && !entries.length ? (
          <div className="rs-sb-stand rs-sb-stand-quiet">
            <span className="rs-am-wait-bar" aria-hidden />
            <span className="rs-sb-stand-msg">Reading the board…</span>
          </div>
        ) : boardError ? (
          <div className="rs-sb-stand rs-sb-stand-quiet">
            <span className="rs-sb-stand-msg rs-sb-stand-err">
              Board unavailable — your standing cannot be read right now.
            </span>
          </div>
        ) : !me ? (
          /* no identity yet - never guess at a position */
          <div className="rs-sb-stand rs-sb-stand-quiet">
            <span className="rs-sb-stand-msg">Post a run to take a place on the board.</span>
          </div>
        ) : myRank === 0 ? (
          <div className="rs-sb-stand rs-sb-stand-quiet">
            <span className="rs-sb-stand-msg">
              Not ranked yet{bestRun > 0 ? ` — your best run is ${bestRun.toLocaleString()}` : ''}. Finish a raid to enter the board.
            </span>
          </div>
        ) : (
          <div className="rs-sb-stand">
            <div className="rs-sb-stand-rank">
              <span className="rs-sb-cap">Your rank</span>
              <span className="rs-sb-rank rs-num">#{myRank}</span>
              <span className="rs-sb-of rs-num">of {total.toLocaleString()}</span>
            </div>

            <div className="rs-sb-stand-figs">
              {/* BANKED is what ranks you: the board is a cumulative ladder
                  (ZINCRBY), not a best-run ladder. */}
              <span className="rs-sb-fig">
                <span className="rs-sb-cap">Banked</span>
                <span className="rs-sb-val rs-num">{(myEntry?.score ?? 0).toLocaleString()}</span>
                <span className="rs-sb-note">every raid adds to this</span>
              </span>
              {bestRun > 0 && (
                <span className="rs-sb-fig">
                  <span className="rs-sb-cap">Best run</span>
                  <span className="rs-sb-val rs-num">{bestRun.toLocaleString()}</span>
                  <span className="rs-sb-note">your record raid</span>
                </span>
              )}
              <span className="rs-sb-fig">
                <span className="rs-sb-cap">Tier</span>
                <span className="rs-sb-val rs-sb-tier">
                  <TierChip score={myEntry?.score ?? 0} />
                </span>
              </span>
            </div>

            {/* WHAT AM I CHASING - only when a real rival is really above */}
            {rival && gapToRival > 0 ? (
              <div className="rs-sb-target">
                <span className="rs-sb-cap">Next up · #{myRank - 1}</span>
                <span className="rs-sb-target-name">{displayName(rival.name, rival.address)}</span>
                <span className="rs-sb-target-gap rs-num">+{gapToRival.toLocaleString()} to pass</span>
              </div>
            ) : myRank === 1 ? (
              <div className="rs-sb-target rs-sb-target-top">
                <span className="rs-sb-cap">Standing</span>
                <span className="rs-sb-target-name">Top of the board — defend it</span>
              </div>
            ) : null}
          </div>
        )}
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
              /* On a phone the old stack cost three full screens of scrolling
                 before a single ranked row appeared. The champion keeps the
                 full width they have earned; second and third pair up beneath
                 in a compact two-up, and the list starts inside one screen. */
              <div className="mx-auto mb-5 grid max-w-3xl grid-cols-2 gap-2 sm:flex sm:items-end">
                {[0, 1, 2].map((pi) => {
                  const e = podium[pi];
                  const m = podiumMeta[pi];
                  const isMe = me && e.address === me;
                  const champion = pi === 0;
                  return (
                    <div
                      key={e.address}
                      ref={isMe ? myRowRef : undefined}
                      className={`rs-cut relative overflow-hidden border p-3 text-center ${
                        champion
                          ? 'col-span-2 sm:order-2 sm:-mt-6 sm:flex-[1.45] sm:pb-5 sm:pt-5'
                          : pi === 1
                            ? 'sm:order-1 sm:flex-1'
                            : 'sm:order-3 sm:flex-1'
                      }`}
                      style={{
                        borderColor: isMe ? '#ffd75e' : `${m.ring}${champion ? '99' : '44'}`,
                        background: `linear-gradient(180deg, ${m.glow}, rgba(8,11,18,0.72))`,
                        boxShadow: champion ? `0 0 44px -14px ${m.ring}` : undefined,
                      }}
                    >
                      {/* the champion's own light, spilling up out of the card */}
                      {champion && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 -top-16 h-32"
                          style={{ background: `radial-gradient(closest-side, ${m.ring}33, transparent 70%)` }}
                        />
                      )}
                      <div className="rs-label relative" style={{ color: m.ring, letterSpacing: champion ? '0.4em' : '0.3em' }}>
                        {m.label}
                      </div>
                      {/* the pilot's actual loadout, not just a label - the
                          champion's cosmetics are the first thing you see */}
                      <div
                        className={`relative mx-auto mt-2 flex items-center justify-center rounded-full border-2 bg-black/40 ${
                          champion ? 'h-16 w-16' : 'h-9 w-9 sm:h-11 sm:w-11'
                        }`}
                        style={{
                          borderColor: isMe ? '#ffd75e' : m.ring,
                          boxShadow: champion ? `0 0 26px -6px ${m.ring}` : undefined,
                        }}
                      >
                        <PilotIcon cosmetics={e.cosmetics} size={champion ? 38 : 22} />
                        <span
                          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border bg-[#0b0e16] text-[9px] font-black"
                          style={{ borderColor: m.ring, color: m.ring }}
                        >
                          {pi + 1}
                        </span>
                      </div>
                      <div className="relative mt-2 flex items-center justify-center gap-1.5">
                        <span className={`truncate font-extrabold tracking-wide ${champion ? 'rs-display text-lg' : 'text-sm sm:text-base'}`}>
                          {displayName(e.name, e.address)}
                          {e.verified && <span className="ml-1 text-[color:var(--rs-cyan)]">✓</span>}
                          {isMe && <span className="ml-1 text-[color:var(--rs-gold)]">· YOU</span>}
                        </span>
                      </div>
                      <div
                        className={`rs-num relative ${champion ? 'text-3xl' : 'text-base sm:text-xl'}`}
                        style={{ color: m.ring, textShadow: champion ? `0 0 24px ${m.ring}66` : undefined }}
                      >
                        {e.score.toLocaleString()}
                      </div>
                      <div className="relative mt-1.5 flex items-center justify-center gap-2 text-[10px] text-white/40">
                        <TierChip score={e.score} /><span>{e.kills.toLocaleString()} kills</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* The pack. Three bands the eye can read without counting: the
                TOP 10 carry a lit edge and a bright rank, everyone below is
                plain, and the player's own row overrides both in gold so they
                can find themselves in a thousand-row list at a glance. */}
            <div className="rs-panel rs-cut mx-auto max-w-3xl overflow-hidden">
              {rest.map((e, i) => {
                const rank = (podium.length === 3 ? 4 : 1) + i;
                const isMe = me && e.address === me;
                const topTen = rank <= 10;
                return (
                  <div
                    key={e.address}
                    ref={isMe ? myRowRef : undefined}
                    className={`relative grid grid-cols-[2.6rem_1fr_auto] items-center gap-2 border-t border-white/[0.04] px-3 py-2 text-sm first:border-t-0 sm:grid-cols-[3rem_1fr_5.5rem_6.5rem] ${
                      isMe ? 'bg-[rgba(255,207,77,0.12)]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* contender edge - lit for the top ten, gold for you */}
                    {(topTen || isMe) && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-0 w-0.5 rounded-full"
                        style={{
                          background: isMe ? 'var(--rs-gold)' : 'var(--rs-cyan)',
                          boxShadow: `0 0 8px ${isMe ? 'var(--rs-gold)' : 'var(--rs-cyan)'}`,
                          opacity: isMe ? 1 : 0.75,
                        }}
                      />
                    )}
                    <span className={`rs-num tabular-nums ${topTen ? 'text-white/75' : 'text-white/35'}`}>
                      {String(rank).padStart(2, '0')}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold tracking-wide">
                      <PilotIcon cosmetics={e.cosmetics} size={18} pilotName={e.pilot} />
                      <span className="truncate">
                        {displayName(e.name, e.address)}
                        {e.verified && <span className="ml-1 text-[color:var(--rs-cyan)]">✓</span>}
                        {isMe && <span className="ml-1.5 text-[10px] font-black text-[color:var(--rs-gold)]">YOU</span>}
                      </span>
                    </span>
                    <span className="hidden sm:block"><TierChip score={e.score} /></span>
                    <span className="rs-num text-right" style={{ color: TIER_COLORS[tierFromScore(e.score)] }}>
                      {e.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-white/30">{total.toLocaleString()} pilot{total === 1 ? '' : 's'} ranked — every score earned, never bought.</p>
          </>
        )}
      </div>

      {/* footer actions */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 px-4 pb-5 pt-14"
        style={{ background: 'linear-gradient(to top, rgba(4,6,11,0.97) 34%, rgba(4,6,11,0.75) 62%, transparent)' }}
      >
        {myIndex >= 0 && (
          <button onClick={jumpToMe} className="rs-btn rs-btn-gold pointer-events-auto">
            Jump to me · #{myIndex + 1}
          </button>
        )}
        <button onClick={toMenu} className="rs-btn rs-btn-solid pointer-events-auto">
          Back to command
        </button>
      </div>
    </div>
  );
}
