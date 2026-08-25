'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WalletButton } from '@/components/WalletButton';
import { NAV } from '@/components/command/CommandCenter';
import { NavRail, TabBar } from '@/components/command/hud';
import { IconMail, IconSystem } from '@/components/command/icons';
import { engine, useEngineRevision, useEngineState, withEngine } from '@/components/command/engine';
import { BayViewport } from './BayViewport';
import { Rack, SpecRow, StatBank, SystemSection, TuningBlock } from './systems';
import { equipColor, equipDrone, equipHull, equipTrail, readHangar, type HangarView, type HullView, type SlotItem } from './data';

/*==============================================================================
PILOT / HANGAR

The command deck answers "what do I do next". This screen answers a different
question — "what do I own, and how do I make it stronger" — so it is built as a
different kind of place rather than as the deck with different cards in it.

  THE BAY        a hull sitting in a physical dock: floor, gantries, cradle,
                 bay lighting. Larger than on the deck, because this is where
                 it lives. Browsing the roster swaps hulls in and out of the
                 cradle with the same cinematic the canvas hangar always had.
  IDENTITY       who this hull is: tier, name, role, and its level ladder
  SYSTEMS        one instrument column, hairline-ruled: performance, armament,
                 loadout, tuning

DATA RULE, held to strictly: nothing on this screen is invented. Stats come
from $.pilotStats, tier from $.pilotTier, lock state from $.characterUnlocked,
levels from the real XP thresholds, ownership from the server profile, prices
from the live market catalogue. Where the game has no system — component
upgrades — the screen shows an explicitly empty slot rather than a mock-up.
==============================================================================*/

export function HangarScreen() {
  const state = useEngineState();
  const onHangar = state === 'hangar';
  const rev = useEngineRevision(onHangar);

  const [view, setView] = useState<HangarView | null>(null);
  const [index, setIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [short, setShort] = useState(false);
  const [swap, setSwap] = useState({ key: 0, dir: 1 });
  const [tab, setTab] = useState<'systems' | 'loadout'>('systems');
  const enteredRef = useRef(false);

  /* --- take the screen off the canvas, once ---------------------------- */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlHangar = 1;
  }, []);

  /* --- phone landscape is ~380px tall: the compact bay ------------------ */
  useEffect(() => {
    const f = () => setShort(window.innerHeight < 560);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  /* --- read the engine's truth on every revision ------------------------ */
  // The read is deferred by a tick so the engine's own state settles first
  // and so this never re-enters render synchronously. Entering the bay also
  // parks the cradle on the hull the player actually flies - that belongs in
  // the same pass, since it depends on the value just read.
  useEffect(() => {
    if (!onHangar) {
      enteredRef.current = false;
      return;
    }
    // the catalogue carries the real prices for locked hulls and cosmetics;
    // ask for it once, and simply show no price until it lands
    withEngine((e) => {
      if (!e.marketState?.fetched && !e.marketState?.loading) {
        e.fetchMarket?.();
        e.fetchProfile?.();
      }
    });
    const t = setTimeout(() => {
      const next = readHangar();
      setView(next);
      if (next && !enteredRef.current) {
        enteredRef.current = true;
        setIndex(next.equippedIndex);
        setTab('systems');
      }
    }, 0);
    return () => clearTimeout(t);
  }, [onHangar, rev]);

  const hulls = view?.hulls || [];
  const hull = hulls[index] || null;

  const browse = useCallback(
    (dir: number) => {
      setIndex((i) => {
        const n = hulls.length;
        if (!n) return i;
        return (i + dir + n) % n;
      });
      setSwap((s) => ({ key: s.key + 1, dir }));
    },
    [hulls.length],
  );

  const jump = useCallback(
    (target: number) => {
      setIndex((i) => {
        if (target === i) return i;
        setSwap((s) => ({ key: s.key + 1, dir: target > i ? 1 : -1 }));
        return target;
      });
    },
    [],
  );

  /* --- keyboard: the bay is browsable without a mouse ------------------- */
  useEffect(() => {
    if (!onHangar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { browse(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { browse(1); e.preventDefault(); }
      else if (e.key === 'Escape') { withEngine((x) => x.setState('menu')); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHangar, browse]);

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

  const refresh = useCallback(() => setView(readHangar()), []);

  const onEquipHull = useCallback(() => {
    if (!hull || !hull.unlocked || hull.equipped) return;
    equipHull(hull.index);
    withEngine((e) => e.audio?.play?.('powerup'));
    refresh();
  }, [hull, refresh]);

  const openArmory = useCallback(() => go('market'), [go]);

  const equippedHull = hulls[view?.equippedIndex ?? 0] || null;
  const droneXp = view?.droneXpBonus ?? null;

  const heldConsumables = useMemo(
    () => (view?.consumables || []).filter((c) => c.count > 0),
    [view],
  );

  if (!onHangar) return null;

  const hullColor = withEngine((e) => {
    const colors = e.definitions?.shipColors || [];
    return colors[Number(e.storage?.['ship'] || 0)]?.color;
  }) || '#fff';
  const trailHue = withEngine((e) => e.equippedTrail?.()?.hue ?? null) ?? null;
  const equippedDrone = withEngine((e) => e.equippedDrone?.() ?? null) ?? null;

  return (
    <div data-game-ui="" className="rs-cc rs-hg" data-short={short ? '1' : '0'}>
      <div aria-hidden className="rs-cc-veil rs-hg-veil" />

      {/*==================================================================
      HEADER — where you are, which bay, and the wallet that owns the hulls
      ==================================================================*/}
      <header className="rs-cc-top rs-hg-top">
        <div className="rs-hg-where">
          <button type="button" className="rs-hg-back" onClick={() => go('menu')} aria-label="Back to command deck">
            <span aria-hidden>‹</span>
          </button>
          <span className="rs-hg-title">Hangar</span>
          {hull && (
            <span className="rs-hg-bay">
              <span className="rs-hg-bay-cap">Bay</span>
              <span className="rs-num">{String(hull.index + 1).padStart(2, '0')}</span>
              <span className="rs-hg-bay-of">/ {hulls.length}</span>
            </span>
          )}
        </div>
        <div className="rs-hud-wallet"><WalletButton /></div>
      </header>

      <NavRail
        nav={NAV}
        active="pilot"
        onGo={go}
        onHome={() => go('menu')}
        onInvite={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'invite' }))}
        onFeedback={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'feedback' }))}
      />

      {/*==================================================================
      THE BAY
      ==================================================================*/}
      <main className="rs-cc-main rs-hg-main rs-scroll">
        <div className="rs-hg-stage">
          <div className="rs-hg-bayframe">
            <BayViewport
              ship={hull?.def ?? null}
              color={hullColor}
              accentHue={hull?.accentHue ?? 200}
              trailHue={hull?.equipped ? trailHue : null}
              drone={hull?.equipped ? equippedDrone : null}
              unlocked={!!hull?.unlocked}
              swapKey={swap.key}
              swapDir={swap.dir}
              compact={short}
            />

            {/* dock controls sit ON the bay, not under it — they move the
                cradle, so they belong to the bay */}
            <button className="rs-hg-arrow rs-hg-arrow-l" onClick={() => browse(-1)} aria-label="Previous hull">
              <span aria-hidden>‹</span>
            </button>
            <button className="rs-hg-arrow rs-hg-arrow-r" onClick={() => browse(1)} aria-label="Next hull">
              <span aria-hidden>›</span>
            </button>

            {hull && (
              <>
                <div className="rs-hg-plate rs-hg-plate-l">
                  <span className="rs-hg-plate-cap">Dock</span>
                  <span className="rs-hg-plate-val" style={{ color: `hsl(${hull.accentHue}, 90%, 66%)` }}>
                    {hull.equipped ? 'Active' : hull.unlocked ? 'Standby' : 'Sealed'}
                  </span>
                </div>
                {hull.hullRadius !== null && (
                  <div className="rs-hg-plate rs-hg-plate-r">
                    <span className="rs-hg-plate-cap">Frame</span>
                    <span className="rs-hg-plate-val rs-num">{hull.hullRadius}m</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/*--- roster strip: every hull in the bay, at a glance ---------*/}
          <div className="rs-roster rs-scroll" role="tablist" aria-label="Hulls">
            {hulls.map((h) => (
              <button
                key={h.def.id}
                role="tab"
                aria-selected={h.index === index}
                className="rs-roster-slot"
                data-on={h.index === index ? '1' : '0'}
                data-locked={h.unlocked ? '0' : '1'}
                data-equipped={h.equipped ? '1' : '0'}
                style={{ '--slot-hue': String(h.accentHue) } as React.CSSProperties}
                title={h.unlocked ? h.title : `${h.title} — locked`}
                onClick={() => jump(h.index)}
              >
                <span className="rs-roster-num rs-num">{String(h.index + 1).padStart(2, '0')}</span>
                <span className="rs-roster-bar" aria-hidden />
              </button>
            ))}
          </div>

          {/*--- identity: who this hull is ------------------------------*/}
          {hull && (
            <div className="rs-hg-id">
              <div className="rs-hg-id-line">
                <span className="rs-hg-tier" style={{ '--tier-hue': String(hull.tier.hue) } as React.CSSProperties}>
                  {hull.tier.label}
                </span>
                {hull.equipped && <span className="rs-hg-flag">Equipped</span>}
                {!hull.unlocked && <span className="rs-hg-flag rs-hg-flag-locked">Locked</span>}
              </div>
              <h1 className="rs-hg-name">{hull.title}</h1>
              <p className="rs-hg-role">{hull.desc.replace(/\n/g, ' · ') || '—'}</p>

              {/*--- level ladder: the one progression this game has ------*/}
              {hull.unlocked ? (
                <div className="rs-hg-level">
                  <div className="rs-hg-level-top">
                    <span className="rs-hg-level-cap">Pilot level</span>
                    <span className="rs-hg-level-val rs-num">
                      {hull.level}<span className="rs-hg-level-max">/{hull.maxLevel}</span>
                    </span>
                  </div>
                  <div className="rs-meter rs-meter-xp" role="progressbar" aria-valuemin={0} aria-valuemax={hull.xpSpan} aria-valuenow={hull.xpInto}>
                    <div
                      className="rs-meter-fill"
                      style={{ width: `${hull.atMaxLevel ? 100 : Math.min(100, (hull.xpInto / hull.xpSpan) * 100)}%` }}
                    />
                  </div>
                  <p className="rs-hg-level-foot rs-num">
                    {hull.atMaxLevel
                      ? `${hull.xpTotal.toLocaleString()} XP · max level`
                      : `${hull.xpInto.toLocaleString()} / ${hull.xpSpan.toLocaleString()} XP to level ${hull.level + 1}`}
                  </p>
                </div>
              ) : hull.lock?.kind === 'purchase' && hull.lock.priceUsd !== null ? null : (
                /* only when it carries something the acquire button does not -
                   a stat requirement, or a price the catalogue has not loaded */
                <p className="rs-hg-lockline">{hull.lock?.text || 'Locked'}</p>
              )}

              {/*--- the one action this screen exists for ----------------*/}
              <div className="rs-hg-act">
                {hull.equipped ? (
                  <button className="rs-btn rs-btn-ghost" onClick={() => go('playmode')}>Deploy this hull</button>
                ) : hull.unlocked ? (
                  <button className="rs-hg-equip" onClick={onEquipHull}>
                    <span className="rs-hg-equip-face">Equip {hull.title}</span>
                  </button>
                ) : (
                  <button className="rs-hg-acquire" onClick={openArmory}>
                    <span className="rs-hg-acquire-face">{acquireLabel(hull)}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/*==================================================================
      SYSTEMS — one instrument column, not a pile of cards
      ==================================================================*/}
      <aside className="rs-cc-ops rs-hg-sys rs-scroll">
        {/* on phones the column splits in two so neither half needs a
            marathon scroll; on desktop both are simply present */}
        <div className="rs-hg-tabs" role="tablist" aria-label="Systems">
          <button role="tab" aria-selected={tab === 'systems'} data-on={tab === 'systems' ? '1' : '0'} onClick={() => setTab('systems')}>
            Systems
          </button>
          <button role="tab" aria-selected={tab === 'loadout'} data-on={tab === 'loadout' ? '1' : '0'} onClick={() => setTab('loadout')}>
            Loadout
          </button>
        </div>

        {hull && (
          <div className="rs-hg-pane" data-pane="systems" data-on={tab === 'systems' ? '1' : '0'}>
            <SystemSection
              label="Performance"
              tone={`hsl(${hull.accentHue}, 90%, 60%)`}
              note={hull.equipped ? 'Your hull' : equippedHull ? `vs ${equippedHull.title}` : undefined}
            >
              <StatBank stats={hull.stats} comparing={!hull.equipped} muted={!hull.unlocked} />
            </SystemSection>

            <SystemSection label="Armament" tone="var(--rs-purple)">
              <SpecRow label="Ordnance" value={hull.ordnance || 'Standard'} />
              {hull.ability ? (
                <>
                  <SpecRow label="Ability" value={hull.ability.title} tone="var(--rs-purple)" />
                  <p className="rs-sys-text">{hull.ability.text}</p>
                </>
              ) : (
                <p className="rs-sys-empty">This hull carries no special ability.</p>
              )}
            </SystemSection>

            <SystemSection label="Tuning" tone="var(--rs-gold)">
              <TuningBlock hull={hull} />
            </SystemSection>
          </div>
        )}

        <div className="rs-hg-pane" data-pane="loadout" data-on={tab === 'loadout' ? '1' : '0'}>
          {view && (
            <>
              <SystemSection
                label="Hull finish"
                note={view.colors.filter((c) => c.owned).length + ' of ' + view.colors.length}
              >
                <Rack
                  items={view.colors}
                  kind="color"
                  onEquip={(item, i) => { equipColor(i); refresh(); }}
                  onAcquire={openArmory}
                />
              </SystemSection>

              <SystemSection label="Engine trail" note={`${view.trails.filter((t) => t.owned).length} of ${view.trails.length}`}>
                <Rack
                  items={view.trails}
                  kind="trail"
                  onEquip={(item: SlotItem) => { equipTrail(item.id); refresh(); }}
                  onAcquire={openArmory}
                />
              </SystemSection>

              <SystemSection
                label="Combat drone"
                tone="var(--rs-cyan)"
                note={droneXp !== null ? `+${Math.round(droneXp * 100)}% pilot XP active` : undefined}
              >
                <Rack
                  items={view.drones}
                  kind="drone"
                  onEquip={(item: SlotItem) => { equipDrone(item.id); refresh(); }}
                  onAcquire={openArmory}
                />
                <p className="rs-sys-foot">One drone at a time. Drones change how a run feels and speed up levelling — they never change your score.</p>
              </SystemSection>

              <SystemSection label="Field stock">
                {heldConsumables.length ? (
                  <div className="rs-stock">
                    {heldConsumables.map((c) => (
                      <span key={c.id} className="rs-stock-item">
                        <span className="rs-stock-name">{c.title}</span>
                        <span className="rs-stock-count rs-num">×{c.count}</span>
                      </span>
                    ))}
                  </div>
                ) : !view.profileLoaded ? (
                  /* not "you have none" until the profile has actually said so */
                  <p className="rs-sys-empty">Reading your hold…</p>
                ) : (
                  <p className="rs-sys-empty">
                    {view.walletLinked ? 'No consumables in stock.' : 'Link a wallet to carry consumables into a raid.'}
                  </p>
                )}
              </SystemSection>
            </>
          )}
        </div>
      </aside>

      <TabBar nav={NAV} active="pilot" moreOpen={moreOpen} onGo={go} onMore={() => setMoreOpen((v) => !v)} />

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
            <button className="rs-nav-item" onClick={() => { setMoreOpen(false); window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'invite' })); }}>
              <span className="rs-nav-icon text-[color:var(--rs-gold)]">✦</span><span>Invite a wingman</span>
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

/*------------------------------------------------------------------------------
The acquire button says exactly what the catalogue says, and nothing more. Until
the catalogue has loaded there is no price to show, so it does not show one.
------------------------------------------------------------------------------*/
function acquireLabel(hull: HullView): string {
  if (hull.lock?.kind === 'soon') return 'Not yet in service';
  const price = hull.lock?.priceUsd;
  return typeof price === 'number' ? `Acquire · $${price.toFixed(2)}` : 'Acquire in the armory';
}

/** Exposed so the engine-facing bits can tell whether this overlay is live. */
export function isHangarOverlayActive(): boolean {
  return !!engine() && (window as unknown as Record<string, unknown>).__htmlHangar === 1;
}
