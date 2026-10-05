'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Recover } from '@/components/command/Recover';
import { TIER_COLORS, tierFromScore, displayName } from '@/lib/tiers';
import { PilotIcon, type Cosmetics } from '@/components/PilotIcon';
import { WalletButton } from '@/components/WalletButton';
import { NAV } from '@/components/command/CommandCenter';
import { NavRail, TabBar } from '@/components/command/hud';
import { IconMail, IconSystem } from '@/components/command/icons';
import { withEngine } from '@/components/command/engine';
// the podium is fetched only when the board opens with a top three, so the
// game's boot bundle does not carry it
const Podium3D = lazy(() => import('@/components/three/Podium3D').then((m) => ({ default: m.Podium3D })));

// The DEFAULT in-game leaderboard. When the player opens SHOOTERBOARD the
// engine hands the screen to this overlay (window.__htmlBoard flags the canvas
// board off), so the one board everyone sees is the cool one - podium, tier
// colors, live refresh.
//
// It lives in the same command shell as the Hangar and the Armory: the header
// with the way back and the wallet, the rail with RANKINGS lit, the tab bar on
// a phone. The centre lane is the board itself (one podium, then the pack) and
// the side lane is YOUR standing, so the two never compete for one column and
// nothing floats over the rows.

interface Entry {
  address: string;
  name?: string;
  score: number;
  kills: number;
  pilot: string;
  verified?: boolean;
  /** $RAIDSHOOTER holder tier, when the server has one cached for the wallet */
  holder?: string;
  cosmetics?: Cosmetics;
}

interface CupSeason { id: string; name: string; endsAt: number | null; sponsorName: string | null }

const REFRESH_MS = 5_000;

const HOLDER_LABEL: Record<string, string> = { holder: 'Holder', commander: 'Commander', admiral: 'Admiral' };

/** $RAIDSHOOTER holder badge - gold is money in this palette; the chip fills
 *  in as the tier rises. Cosmetic: it never touches score or rank. */
function HolderChip({ tier }: { tier?: string }) {
  if (!tier || !HOLDER_LABEL[tier]) return null;
  return (
    <span
      className="rs-holder-chip"
      data-tier={tier}
      title={`$RAIDSHOOTER ${HOLDER_LABEL[tier]}`}
      aria-label={`$RAIDSHOOTER ${HOLDER_LABEL[tier]}`}
    >
      $
    </span>
  );
}

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
  const myRowRef = useRef<HTMLElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // whether the player's own row is on screen; when it is not, a copy of it
  // pins to the foot of the list so "where am I" never needs a scroll
  const [meInView, setMeInView] = useState(true);

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

  // A tapped RETRY and the refresh interval can land together, and React
  // batches `setLoading` so `disabled` alone cannot stop a double tap in the
  // same tick. A ref settles it synchronously.
  const inFlight = useRef(false);

  const fetchBoard = useCallback((which: 'all' | 'cup' | 'daily' | 'weekly') => {
    if (inFlight.current) return;
    inFlight.current = true;
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
          holder: typeof e.holder === 'string' ? e.holder : undefined,
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
      .finally(() => {
        inFlight.current = false;
        setLoading(false);
      });
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

  useEffect(() => {
    const el = myRowRef.current;
    if (!openState || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setMeInView(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [openState, entries, me, tab]);

  const go = useCallback((target: string) => {
    setMoreOpen(false);
    withEngine((e) => e.setState(target));
  }, []);

  if (!openState) return null;

  const podium = tab === 'all' ? entries.slice(0, 3) : [];
  const rest = tab === 'all' ? entries.slice(3) : entries;
  const cupLabel = season ? season.name : 'LIVE CUP';
  const myIndex = me ? entries.findIndex((e) => e.address === me) : -1;

  const jumpToMe = () => {
    myRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

  // What the number on each board means. All-time and weekly ADD every raid
  // (ZINCRBY); the cup keeps a pilot's best cup run; the daily run is one
  // attempt. The standing figure is labelled for what it is on each.
  const SCORE_LABEL: Record<typeof tab, [string, string]> = {
    all: ['Banked', 'every raid adds to this'],
    weekly: ['Banked this week', 'every raid this week adds'],
    cup: ['Cup best', 'your best cup run counts'],
    daily: ["Today's run", 'one attempt a day'],
  };
  const [scoreCap, scoreNote] = SCORE_LABEL[tab];
  const showTier = tab === 'all';
  // how close the next pilot up is, as a share of their score
  const chase = rival && myEntry && rival.score > 0 ? Math.max(0.04, Math.min(1, myEntry.score / rival.score)) : 0;

  const TABS: { id: typeof tab; label: string; gold?: boolean }[] = [
    { id: 'all', label: 'All-time' },
    ...(season ? [{ id: 'cup' as const, label: cupLabel.length > 12 ? 'Cup' : cupLabel, gold: true }] : []),
    { id: 'weekly', label: 'Weekly' },
    { id: 'daily', label: 'Daily' },
  ];

  const meta =
    tab === 'cup' && season
      ? `${season.sponsorName ? `With ${season.sponsorName} · ` : ''}${season.endsAt ? `Ends in ${timeLeft(season.endsAt)} · ` : ''}Only runs during the cup count`
      : tab === 'weekly'
        ? `Fresh board every Monday${weekResets ? ` · resets in ${timeLeft(weekResets)}` : ''}`
        : tab === 'daily'
          ? 'One seeded attempt per pilot, the same waves for everyone'
          : 'Every raid adds to your banked total';

  // the top three; the podium's 3D pedestals stand 2-1-3, and so do the plates
  const podiumMeta = [
    { label: 'CHAMPION', ring: '#ffd75e' },
    { label: 'RUNNER UP', ring: '#c9d1e8' },
    { label: 'THIRD', ring: '#d08a4a' },
  ];

  const name = (e: Entry, isMe: boolean) => (
    <>
      <span className="truncate">{displayName(e.name, e.address)}</span>
      {e.verified && <span className="rs-sb-ok" aria-label="Verified wallet">✓</span>}
      <HolderChip tier={e.holder} />
      {isMe && <span className="rs-sb-you">You</span>}
    </>
  );

  const row = (e: Entry, rank: number, pinned = false) => {
    const isMe = !!me && e.address === me;
    return (
      <div
        key={pinned ? 'pinned-me' : e.address}
        ref={isMe && !pinned ? (el) => { myRowRef.current = el; } : undefined}
        className="rs-sb-row"
        role="row"
        data-me={isMe ? '1' : '0'}
        data-top={rank <= 10 ? '1' : '0'}
        data-pinned={pinned ? '1' : undefined}
      >
        <span className="rs-sb-row-rank rs-num" role="cell">{String(rank).padStart(2, '0')}</span>
        <span className="rs-sb-row-pilot" role="cell">
          <PilotIcon cosmetics={e.cosmetics} size={18} pilotName={e.pilot} />
          <span className="rs-sb-row-name">{name(e, isMe)}</span>
        </span>
        <span className="rs-sb-row-kills rs-num" role="cell">{e.kills.toLocaleString()}</span>
        {showTier && <span className="rs-sb-row-tier" role="cell"><TierChip score={e.score} /></span>}
        <span className="rs-sb-row-score rs-num" role="cell" style={{ color: showTier ? TIER_COLORS[tierFromScore(e.score)] : undefined }}>
          {e.score.toLocaleString()}
        </span>
      </div>
    );
  };

  /*==========================================================================
  YOUR STANDING - the side lane on wide screens, the first block on a phone
  ==========================================================================*/
  const standing = (
    <section className="rs-sb-standing" aria-label="Your standing">
      {loading && !entries.length ? (
        <div className="rs-sb-stand rs-sb-stand-quiet">
          <span className="rs-am-wait-bar" aria-hidden />
          <span className="rs-sb-stand-msg">Reading the board…</span>
        </div>
      ) : boardError ? (
        /* Recoverable in place: the same fetchBoard() the refresh interval
           calls, aimed at the tab the player is already looking at, so
           retrying never changes what they were reading. */
        <div className="rs-sb-stand rs-sb-stand-quiet">
          <Recover
            message="Board unavailable — your standing cannot be read right now."
            busy={loading}
            onRetry={() => fetchBoard(tab)}
            tone="line"
          />
        </div>
      ) : !me ? (
        /* no identity yet - never guess at a position */
        <div className="rs-sb-stand rs-sb-stand-quiet">
          <span className="rs-sb-stand-msg">Post a run to take a place on the board.</span>
        </div>
      ) : myRank === 0 ? (
        <div className="rs-sb-stand rs-sb-stand-quiet">
          <span className="rs-sb-stand-msg">
            Not ranked yet{bestRun > 0 ? ` — your best is ${bestRun.toLocaleString()}` : ''}. Finish a raid to enter the board.
          </span>
          <button type="button" className="rs-btn rs-btn-solid rs-sb-cta" onClick={() => go('playmode')}>Launch a raid</button>
        </div>
      ) : (
        <div className="rs-sb-stand">
          <div className="rs-sb-stand-rank">
            <span className="rs-sb-cap">Your rank</span>
            <span className="rs-sb-rank rs-num">#{myRank}</span>
            <span className="rs-sb-of rs-num">of {total.toLocaleString()}</span>
          </div>

          {/* WHAT AM I CHASING - only when a real rival is really above */}
          {rival && gapToRival > 0 ? (
            <div className="rs-sb-target">
              <span className="rs-sb-cap">Next up · #{myRank - 1}</span>
              <span className="rs-sb-target-name">{displayName(rival.name, rival.address)}</span>
              <span className="rs-sb-chase" aria-hidden><span style={{ width: `${Math.round(chase * 100)}%` }} /></span>
              <span className="rs-sb-target-gap rs-num">+{gapToRival.toLocaleString()} to pass</span>
            </div>
          ) : myRank === 1 ? (
            <div className="rs-sb-target rs-sb-target-top">
              <span className="rs-sb-cap">Standing</span>
              <span className="rs-sb-target-name">Top of the board — defend it</span>
            </div>
          ) : null}

          <div className="rs-sb-stand-figs">
            <span className="rs-sb-fig">
              <span className="rs-sb-cap">{scoreCap}</span>
              <span className="rs-sb-val rs-num">{(myEntry?.score ?? 0).toLocaleString()}</span>
              <span className="rs-sb-note">{scoreNote}</span>
            </span>
            {bestRun > 0 && (
              <span className="rs-sb-fig">
                <span className="rs-sb-cap">Best run</span>
                <span className="rs-sb-val rs-num">{bestRun.toLocaleString()}</span>
                <span className="rs-sb-note">your record raid</span>
              </span>
            )}
            {showTier && (
              <span className="rs-sb-fig">
                <span className="rs-sb-cap">Tier</span>
                <span className="rs-sb-val rs-sb-tier"><TierChip score={myEntry?.score ?? 0} /></span>
              </span>
            )}
          </div>

          <button type="button" onClick={jumpToMe} className="rs-btn rs-btn-gold rs-sb-jump">
            Jump to me · #{myRank}
          </button>
        </div>
      )}
    </section>
  );

  const myPinned = myEntry && myRank > (podium.length === 3 ? 3 : 0) && !meInView;

  return (
    <div data-game-ui="" className="rs-cc rs-sb">
      <div aria-hidden className="rs-cc-veil rs-sb-veil" />
      {/* no animated backdrop of its own: like the Hangar and the Armory the
          board lets the engine's starfield through the veil. A full-screen
          blurred combat canvas under the shell's frosted header and tab bar
          cost a phone over a second a frame. */}

      <header className="rs-cc-top rs-sb-top">
        <div className="rs-hg-where">
          <button type="button" className="rs-hg-back" onClick={() => go('menu')} aria-label="Back to command deck">
            <span aria-hidden>‹</span>
          </button>
          <span className="rs-hg-title">Rankings</span>
          <span className="rs-hg-bay">
            <span className="rs-hg-bay-cap">Ranked</span>
            <span className="rs-num">{total.toLocaleString()}</span>
          </span>
          <span className="rs-sb-live" data-on={boardError ? '0' : '1'}>
            <span className="rs-sb-live-dot" aria-hidden />
            {boardError ? 'Offline' : 'Live'}
          </span>
        </div>
        <div className="rs-hud-wallet"><WalletButton /></div>
      </header>

      <NavRail
        nav={NAV}
        active="rankings"
        onGo={go}
        onHome={() => go('menu')}
        onInvite={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'invite' }))}
        onFeedback={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'feedback' }))}
      />

      <main className="rs-cc-main rs-sb-main rs-scroll">
        <div className="rs-sb-col">
          <div className="rs-sb-head">
            <div className="rs-sb-head-text">
              <h1 className="rs-sb-title" data-tab={tab}>
                {tab === 'cup' ? cupLabel : tab === 'daily' ? 'Daily run' : tab === 'weekly' ? 'Weekly ladder' : <>Shooter<span>board</span></>}
              </h1>
              <p className="rs-sb-meta">{meta}</p>
            </div>
            <div className="rs-sb-tabs" role="tablist" aria-label="Board">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  data-on={tab === t.id ? '1' : '0'}
                  data-gold={t.gold ? '1' : undefined}
                  className="rs-sb-tab"
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {entries.length === 0 ? (
            /* An empty list and a FAILED list are not the same claim. When the
               fetch failed we do not know whether anyone is ranked; the Recover
               bar in the standing block owns the message and the retry. */
            boardError ? null : (
              <div className="rs-board-empty">
                {loading ? 'Loading…' : tab === 'cup' ? 'No cup runs yet — play to enter' : tab === 'daily' ? 'No daily runs yet — one seeded attempt per day' : tab === 'weekly' ? 'No runs this week yet — fresh board, claim it' : 'No pilots ranked yet'}
              </div>
            )
          ) : (
            <>
              {podium.length === 3 && (
                <section className="rs-sb-stage" aria-label="Top three">
                  {/* the top three standing in their own planes; skipped on
                      short landscape screens, where it would push every ranked
                      row off the first screen */}
                  <div className="rs-sb-podium3d">
                    <Suspense fallback={null}>
                      <Podium3D top={podium} className="rs-sb-podium-canvas" />
                    </Suspense>
                  </div>
                  <ol className="rs-sb-plates">
                    {[1, 0, 2].map((pi) => {
                      const e = podium[pi];
                      const m = podiumMeta[pi];
                      const isMe = !!me && e.address === me;
                      return (
                        <li
                          key={e.address}
                          ref={isMe ? (el) => { myRowRef.current = el; } : undefined}
                          className="rs-sb-plate"
                          data-place={pi + 1}
                          data-me={isMe ? '1' : '0'}
                          style={{ ['--ring' as string]: m.ring }}
                        >
                          <span className="rs-sb-plate-cap">{m.label}</span>
                          <span className="rs-sb-plate-name">
                            <PilotIcon cosmetics={e.cosmetics} size={pi === 0 ? 20 : 16} pilotName={e.pilot} />
                            {name(e, isMe)}
                          </span>
                          <span className="rs-sb-plate-score rs-num">{e.score.toLocaleString()}</span>
                          <span className="rs-sb-plate-foot">
                            <TierChip score={e.score} />
                            <span className="rs-num">{e.kills.toLocaleString()} kills</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              {rest.length > 0 && (
                <div className="rs-sb-list" role="table" aria-label="Rankings" data-tier={showTier ? '1' : '0'}>
                  <div className="rs-sb-row rs-sb-row-head" role="row">
                    <span role="columnheader">Rank</span>
                    <span role="columnheader">Pilot</span>
                    <span role="columnheader" className="rs-sb-row-kills">Kills</span>
                    {showTier && <span role="columnheader" className="rs-sb-row-tier">Tier</span>}
                    <span role="columnheader" className="rs-sb-row-score">Score</span>
                  </div>
                  {rest.map((e, i) => row(e, (podium.length === 3 ? 4 : 1) + i))}
                  {myPinned && myEntry && row(myEntry, myRank, true)}
                </div>
              )}
              <p className="rs-sb-fine">{total.toLocaleString()} pilot{total === 1 ? '' : 's'} ranked — every score earned, never bought.</p>
            </>
          )}
        </div>
      </main>

      <aside className="rs-cc-ops rs-sb-ops">{standing}</aside>

      <TabBar nav={NAV} active="rankings" moreOpen={moreOpen} onGo={go} onMore={() => setMoreOpen((v) => !v)} />

      {moreOpen && (
        <>
          <div className="rs-cc-scrim" onClick={() => setMoreOpen(false)} />
          <div className="rs-cc-sheet rs-rise">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
            <button className="rs-nav-item" onClick={() => go('menu')}>
              <span className="rs-nav-icon">‹</span><span>Command deck</span>
            </button>
            <button className="rs-nav-item" onClick={() => go('settings')}>
              <span className="rs-nav-icon"><IconSystem /></span><span>System</span>
            </button>
            <button className="rs-nav-item" onClick={() => { setMoreOpen(false); window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'inbox' })); }}>
              <span className="rs-nav-icon"><IconMail /></span><span>Inbox</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
