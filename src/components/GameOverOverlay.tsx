'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Blurred, flex-laid game-over screen. Replaces the hand-positioned canvas
// version (whose text could collide with the buttons). It reads the finished
// run straight off the global engine object and drives it back via $.setState.

interface Engine {
  score: number;
  kills: number;
  bestCombo: number;
  level: { current: number };
  elapsed: number;
  runWasBest?: boolean;
  runAssisted?: boolean;
  dailyRunActive?: number;
  dailyResult?: { xp: number; streak: number } | null;
  boardSubmit?: { state: string; rank?: number; improved?: boolean; verified?: boolean; gap?: number; nextRank?: number };
  storage: Record<string, unknown>;
  upgrades: Record<string, number>;
  definitions: { upgrades: { id: string; title: string }[] };
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
  };
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
      case 'daily': return { t: snap.rank ? `DAILY RUN · RANK #${snap.rank}` : 'DAILY RUN SUBMITTED', c: 'text-sky-300' };
      case 'done': return { t: snap.rank ? `SHOOTERBOARD · RANK #${snap.rank}${snap.improved ? '' : ' · BEST STANDS'}` : 'SCORE SAVED', c: 'text-amber-300' };
      case 'assisted': return { t: 'NOT RANKED · CONSUMABLE USED', c: 'text-white/50' };
      case 'error': return { t: 'SHOOTERBOARD UNAVAILABLE', c: 'text-red-300' };
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

  return (
    <div
      data-game-ui=""
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4"
      style={{ background: 'rgba(4,5,10,0.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      <div
        className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 text-white"
        style={{ background: 'linear-gradient(180deg, rgba(18,20,31,0.96), rgba(9,11,18,0.96))', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}
      >
        {/* top strip */}
        <div className="border-b border-white/10 px-6 pb-3 pt-4 text-center sm:pb-5 sm:pt-6">
          <div className="text-[11px] font-black uppercase tracking-[0.35em] text-red-400" style={{ textShadow: '0 0 18px rgba(255,60,60,0.5)' }}>Game Over</div>
          <div className="mt-2 text-xl font-black tracking-wide sm:mt-3 sm:text-2xl">{snap.name}</div>
          <div className="mt-1.5 font-mono text-4xl font-black tabular-nums text-white sm:mt-3 sm:text-5xl" style={{ textShadow: '0 0 24px rgba(51,230,255,0.25)' }}>{fmt(snap.score)}</div>
          {snap.best && !snap.daily && (
            <div className="mt-2 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300 sm:text-[11px]">★ New personal best</div>
          )}
        </div>

        {/* async board status + near-miss hook */}
        {(boardMsg || (snap.gap > 0 && snap.nextRank > 0) || snap.dailyResult) && (
          <div className="space-y-1.5 border-b border-white/10 px-6 py-3 text-center text-[12px]">
            {boardMsg && <div className={`font-bold ${boardMsg.c}`}>{boardMsg.t}</div>}
            {snap.gap > 0 && snap.nextRank > 0 && (
              <div className="font-mono text-cyan-300">{fmt(snap.gap)} POINTS BEHIND #{snap.nextRank} — ONE MORE RUN?</div>
            )}
            {snap.dailyResult && (
              <div className="font-bold text-amber-300">DAILY CHALLENGE COMPLETE · +{snap.dailyResult.xp} XP{snap.dailyResult.streak >= 2 ? ` · ${snap.dailyResult.streak} DAY STREAK` : ''}</div>
            )}
          </div>
        )}

        {/* stat grid */}
        <div className="grid grid-cols-5 gap-px bg-white/5 px-px">
          {stats.map(([k, v]) => (
            <div key={k} className="bg-[#0d0f18] px-1 py-2 text-center sm:py-3">
              <div className="font-mono text-sm font-bold tabular-nums text-white sm:text-base">{v}</div>
              <div className="mt-1 text-[8px] font-black uppercase tracking-wider text-white/35">{k}</div>
            </div>
          ))}
        </div>

        {snap.build.length > 0 && (
          <div className="border-t border-white/10 px-6 py-2 text-center text-[11px] text-white/45 sm:py-3">
            <span className="text-white/30">BUILD · </span>{snap.build.join(' · ')}
          </div>
        )}

        {/* actions - flex row, never collides */}
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <button onClick={playAgain} className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-cyan-300">
            Play again
          </button>
          <div className="flex gap-2">
            <button onClick={share} className="flex-1 rounded-xl border border-white/15 bg-white/[0.05] py-2.5 text-[12px] font-black uppercase tracking-wider text-white/80 hover:bg-white/10">
              Share rank
            </button>
            <button onClick={toMenu} className="flex-1 rounded-xl border border-white/15 bg-white/[0.05] py-2.5 text-[12px] font-black uppercase tracking-wider text-white/80 hover:bg-white/10">
              Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
