'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BoardBackdrop } from '@/components/BoardBackdrop';

// The HTML SETTINGS screen. Same treatment as BoardOverlay: the engine
// flags the canvas settings screen off (window.__htmlSettings) and hands
// the screen to this overlay, so it gets the same dark-card, glow-border,
// scanline look as the leaderboard instead of the plain canvas button list.
// Every action still calls straight into the existing engine functions
// (promptPilotName, setSoundLevel, etc.) - this is a skin, not a rewrite
// of settings logic.
//
// Laid out like the hangar and the armory: on a wide screen the sections run
// down the left and the settings sit beside them as readable rows (what it
// is, what it does, its control); on a phone it is one list. Every option is
// on screen and one tap away - the old screen cycled values blind.

type Controls = 'hybrid' | 'keyboard' | 'mouse';

interface EngineBridge {
  storage: Record<string, unknown>;
  updateStorage: () => void;
  promptPilotName: () => void;
  soundLevel: number;
  soundLevelLabels: Record<number, string>;
  setSoundLevel: (level: number) => void;
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
const CONTROL_LABELS: Record<Controls, string> = { hybrid: 'Hybrid', keyboard: 'Keyboard', mouse: 'Mouse' };
const CONTROL_HELP: Record<Controls, string> = {
  hybrid: 'Keys move, the mouse aims and fires',
  keyboard: 'Keys move and aim, hold F to fire',
  mouse: 'The ship follows the cursor, hold the left button to fire',
};
const SOUND_LEVELS = [1, 0.5, 0];

/*------------------------------------------------------------------------------
One setting: what it is, a line on what it does, and its control - every
option is on screen and one tap away, instead of a value you cycle through
blind.
------------------------------------------------------------------------------*/
function Segmented<T extends string | number>({ label, options, value, onPick }: {
  label: string; options: Array<{ v: T; text: string }>; value: T; onPick: (v: T) => void;
}) {
  return (
    <div className="rs-set-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value}
          data-on={o.v === value ? '1' : '0'} onClick={() => onPick(o.v)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Setting({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="rs-set-row">
      <div className="rs-set-text">
        <span className="rs-set-label">{label}</span>
        {help && <span className="rs-set-help">{help}</span>}
      </div>
      <div className="rs-set-ctl">{children}</div>
    </div>
  );
}

const onOff = [{ v: 1, text: 'On' }, { v: 0, text: 'Off' }];

type SectionId = 'pilot' | 'controls' | 'sound' | 'display' | 'help';
const SECTIONS: Array<{ id: SectionId; title: string }> = [
  { id: 'pilot', title: 'Pilot' },
  { id: 'controls', title: 'Controls' },
  { id: 'sound', title: 'Sound' },
  { id: 'display', title: 'Display' },
  { id: 'help', title: 'Help' },
];

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
  const pilotName = ($?.storage['pilotname'] as string) || '';
  const controls = (($?.storage['controls'] as Controls) || 'hybrid');
  const musicOn = $ ? $.storage['music'] !== 0 : true;
  const numbersOn = $ ? $.storage['dmgnums'] !== 0 : true;
  const gfx3dOn = $ ? $.storage['gfx3d'] !== 0 : true;
  const soundLevel = $ ? $.soundLevel : 1;
  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const isFullscreen = typeof document !== 'undefined' && !!document.fullscreenElement;

  function put(key: string, v: unknown) {
    if (!$) return;
    $.storage[key] = v;
    $.updateStorage();
    refresh();
  }

  function setCallSign() {
    $?.promptPilotName();
    refresh();
  }

  function setMusic(on: number) {
    put('music', on);
    if (on && $) $.music.start();
  }

  function setSound(level: number) {
    $?.setSoundLevel(level);
    refresh();
  }

  function setFullscreen(on: number) {
    if (!on && document.fullscreenElement) document.exitFullscreen().finally(refresh);
    else if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}).finally(refresh);
  }

  function goHowTo() {
    if (!$) return;
    $.howtoIndex = 0;
    $.howtoOnboarding = 0;
    $.setState('howto');
  }

  function jump(id: SectionId) {
    document.getElementById(`rs-set-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      data-game-ui=""
      className="rs-set fixed inset-0 z-40 flex flex-col text-white"
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

      <div className="rs-set-scroll rs-scroll relative z-10 flex-1 overflow-y-auto">
        <div className="rs-set-frame">
          <header className="rs-set-head">
            <div className="rs-label text-[color:var(--rs-cyan)]" style={{ letterSpacing: '0.4em' }}>Raid Shooter</div>
            {/* named to match the nav rail's SYSTEM slot - one destination, one
                name, wherever the player reaches it from */}
            <h1 className="rs-display mt-1.5 text-4xl sm:text-5xl" style={{ textShadow: '0 0 30px rgba(53,232,255,0.25)' }}>
              SYSTEM
            </h1>
          </header>

          {/* desktop: the sections down the left, the same way the hangar and
              armory lay out; on a phone they are simply the list below */}
          <nav className="rs-set-nav" aria-label="System sections">
            {SECTIONS.map((sec) => (
              <button key={sec.id} type="button" onClick={() => jump(sec.id)}>{sec.title}</button>
            ))}
            <button type="button" className="rs-set-back" onClick={() => $?.setState('menu')}>‹ Back to command</button>
          </nav>

          <div className="rs-set-body">
            <section id="rs-set-pilot" className="rs-set-sec" aria-labelledby="rs-set-h-pilot">
              <h2 id="rs-set-h-pilot" className="rs-set-sec-title">Pilot</h2>
              <Setting label="Call sign" help="The name on the boards and in duels">
                <button type="button" className="rs-set-value" onClick={setCallSign}>
                  <span className="rs-num">{pilotName || 'Set name'}</span>
                  <span className="rs-set-edit">Change</span>
                </button>
              </Setting>
            </section>

            <section id="rs-set-controls" className="rs-set-sec" aria-labelledby="rs-set-h-controls">
              <h2 id="rs-set-h-controls" className="rs-set-sec-title">Controls</h2>
              <Setting label="Scheme" help={CONTROL_HELP[controls]}>
                <Segmented label="Control scheme" value={controls} onPick={(v) => put('controls', v)}
                  options={CONTROL_ORDER.map((c) => ({ v: c, text: CONTROL_LABELS[c] }))} />
              </Setting>
              <p className="rs-set-note">On a phone: drag to move, tap to fire, double-tap to dash.</p>
            </section>

            <section id="rs-set-sound" className="rs-set-sec" aria-labelledby="rs-set-h-sound">
              <h2 id="rs-set-h-sound" className="rs-set-sec-title">Sound</h2>
              <Setting label="Sound" help="Effects and music together">
                <Segmented label="Sound level" value={soundLevel} onPick={setSound}
                  options={SOUND_LEVELS.map((l) => ({ v: l, text: ($?.soundLevelLabels[l] || String(l)).charAt(0) + ($?.soundLevelLabels[l] || '').slice(1).toLowerCase() }))} />
              </Setting>
              <Setting label="Music" help="Each sector's own track">
                <Segmented label="Music" value={musicOn ? 1 : 0} onPick={setMusic} options={onOff} />
              </Setting>
            </section>

            <section id="rs-set-display" className="rs-set-sec" aria-labelledby="rs-set-h-display">
              <h2 id="rs-set-h-display" className="rs-set-sec-title">Display</h2>
              <Setting label="3D graphics" help="The hangar, the deck ship, the podium, and the rocks, crates and other objects in a raid. Off: flat art, and the 3D code is never downloaded">
                {/* read when a bay opens, so it applies from the next screen on */}
                <Segmented label="3D graphics" value={gfx3dOn ? 1 : 0} onPick={(v) => put('gfx3d', v)} options={onOff} />
              </Setting>
              <Setting label="Damage numbers" help="A number over every hit">
                <Segmented label="Damage numbers" value={numbersOn ? 1 : 0} onPick={(v) => put('dmgnums', v)} options={onOff} />
              </Setting>
              {canFullscreen && (
                <Setting label="Fullscreen" help="Fill the whole screen">
                  <Segmented label="Fullscreen" value={isFullscreen ? 1 : 0} onPick={setFullscreen} options={onOff} />
                </Setting>
              )}
            </section>

            <section id="rs-set-help" className="rs-set-sec" aria-labelledby="rs-set-h-help">
              <h2 id="rs-set-h-help" className="rs-set-sec-title">Help</h2>
              <div className="rs-set-links">
                <button type="button" onClick={goHowTo} className="rs-btn rs-btn-ghost">How to play</button>
                <button type="button" onClick={() => $?.setState('stats')} className="rs-btn rs-btn-ghost">Stats</button>
                <button type="button" onClick={() => $?.setState('credits')} className="rs-btn rs-btn-ghost">Credits</button>
              </div>
            </section>

            <button type="button" onClick={() => $?.setState('menu')} className="rs-btn rs-btn-solid rs-set-done w-full py-3">
              Back to command
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
