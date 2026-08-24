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
        setSnap(snapshot());
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

  const playAgain = useCallback(() => {
    const $ = eng(); if (!$) return;
    $.reset(); $.trackRun('run_start'); $.audio.play('levelup'); $.setState('play');
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
      case 'assisted': return { t: 'NOT RANKED · CONSUMABLE USED', c: 'text-white/50' };
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
      <div className="rs-panel rs-cut rs-rise rs-debrief relative my-auto w-full max-w-md overflow-hidden text-white">
        {/* the run's outcome, stated in one colour before a single number */}
        <div
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

        {/* WHAT THIS RUN CHANGED - the payoff, before the raw numbers */}
        {snap.xp > 0 && (
          <div className="border-b border-white/10 px-6 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="rs-label">
                {snap.pilotTitle || 'Pilot'} · LVL <span className="rs-num text-[color:var(--rs-cyan)]">{snap.pilotLevel}</span>
                <span className="text-white/20">/{snap.pilotMaxLevel}</span>
              </span>
              <span className="rs-num text-sm text-[color:var(--rs-gold)]">+{fmt(snap.xp)} XP</span>
            </div>
            <div className={`rs-meter mt-2 ${maxed ? 'rs-meter-gold' : 'rs-meter-xp'}`}>
              <div className="rs-meter-fill" style={{ width: `${xpRatio * 100}%` }} />
            </div>
            {!maxed && (
              <div className="rs-num mt-1.5 text-right text-[10px] text-white/30">
                {fmt(snap.xpSpan - snap.xpInto)} XP to level {snap.pilotLevel + 1}
              </div>
            )}
          </div>
        )}

        {/* where it landed you, and how close the next place is */}
        {(boardMsg || (snap.gap > 0 && snap.nextRank > 0) || snap.dailyResult) && (
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
          </div>
        )}

        {/* the numbers */}
        <div className="grid grid-cols-5 gap-px bg-white/5 px-px">
          {stats.map(([k, v]) => (
            <div key={k} className="bg-[#0a0d15] px-1 py-2.5 text-center">
              <div className="rs-num text-sm sm:text-base">{v}</div>
              <div className="rs-label mt-1 text-[8px]">{k}</div>
            </div>
          ))}
        </div>

        {snap.build.length > 0 && (
          <div className="border-t border-white/10 px-6 py-2.5 text-center text-[11px] text-white/45">
            <span className="rs-label mr-1.5">Build</span>
            {snap.build.join(' · ')}
          </div>
        )}

        {/* one obvious way back in */}
        <div className="flex flex-col gap-2 p-4">
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
