'use client';

import { useCallback, useEffect, useState } from 'react';
import { NAV } from '@/components/command/CommandCenter';
import { NavRail, TabBar } from '@/components/command/hud';
import { IconSystem } from '@/components/command/icons';
import { engine, useEngineRevision, useEngineState, withEngine } from '@/components/command/engine';
import { BayViewport } from '@/components/hangar/BayViewport';
import { launchEndless, readLaunch, type LaunchView } from './data';

/*==============================================================================
PRE-FLIGHT

The last screen before the game starts, and the one with the clearest job in
the whole app: answer "what am I taking in with me" and then get out of the
way.

That question was genuinely unanswered before. Four different things really do
carry into a run - the hull and its tuning, the drone's XP bonus, field kits
that can be spent mid-raid, and today's daily challenge - and the old screen
("CHOOSE YOUR RUN", two buttons) showed none of them. A player could launch
holding two health packs and an XP boost without knowing either.

WHY THIS IS NOT THE HANGAR AGAIN
The hangar is for inspection: big hull, instrument column, time to read. This
screen is for COMMITMENT. It is one column, it reads top to bottom in about
three seconds, and it ends in a single control. The hull is present but smaller
and off to one side, because at this moment it is confirmation rather than
subject - you already chose it, this is the pre-flight check.

Nothing here is aggregated into an invented "readiness" figure. Each line is a
real value the engine will actually use in the next sixty seconds.
==============================================================================*/

export function LaunchScreen() {
  const state = useEngineState();
  const onLaunch = state === 'playmode';
  const rev = useEngineRevision(onLaunch);

  const [view, setView] = useState<LaunchView | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [short, setShort] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlLaunch = 1;
  }, []);

  useEffect(() => {
    const f = () => setShort(window.innerHeight < 560);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // Both writes are deferred a tick: the engine settles first, and neither
  // re-enters render synchronously.
  useEffect(() => {
    if (!onLaunch) {
      const off = setTimeout(() => setCommitting(false), 0);
      return () => clearTimeout(off);
    }
    withEngine((e) => e.fetchProfile?.());
    const t = setTimeout(() => setView(readLaunch()), 0);
    return () => clearTimeout(t);
  }, [onLaunch, rev]);

  const go = useCallback((target: string) => {
    setMoreOpen(false);
    withEngine((e) => {
      if ((target === 'playmode' || target === 'board') && !e.storage?.['pilotname']) {
        e.promptPilotName?.();
        e.ensurePilotName?.();
      }
      e.setState(target);
    });
  }, []);

  /* --- the commit. A short, deliberate hold before the game takes over:
         the screen drops away and the raid starts, so launching reads as one
         continuous motion rather than a page swap. -------------------------- */
  const launch = useCallback(() => {
    if (committing) return;
    setCommitting(true);
    withEngine((e) => e.audio?.play?.('click'));
    setTimeout(launchEndless, 460);
  }, [committing]);

  /* --- keyboard: Enter launches, Escape backs out ---------------------- */
  useEffect(() => {
    if (!onLaunch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { launch(); e.preventDefault(); }
      else if (e.key === 'Escape') { withEngine((x) => x.setState('menu')); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLaunch, launch]);

  if (!onLaunch) return null;

  const xpRatio = view ? (view.atMaxLevel ? 1 : Math.min(100, (view.xpInto / view.xpSpan) * 100)) : 0;

  return (
    <div
      data-game-ui=""
      className="rs-cc rs-lx"
      data-short={short ? '1' : '0'}
      data-committing={committing ? '1' : '0'}
    >
      <div aria-hidden className="rs-cc-veil rs-lx-veil" />

      <header className="rs-cc-top rs-lx-top">
        <div className="rs-hg-where">
          <button type="button" className="rs-hg-back" onClick={() => go('menu')} aria-label="Back to command deck">
            <span aria-hidden>‹</span>
          </button>
          <span className="rs-hg-title">Pre-flight</span>
        </div>
        {view && (
          <span className="rs-lx-best">
            <span className="rs-hg-bay-cap">Best</span>
            <span className="rs-num">{view.best.toLocaleString()}</span>
          </span>
        )}
      </header>

      <NavRail
        nav={NAV}
        active="deploy"
        onGo={go}
        onHome={() => go('menu')}
        onInvite={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'invite' }))}
        onFeedback={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'feedback' }))}
      />

      <main className="rs-cc-main rs-lx-main rs-scroll">
        <div className="rs-lx-stage">
          {/*--- the hull, confirming rather than presenting ---------------*/}
          <div className="rs-lx-craft">
            <div className="rs-hg-bayframe rs-lx-bayframe">
              <BayViewport
                ship={view?.hull ?? null}
                color={view?.hullColor ?? '#fff'}
                accentHue={view?.accentHue ?? 200}
                trailHue={view?.trailHue ?? null}
                drone={view?.drone ?? null}
                unlocked
                swapKey={0}
                swapDir={1}
                compact={short}
              />
            </div>

            <div className="rs-lx-idline">
              {/* $.pilotTier derives FOUNDER from ability.title, so for ONYIX
                  the tier and the ability are literally the same word - show
                  it once, on the ability line where it means something */}
              {view?.tier && view.tier !== view.ability?.title && (
                <span className="rs-lx-tier">{view.tier}</span>
              )}
              <span className="rs-lx-hull">{view?.hullTitle || '—'}</span>
            </div>

            {view?.ability && (
              <p className="rs-lx-ability">
                <span className="rs-lx-ability-name">{view.ability.title}</span>
                <span className="rs-lx-ability-text">{view.ability.text}</span>
              </p>
            )}

            {/* pilot level is the one permanent thing this run will move */}
            {view && (
              <div className="rs-lx-level">
                <div className="rs-lx-level-top">
                  <span className="rs-hg-bay-cap">Pilot level</span>
                  <span className="rs-num rs-lx-level-val">
                    {view.level}<span className="rs-lx-level-max">/{view.maxLevel}</span>
                  </span>
                </div>
                <div className="rs-meter rs-meter-xp">
                  <div className="rs-meter-fill" style={{ width: `${xpRatio}%` }} />
                </div>
                {view.damageReduction > 0 && (
                  <p className="rs-lx-level-foot rs-num">
                    −{Math.round(view.damageReduction * 100)}% damage taken, earned
                  </p>
                )}
              </div>
            )}
          </div>

          {/*--- WHAT CARRIES IN. The reason this screen exists. -----------*/}
          <div className="rs-lx-manifest">
            <div className="rs-sys-head">
              <span className="rs-sys-tick" aria-hidden style={{ background: 'var(--rs-cyan)' }} />
              <span className="rs-sys-label">Carrying in</span>
            </div>

            <div className="rs-lx-rows">
              <div className="rs-lx-row">
                <span className="rs-lx-row-key">Finish</span>
                <span className="rs-lx-row-val" style={{ color: view?.hullColor }}>{view?.finishTitle || '—'}</span>
              </div>
              <div className="rs-lx-row">
                <span className="rs-lx-row-key">Trail</span>
                <span
                  className="rs-lx-row-val"
                  style={view?.trailHue != null ? { color: `hsl(${view.trailHue}, 100%, 66%)` } : undefined}
                >
                  {view?.trailTitle || 'None'}
                </span>
              </div>
              <div className="rs-lx-row">
                <span className="rs-lx-row-key">Drone</span>
                <span className="rs-lx-row-val" style={view?.droneTitle ? { color: 'var(--rs-cyan)' } : undefined}>
                  {view?.droneTitle || 'None'}
                  {view?.droneXpBonus ? (
                    <span className="rs-lx-row-bonus rs-num"> +{Math.round(view.droneXpBonus * 100)}% XP</span>
                  ) : null}
                </span>
              </div>
            </div>

            {/* Field kits: spendable DURING the raid, so the key that spends
                them is shown here and nowhere else - this is the last moment
                the player can read it without being shot at. */}
            {view && view.carry.length > 0 ? (
              <div className="rs-lx-kits">
                {view.carry.map((c) => (
                  <div key={c.id} className="rs-lx-kit">
                    {c.key ? <span className="rs-lx-key">{c.key}</span> : <span className="rs-lx-key rs-lx-key-auto">auto</span>}
                    <span className="rs-lx-kit-body">
                      <span className="rs-lx-kit-name">{c.title}</span>
                      <span className="rs-lx-kit-note">{c.note}</span>
                    </span>
                    <span className="rs-lx-kit-count rs-num">×{c.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rs-sys-foot">
                No field kits stocked. Kits are optional — they are spent when used and mark the run assisted.
              </p>
            )}

            {/*--- today's challenge, the one real run objective ----------*/}
            {view?.freeRefit && (
              <div className="rs-lx-freebie">
                <span className="rs-lx-key rs-lx-key-auto">Auto</span>
                <span className="rs-lx-kit-body">
                  <span className="rs-lx-kit-name">Free field refit</span>
                  <span className="rs-lx-kit-note">This hull rolls one refit at launch</span>
                </span>
              </div>
            )}

            {view?.daily && (
              <div className="rs-lx-objective" data-done={view.daily.done ? '1' : '0'}>
                <div className="rs-lx-obj-head">
                  <span className="rs-hg-bay-cap">Daily challenge</span>
                  {view.daily.done ? (
                    <span className="rs-lx-obj-state rs-lx-obj-done">Cleared today</span>
                  ) : (
                    <span className="rs-lx-obj-state rs-num">+{view.daily.xp} XP</span>
                  )}
                </div>
                <p className="rs-lx-obj-text">{view.daily.text}</p>
                {view.daily.streak > 0 && (
                  <p className="rs-lx-obj-streak rs-num">{view.daily.streak} day streak riding on it</p>
                )}
              </div>
            )}
          </div>

          {/*--- the commit ------------------------------------------------*/}
          <div className="rs-lx-act">
            <button className="rs-lx-launch" onClick={launch} disabled={committing}>
              <span className="rs-lx-launch-face">
                <span className="rs-lx-launch-label">{committing ? 'Launching' : 'Launch raid'}</span>
                <span className="rs-lx-launch-sub">
                  {committing ? 'Stand by' : 'Endless · ranks on the Shooterboard'}
                </span>
              </span>
              <span className="rs-lx-launch-scan" aria-hidden />
            </button>

            {/* The daily run is a separate, real mode with its own board and
                one attempt a day - so it is a separate route, not a toggle. */}
            <button
              className="rs-btn rs-btn-ghost rs-lx-daily"
              onClick={() => go('dailyrun')}
              disabled={committing}
            >
              {view?.dailyRunPlayed
                ? 'Daily run · done for today'
                : view?.dailyRunEver
                  ? 'Daily run · one seeded attempt'
                  : 'Daily run · new'}
            </button>

            {view && !view.touch && (
              <p className="rs-lx-controls">
                <span><b>WASD</b> move</span>
                <span><b>Mouse</b> aim &amp; fire</span>
                <span><b>Shift</b> dash</span>
                <span><b>P</b> pause</span>
              </p>
            )}
            {view?.touch && (
              <p className="rs-lx-controls">
                <span>Left thumb moves</span>
                <span>Right thumb aims</span>
                <span>Double-tap left to dash</span>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* the launch wipe: the deck falls away and the raid is already running
          underneath, so DEPLOY reads as one motion instead of a page swap */}
      <div className="rs-lx-wipe" aria-hidden />

      <TabBar nav={NAV} moreOpen={moreOpen} onGo={go} onMore={() => setMoreOpen((v) => !v)} />

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
          </div>
        </>
      )}
    </div>
  );
}

/** Exposed so the engine-facing bits can tell whether this overlay is live. */
export function isLaunchOverlayActive(): boolean {
  return !!engine() && (window as unknown as Record<string, unknown>).__htmlLaunch === 1;
}
