'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/*==============================================================================
Debrief

The end of a run is the single biggest progression moment the game has, so it
is built to pay the player rather than just report a number at them:

  1. the score, big, with a personal-best callout when it earned one
  2. what it CHANGED - pilot XP banked, the level bar moved, rank taken
  3. what it nearly changed - the points behind the next rank, the hook
  4. the numbers, and the build that produced them
  5. one obvious way back in

It reads the finished run straight off the engine and drives it back via
$.setState.
==============================================================================*/

interface Engine {
  score: number;
  kills: number;
  bestCombo: number;
  level: { current: number };
  elapsed: number;
  runWasBest?: boolean;
  runXp?: number;
  runAssisted?: boolean;
  dailyRunActive?: number;
  dailyResult?: { xp: number; streak: number } | null;
  boardSubmit?: { state: string; rank?: number; improved?: boolean; verified?: boolean; gap?: number; nextRank?: number };
  storage: Record<string, unknown>;
  upgrades: Record<string, number>;
  definitions: { upgrades: { id: string; title: string }[] };
  hero?: { character?: { id: string; title: string } };
  dailyChallenge?: () => { text: string; stat: string; n: number };
  dailyStreak?: () => number;
  dailyRunStats?: () => Record<string, number>;
  pilotLevel?: (id: string) => number;
  pilotXp?: (id: string) => number;
  pilotMaxLevel?: number;
  pilotLevelThresholds?: number[];
  tierFor?: (score: number) => { name: string; color: string };
  reset: () => void;
  setState: (s: string) => void;
  trackRun: (e: string, d?: number) => void;
  audio: { play: (s: string) => void };
  shareRunCard: () => void;
}

function eng(): Engine | null {
  return (typeof window !== 'undefined' ? (window as unknown as { $?: Engine }).$ : null) || null;
}

function fmt(n: number): string {
  return (n || 0).toLocaleString();
}
function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

interface Snap {
  score: number; kills: number; combo: number; level: number; time: number;
  name: string; pilot: string;
  best: boolean; assisted: boolean; daily: boolean;
  dailyResult: { xp: number; streak: number } | null;
  board: string; rank: number; improved: boolean; verified: boolean; gap: number; nextRank: number;
  build: string[];
  dailyText: string;
  dailyNear: { have: number; need: number } | null;
  streak: number;
  xp: number;
  pilotTitle: string;
  pilotLevel: number;
  pilotMaxLevel: number;
  xpInto: number;
  xpSpan: number;
  tierName: string;
  tierColor: string;
}

function snapshot(): Snap | null {
  const $ = eng();
  if (!$) return null;
  const bs = $.boardSubmit || { state: '' };
  const build: string[] = [];
  try {
    for (const def of $.definitions.upgrades) {
      const owned = $.upgrades[def.id] || 0;
      if (owned > 0) build.push(def.title + (owned > 1 ? ` ×${owned}` : ''));
    }
  } catch { /* upgrades not ready */ }
  return {
    score: $.score || 0,
    kills: $.kills || 0,
    combo: $.bestCombo || 0,
    level: ($.level?.current ?? 0) + 1,
    time: ($.elapsed * (1000 / 60)) / 1000,
    name: (($.storage?.pilotname as string) || 'PILOT').toString().toUpperCase(),
    pilot: '',
    best: !!$.runWasBest,
    assisted: !!$.runAssisted,
    daily: !!$.dailyRunActive,
    dailyResult: $.dailyResult || null,
    board: bs.state || '',
    rank: bs.rank || 0,
    improved: !!bs.improved,
    verified: !!bs.verified,
    gap: bs.gap || 0,
    nextRank: bs.nextRank || 0,
    build,
    dailyText: (() => {
      try {
        return $.dailyChallenge ? $.dailyChallenge().text : '';
      } catch { return ''; }
    })(),
    streak: (() => {
      try { return $.dailyStreak ? $.dailyStreak() : 0; } catch { return 0; }
    })(),
    /* How close this run actually got. The engine already compares these two
       numbers to decide completion ($.dailyCheckRun), so showing them invents
       nothing - it just stops a near miss from reading as a flat failure. */
    dailyNear: (() => {
      try {
        if (!$.dailyChallenge || !$.dailyRunStats) return null;
        const c = $.dailyChallenge();
        const have = $.dailyRunStats()[c.stat];
        if (typeof have !== 'number' || !c.n) return null;
        return { have: Math.floor(have), need: c.n };
      } catch { return null; }
    })(),
    ...pilotProgress($),
    ...tierOf($, $.score || 0),
  };
}

/*------------------------------------------------------------------------------
Pilot progression, read at the moment the run ended. The XP is already banked
by then, so the bar shows where the player NOW stands - the run's contribution
is called out separately as the "+N XP" figure.
------------------------------------------------------------------------------*/
function pilotProgress($: Engine) {
  const id = $.hero?.character?.id;
  const maxLevel = $.pilotMaxLevel || 10;
  if (!id || !$.pilotLevel || !$.pilotXp) {
    return { xp: $.runXp || 0, pilotTitle: '', pilotLevel: 1, pilotMaxLevel: maxLevel, xpInto: 0, xpSpan: 1 };
  }
  const level = $.pilotLevel(id);
  const total = $.pilotXp(id);
  const thresholds = $.pilotLevelThresholds || [];
  const floor = thresholds[level - 1] ?? 0;
  const ceiling = level >= maxLevel ? total : (thresholds[level] ?? total);
  return {
    xp: $.runXp || 0,
    pilotTitle: $.hero?.character?.title || '',
    pilotLevel: level,
    pilotMaxLevel: maxLevel,
    xpInto: Math.max(0, total - floor),
    xpSpan: Math.max(1, ceiling - floor),
  };
}

function tierOf($: Engine, score: number) {
  const t = $.tierFor ? $.tierFor(score) : null;
  return { tierName: t?.name || '', tierColor: t?.color || '#cd7f32' };
}

export function GameOverOverlay() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlGameover = 1;
    const onState = (e: Event) => {
      const s = (e as CustomEvent).detail;
      if (s === 'gameover') {
        setOpen(true);
        const first = snapshot();
        setSnap(first);
        // A record run is the biggest thing that can happen on this screen and
        // it was the only major moment with no sound of its own. The engine
        // already decided this ($.runWasBest) - nothing new is claimed here.
        if (first?.best) {
          try { eng()?.audio?.play?.('levelup'); } catch { /* audio may be muted or absent */ }
        }
        // the board rank arrives async after submit; re-read for a few seconds
        if (pollRef.current) clearInterval(pollRef.current);
        let n = 0;
        pollRef.current = setInterval(() => {
          setSnap(snapshot());
          if (++n > 12 && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }, 400);
      } else {
        setOpen(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    };
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // REDEPLOY returns to PRE-FLIGHT rather than dropping straight into a new
  // raid. The run just spent things - a health pack, a shield, a revive - and
  // going directly back to play meant the player never saw their kit count
  // change. Pre-flight is the screen that states what carries in, so it is the
  // honest landing point, and it is an existing state ('playmode'), not a new
  // route. The reset and the run_start tracking stay where they belong: on the
  // actual launch, in launchEndless(), so a redeploy cannot double-count a run.
  const playAgain = useCallback(() => {
    const $ = eng(); if (!$) return;
    // Clear the finished run's state before pre-flight is shown, so nothing
    // on that screen can read a dead run's refit. $.reset() is the engine's
    // own teardown (it already runs on the menu path too) and is what wipes
    // $.upgrades; launchEndless() calls it again at the real launch, which is
    // harmless. run_start tracking deliberately stays on the launch itself so
    // a redeploy cannot double-count a run.
    $.reset();
    $.audio.play('levelup');
    $.setState('playmode');
  }, []);
  const toMenu = useCallback(() => { eng()?.setState('menu'); }, []);
  const share = useCallback(() => { eng()?.shareRunCard(); }, []);

  if (!open || !snap) return null;

  const boardMsg = (() => {
    switch (snap.board) {
      case 'sending': return { t: 'SUBMITTING TO SHOOTERBOARD…', c: 'text-white/50' };
      case 'dailypending': return { t: 'SUBMITTING DAILY RUN…', c: 'text-white/50' };
      case 'daily': return { t: snap.rank ? `DAILY RUN · RANK #${snap.rank}` : 'DAILY RUN SUBMITTED', c: 'text-[color:var(--rs-cyan)]' };
      case 'done': return { t: snap.rank ? `SHOOTERBOARD · RANK #${snap.rank}${snap.improved ? '' : ' · BEST STANDS'}` : 'SCORE SAVED', c: 'text-[color:var(--rs-gold)]' };
      case 'error': return { t: 'SHOOTERBOARD UNAVAILABLE', c: 'text-[color:var(--rs-red)]' };
      default: return null;
    }
  })();

  const stats: [string, string][] = [
    ['SCORE', fmt(snap.score)],
    ['LEVEL', String(snap.level)],
    ['KILLS', fmt(snap.kills)],
    ['BEST COMBO', `×${snap.combo}`],
    ['TIME', fmtTime(snap.time)],
  ];

  const maxed = snap.pilotLevel >= snap.pilotMaxLevel;
  const xpRatio = maxed ? 1 : snap.xpInto / snap.xpSpan;

  return (
    <div
      data-game-ui=""
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4"
      style={{ background: 'rgba(3,5,9,0.6)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      {/* The sections carry --s, a sequence index. Each one arrives a beat after
          the last, so the debrief reads in the order it is meant to be read:
          the result, then what was banked, then what evaporated, then the way
          back in. It is one short stagger, not a celebration sequence - the
          whole thing has settled well before a player could reach REDEPLOY. */}
      <div className="rs-panel rs-cut rs-rise rs-debrief rs-ao-seq relative my-auto w-full max-w-md overflow-hidden text-white">
        {/* the run's outcome, stated in one colour before a single number */}
        <div
          data-s="0"
          className="rs-debrief-head relative border-b border-white/10 px-6 pb-4 pt-5 text-center"
          style={{
            background: snap.best
              ? 'radial-gradient(120% 90% at 50% 0%, rgba(255,207,77,0.16), transparent 70%)'
              : 'radial-gradient(120% 90% at 50% 0%, rgba(255,77,99,0.13), transparent 70%)',
          }}
        >
          <div
            className="rs-label"
            style={{ color: snap.best ? 'var(--rs-gold)' : 'var(--rs-red)', letterSpacing: '0.35em' }}
          >
            {snap.best ? 'Record run' : 'Hull lost'}
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="rs-display text-base tracking-wide text-white/85">{snap.name}</span>
            {snap.tierName && (
              <span className="rs-badge" style={{ color: snap.tierColor, background: `${snap.tierColor}1a` }}>
                {snap.tierName}
              </span>
            )}
          </div>

          <div
            className="rs-debrief-score rs-num mt-2 text-[42px] leading-none sm:text-[52px]"
            style={{ textShadow: '0 0 30px rgba(53,232,255,0.3)' }}
          >
            {fmt(snap.score)}
          </div>

          {snap.best && !snap.daily && (
            <div className="mt-2.5 inline-block">
              <span className="rs-badge rs-rarity-legendary">New personal best</span>
            </div>
          )}
        </div>

        {/*==================================================================
        WHAT YOU KEEP. Deliberately first, and deliberately separated from
        the run's own numbers below: pilot XP, the personal best, the daily
        streak and the board standing are the only things that outlive the
        raid, and a debrief that mixes them into one wall of statistics
        leaves the player unable to tell which is which.
        ==================================================================*/}
        <div data-s="1" className="rs-ao-band rs-ao-band-keep">
          <span className="rs-ao-band-label">You keep</span>
          <span className="rs-ao-band-note">Banked permanently</span>
        </div>

        {snap.pilotTitle && (
          <div data-s="1" className="border-b border-white/10 px-6 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="rs-label">
                {snap.pilotTitle || 'Pilot'} · LVL <span className="rs-num text-[color:var(--rs-cyan)]">{snap.pilotLevel}</span>
                <span className="text-white/20">/{snap.pilotMaxLevel}</span>
              </span>
              <span
                className="rs-num text-sm"
                style={{ color: snap.xp > 0 ? 'var(--rs-gold)' : 'rgba(233,241,255,0.3)' }}
              >
                +{fmt(snap.xp)} XP
              </span>
            </div>
            <div className={`rs-meter mt-2 ${maxed ? 'rs-meter-gold' : 'rs-meter-xp'}`}>
              <div className="rs-meter-fill" style={{ width: `${xpRatio * 100}%` }} />
            </div>
            {!maxed && (
              <div className="rs-num mt-1.5 text-right text-[10px] text-white/45">
                {fmt(snap.xpSpan - snap.xpInto)} XP to level {snap.pilotLevel + 1}
              </div>
            )}
          </div>
        )}

        {/* where it landed you, and how close the next place is */}
        {(boardMsg || (snap.gap > 0 && snap.nextRank > 0) || snap.dailyResult
          || (snap.dailyText && !snap.daily)) && (
          <div className="space-y-1.5 border-b border-white/10 px-6 py-3 text-center text-[12px]">
            {boardMsg && <div className={`font-bold ${boardMsg.c}`}>{boardMsg.t}</div>}
            {snap.gap > 0 && snap.nextRank > 0 && (
              <div className="rs-num text-[color:var(--rs-cyan)]">
                {fmt(snap.gap)} POINTS BEHIND #{snap.nextRank} — ONE MORE RUN?
              </div>
            )}
            {snap.dailyResult && (
              <div className="font-bold text-[color:var(--rs-gold)]">
                DAILY OPS COMPLETE · +{snap.dailyResult.xp} XP
                {snap.dailyResult.streak >= 2 ? ` · ${snap.dailyResult.streak} DAY STREAK` : ''}
              </div>
            )}
            {/* Not cleared: say what it was, so the near-miss is actionable
                rather than silent. The challenge is deterministic per day, so
                this is the same goal that will still be there next run. */}
            {!snap.dailyResult && snap.dailyText && !snap.daily && (
              <div className="rs-ao-daily">
                <span className="rs-label rs-ao-daily-cap">Daily still open</span>
                <span className="rs-ao-daily-text">{snap.dailyText}</span>
                {snap.dailyNear && snap.dailyNear.have > 0 && (
                  <span className="rs-num rs-ao-daily-near">
                    {fmt(snap.dailyNear.have)} / {fmt(snap.dailyNear.need)} this run
                  </span>
                )}
                {snap.streak > 0 && (
                  <span className="rs-num rs-ao-daily-streak">{snap.streak} day streak</span>
                )}
              </div>
            )}
          </div>
        )}

        {/*==================================================================
        THIS RUN — everything in this block is gone. The engine wipes all of
        it in $.reset(): the score, the ladder, and the draft build most of
        all. Saying so here is the only place the player is ever told that a
        refit does not carry, and it is what stops the debrief from reading
        as if the build were an acquisition.
        ==================================================================*/}
        <div data-s="2" className="rs-ao-band">
          <span className="rs-ao-band-label">This run</span>
          <span className="rs-ao-band-note">Not carried forward</span>
        </div>

        <div data-s="2" className="grid grid-cols-5 gap-px bg-white/5 px-px">
          {stats.map(([k, v]) => (
            <div key={k} className="bg-[#0a0d15] px-1 py-2.5 text-center">
              <div className="rs-num text-sm sm:text-base">{v}</div>
              <div className="rs-label mt-1 text-[8px]">{k}</div>
            </div>
          ))}
        </div>

        {snap.build.length > 0 && (
          <div className="rs-ao-build">
            <span className="rs-label rs-ao-build-cap">Field refit</span>
            <span className="rs-ao-build-list">{snap.build.join(' · ')}</span>
          </div>
        )}

        {snap.assisted && (
          <p className="rs-ao-assist">
            Field kit spent — this run is logged as assisted.
          </p>
        )}

        {/* one obvious way back in */}
        <div data-s="3" className="flex flex-col gap-2 p-4">
          <button className="rs-cta" onClick={playAgain}>
            <span className="rs-cta-face rs-cut" style={{ padding: '14px 20px' }}>
              <span className="rs-cta-bracket" style={{ top: 7, left: 7, borderRight: 0, borderBottom: 0 }} />
              <span className="rs-cta-bracket" style={{ bottom: 7, right: 7, borderLeft: 0, borderTop: 0 }} />
              <span className="rs-cta-label" style={{ fontSize: 20 }}>REDEPLOY</span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={share} className="rs-btn rs-btn-ghost">Share rank</button>
            <button onClick={toMenu} className="rs-btn rs-btn-ghost">Command</button>
          </div>
        </div>
      </div>
    </div>
  );
}
