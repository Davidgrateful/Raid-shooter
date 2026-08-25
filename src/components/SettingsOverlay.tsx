'use client';

import { useCallback, useEffect, useState } from 'react';
import { BoardBackdrop } from '@/components/BoardBackdrop';

// The HTML SETTINGS screen. Same treatment as BoardOverlay: the engine
// flags the canvas settings screen off (window.__htmlSettings) and hands
// the screen to this overlay, so it gets the same dark-card, glow-border,
// scanline look as the leaderboard instead of the plain canvas button list.
// Every action still calls straight into the existing engine functions
// (promptPilotName, cycleSoundLevel, etc.) - this is a skin, not a rewrite
// of settings logic.

type Controls = 'hybrid' | 'keyboard' | 'mouse';

interface EngineBridge {
  storage: Record<string, unknown>;
  updateStorage: () => void;
  promptPilotName: () => void;
  soundLevel: number;
  soundLevelLabels: Record<number, string>;
  cycleSoundLevel: () => void;
  music: { start: () => void };
  setState: (s: string) => void;
  howtoIndex?: number;
  howtoOnboarding?: number;
}

function engine(): EngineBridge | null {
  return (typeof window !== 'undefined'
    ? (window as unknown as { $?: EngineBridge }).$
    : null) || null;
}

const CONTROL_ORDER: Controls[] = ['hybrid', 'keyboard', 'mouse'];
const CONTROL_LABELS: Record<Controls, string> = { hybrid: 'HYBRID', keyboard: 'KEYBOARD', mouse: 'MOUSE' };

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rs-panel rs-cut-sm flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:border-[color:var(--rs-cyan)]"
    >
      <span className="rs-label text-white/50">{label}</span>
      <span className="rs-num text-sm text-[color:var(--rs-cyan)]">{value}</span>
    </button>
  );
}

export function SettingsOverlay() {
  const [open, setOpen] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlSettings = 1;
    const onState = (e: Event) => setOpen((e as CustomEvent).detail === 'settings');
    window.addEventListener('raidshooter:state', onState as EventListener);
    const iv = setInterval(() => {
      const st = (window as unknown as { $?: { state?: string } }).$?.state;
      if (st === 'settings' || st === 'menu' || st === 'play') {
        setOpen((prev) => (st === 'settings') !== prev ? st === 'settings' : prev);
      }
    }, 300);
    return () => {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      clearInterval(iv);
    };
  }, []);

  const refresh = useCallback(() => forceTick((t) => t + 1), []);

  if (!open) return null;

  const $ = engine();
  const pilotName = ($?.storage['pilotname'] as string) || 'SET NAME';
  const controls = (($?.storage['controls'] as Controls) || 'hybrid');
  const musicOn = $ ? $.storage['music'] !== 0 : true;
  const soundLabel = $ ? $.soundLevelLabels[$.soundLevel] : 'FULL';
  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const isFullscreen = typeof document !== 'undefined' && !!document.fullscreenElement;

  function setCallSign() {
    $?.promptPilotName();
    refresh();
  }

  function cycleControls() {
    if (!$) return;
    const next = CONTROL_ORDER[(CONTROL_ORDER.indexOf(controls) + 1) % CONTROL_ORDER.length];
    $.storage['controls'] = next;
    $.updateStorage();
    refresh();
  }

  function toggleMusic() {
    if (!$) return;
    $.storage['music'] = musicOn ? 0 : 1;
    $.updateStorage();
    if ($.storage['music'] !== 0) $.music.start();
    refresh();
  }

  function cycleSound() {
    $?.cycleSoundLevel();
    refresh();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
    refresh();
  }

  function goHowTo() {
    if (!$) return;
    $.howtoIndex = 0;
    $.howtoOnboarding = 0;
    $.setState('howto');
  }

  function toMenu() {
    $?.setState('menu');
  }

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
      <BoardBackdrop />
      {/* the same whisper of texture the rest of the game now uses - the old
          full-strength scanline field made every label look smudged */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.012) 0 1px, transparent 1px 4px)' }} />

      <div className="relative z-10 mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 py-8 sm:py-12">
        <div className="text-center">
          <div className="rs-label text-[color:var(--rs-cyan)]" style={{ letterSpacing: '0.4em' }}>Raid Shooter</div>
          {/* named to match the nav rail's SYSTEM slot - one destination, one
              name, wherever the player reaches it from */}
          <h1 className="rs-display mt-1.5 text-4xl sm:text-5xl" style={{ textShadow: '0 0 30px rgba(53,232,255,0.25)' }}>
            SYSTEM
          </h1>
        </div>

        <div className="mt-8 space-y-2.5">
          <Row label="Call sign" value={pilotName} onClick={setCallSign} />
          <Row label="Controls" value={CONTROL_LABELS[controls]} onClick={cycleControls} />
          <Row label="Music" value={musicOn ? 'ON' : 'OFF'} onClick={toggleMusic} />
          <Row label="Sound" value={soundLabel} onClick={cycleSound} />
          {canFullscreen && (
            <Row label="Fullscreen" value={isFullscreen ? 'ON' : 'OFF'} onClick={toggleFullscreen} />
          )}
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-white/55">
          HYBRID: keys move, mouse aims and fires · KEYBOARD: keys move and aim, hold F to fire · MOUSE: ship follows cursor, hold LMB to fire
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <button onClick={goHowTo} className="rs-btn rs-btn-ghost">How to play</button>
          <button onClick={() => $?.setState('stats')} className="rs-btn rs-btn-ghost">Stats</button>
          <button onClick={() => $?.setState('credits')} className="rs-btn rs-btn-ghost">Credits</button>
        </div>

        <button onClick={toMenu} className="rs-btn rs-btn-solid mt-6 w-full py-3">
          Back to command
        </button>
      </div>
    </div>
  );
}
