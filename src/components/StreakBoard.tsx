'use client';

import { useEffect, useRef, useState } from 'react';

// The 30-day daily streak board. Play on (roughly) consecutive days to fill
// the streak; reaching Day 30 grants a fixed pilot (ATLAS BEAM) to everyone,
// once. Cosmetic only - it never affects a run or score.
//
// Shows as a centered menu overlay (same layer as the Recruit Pack / Inbox).
// Auto-opens once per calendar day the first time the player lands on the
// menu - the moment their streak ticks up - then stays out of the way behind
// a persistent flame chip they can reopen anytime.

interface StreakData {
  days: number;
  claimedAt: number;
  pilotClaimed: boolean;
  goal: number;       // recurring consumable cadence (3)
  pilotGoal: number;  // pilot milestone (30)
}

const SEEN_DAY_KEY = 'streakBoardSeenDay';

function myGuestToken(): string | null {
  try {
    const raw = localStorage.getItem('radiusraid');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guesttoken?: string };
    return typeof parsed.guesttoken === 'string' && parsed.guesttoken.length >= 8 ? parsed.guesttoken : null;
  } catch {
    return null;
  }
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StreakBoard() {
  const [onMenu, setOnMenu] = useState(false);
  const [data, setData] = useState<StreakData | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pilotWon, setPilotWon] = useState(false);
  const autoRef = useRef(false);

  useEffect(() => {
    const onState = (e: Event) => setOnMenu((e as CustomEvent).detail === 'menu');
    window.addEventListener('raidshooter:state', onState as EventListener);
    // opened from the menu's STREAK button (rendered in the bottom-left
    // button cluster by GameOverlays, so there's a single non-overlapping
    // row of menu actions rather than a separate floating chip)
    const onOpen = () => setOpen(true);
    window.addEventListener('raidshooter:openstreak', onOpen);
    return () => {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      window.removeEventListener('raidshooter:openstreak', onOpen);
    };
  }, []);

  /*
   * On menu entry, READ the streak. This used to POST first - recording a
   * "play" for merely arriving at the menu - which is half of why the daily
   * PLAY streak paid out for not playing. useMenuData was the other half.
   *
   * Recording now happens in exactly one place, gated on a finished run
   * (recordPlayIfRaided in useMenuData). A read must never have a side effect,
   * or the streak measures app-opens again the moment someone adds a screen.
   */
  useEffect(() => {
    if (!onMenu) return;
    const gt = myGuestToken();
    fetch(`/api/streak${gt ? `?guestToken=${encodeURIComponent(gt)}` : ''}`)
      .then((r) => r.json())
      .then((d: StreakData) => {
        setData(d);
        if (autoRef.current) return;
        autoRef.current = true;
        let seen: string | null = null;
        try { seen = localStorage.getItem(SEEN_DAY_KEY); } catch { /* ignore */ }
        if (seen !== todayStamp() && d.days > 0) {
          setOpen(true);
          try { localStorage.setItem(SEEN_DAY_KEY, todayStamp()); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, [onMenu]);

  if (!onMenu || !data) return null;

  const { days, pilotGoal } = data;
  const pilotReady = days >= pilotGoal && !data.pilotClaimed;
  const pct = Math.min(100, Math.round((days / pilotGoal) * 100));

  async function claimPilot() {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/streak/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'pilot', guestToken: myGuestToken() || undefined }),
      });
      const d = await res.json();
      if (res.ok && d.granted) {
        setPilotWon(true);
        setMsg('ATLAS BEAM joined your hangar!');
        setData((p) => (p ? { ...p, pilotClaimed: true } : p));
        try { (window as unknown as { $?: { fetchProfile?: () => void; audio?: { play: (id: string) => void } } }).$?.fetchProfile?.(); } catch { /* engine may not be ready */ }
        try { (window as unknown as { $?: { audio?: { play: (id: string) => void } } }).$?.audio?.play?.('levelup'); } catch { /* ignore */ }
      } else {
        setMsg('Not ready yet — keep the streak going.');
      }
    } catch {
      setMsg('Claim failed — try again.');
    } finally {
      setBusy(false);
    }
  }

  // angled corners to match the game's tactical panels
  const panelClip = { clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)' } as const;
  const btnClip = { clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' } as const;

  return (
    <>
      {open && (
        <div
          data-game-ui=""
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 70, paddingTop: 'calc(env(safe-area-inset-top,0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}
          className="flex items-center justify-center overflow-y-auto bg-black/70 px-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={panelClip}
            className="relative my-auto w-full max-w-[460px] border border-cyan-400/16 bg-[#0a0f18] shadow-[0_0_55px_rgba(0,0,0,.6),inset_0_0_70px_rgba(34,211,238,.03)]"
          >
            <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400/0 via-cyan-400 to-cyan-400/0" />

            {/* header */}
            <div className="flex items-center justify-between border-b border-cyan-400/15 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg drop-shadow-[0_0_7px_rgba(255,140,40,.7)]">🔥</span>
                <h2 className="font-mono text-sm font-black uppercase tracking-[0.2em] text-white">30 Day Streak</h2>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-300">Day {days} / {pilotGoal}</span>
            </div>

            {/* progress bar */}
            <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-300 shadow-[0_0_12px_rgba(34,211,238,.5)]" style={{ width: `${pct}%` }} />
            </div>

            {/* 30-tile grid */}
            <div className="grid grid-cols-10 gap-1.5 px-5 pb-2.5 pt-4">
              {Array.from({ length: 30 }, (_, i) => {
                const d = i + 1;
                const done = d <= days;
                const today = d === days;
                const grand = d === 30;
                const mile = d % 5 === 0 && d !== 30;
                let cls = 'flex aspect-square items-center justify-center font-mono text-[11px] font-bold ';
                if (grand) {
                  cls += `border text-[13px] ${done ? 'border-amber-300 bg-amber-300 text-black' : 'border-amber-300 bg-amber-300/10 text-amber-300 animate-pulse'}`;
                } else if (today) {
                  cls += 'border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.5)]';
                } else if (done) {
                  cls += 'border border-cyan-400 bg-cyan-400 text-black';
                } else if (mile) {
                  cls += 'border border-amber-400/45 bg-white/[0.02] text-amber-300/90';
                } else {
                  cls += 'border border-white/[0.07] bg-white/[0.03] text-white/35';
                }
                return (
                  <div key={d} style={{ clipPath: 'polygon(3px 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,0 100%,0 3px)' }} className={cls}>
                    {grand ? '★' : d}
                  </div>
                );
              })}
            </div>

            {/* Day-30 prize strip */}
            <div className="mx-5 mt-2 flex items-center gap-3.5 border border-amber-400/30 bg-gradient-to-r from-amber-400/[0.09] to-transparent p-3" style={{ clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' }}>
              <span className="text-2xl">{pilotWon || data.pilotClaimed ? '🚀' : '❔'}</span>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-300">Day 30 reward</div>
                <div className="font-mono text-sm font-black text-white">{pilotWon || data.pilotClaimed ? 'ATLAS BEAM — unlocked' : 'ATLAS BEAM pilot'}</div>
              </div>
            </div>

            {/* footer / action */}
            <div className="px-5 pb-5 pt-4">
              {pilotReady ? (
                <button onClick={claimPilot} disabled={busy} style={btnClip} className="w-full bg-amber-400 py-3 font-mono text-[13px] font-black uppercase tracking-[0.14em] text-black shadow-[0_0_16px_rgba(255,207,77,.4)] transition-colors hover:bg-amber-300 disabled:opacity-50">
                  {busy ? 'Claiming…' : '▶ Claim ATLAS BEAM'}
                </button>
              ) : data.pilotClaimed ? (
                <button onClick={() => setOpen(false)} style={btnClip} className="w-full bg-cyan-400 py-3 font-mono text-[13px] font-black uppercase tracking-[0.14em] text-black transition-colors hover:bg-cyan-300">
                  Nice — see you tomorrow
                </button>
              ) : (
                <p className="text-center font-mono text-[11px] uppercase tracking-[0.1em] text-white/40">
                  {pilotGoal - days} {pilotGoal - days === 1 ? 'day' : 'days'} to the pilot — miss one day is OK, two resets
                </p>
              )}
              {msg && <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-wide text-emerald-300">{msg}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
