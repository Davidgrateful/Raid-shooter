'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WalletButton } from '@/components/WalletButton';
import { NAV } from '@/components/command/CommandCenter';
import { NavRail, TabBar } from '@/components/command/hud';
import { IconMail, IconSystem } from '@/components/command/icons';
import { engine, useEngineRevision, useEngineState, withEngine } from '@/components/command/engine';
import { BayViewport } from '@/components/hangar/BayViewport';
import { StatBank, SpecRow, SystemSection } from '@/components/hangar/systems';
import { equipColor, equipDrone, equipHull, equipTrail } from '@/components/hangar/data';
import { Manifest, RackTabs, Slot } from './racks';
import {
  acquire,
  actionFor,
  PURCHASE_COPY,
  RACKS,
  readArmory,
  type ArmoryItem,
  type ArmoryView,
  type RackId,
} from './data';

/*==============================================================================
ARMORY - the procurement deck

Third room in the same facility. The command deck asks "what do I do next", the
hangar asks "what do I own and how do I make it stronger", and this asks
"what could I be flying instead, and what would it change".

It is built as a place, not a storefront:

  MANIFEST      what you are flying right now, stated first - because
                "what would this change" is meaningless until you know
                what it would change FROM
  INSPECTION    one cradle, running the same BayViewport the hangar uses,
                so a hull under inspection here is presented exactly as it
                is presented in your own bay. Same facility, same lighting.
  RACKS         five walls matching the five real catalogue kinds. Not a
                product grid: a wall of slots, each showing the real object.
  REQUISITION   one action, driven entirely by engine state, wired to the
                engine's own purchase pipeline

DELIBERATE DIFFERENCE FROM THE HANGAR: there, a hull you do not own sits on a
dark sealed cradle, because that bay is YOUR fleet and a locked hull is not
part of it. Here everything is lit and running, because this is a showroom -
stock you cannot afford yet should read as desirable, not as an error.

WHAT IS NOT INVENTED: prices come from the live catalogue and are simply
absent until it answers; ownership is the server profile; stat deltas are
$.pilotStats; trails and finishes carry no stats because the game gives them
none; and the purchase pipeline is the engine's, so every status shown here is
one the payment flow can actually reach.
==============================================================================*/

export function ArmoryScreen() {
  const state = useEngineState();
  const onMarket = state === 'market';
  const rev = useEngineRevision(onMarket);

  const [view, setView] = useState<ArmoryView | null>(null);
  const [rack, setRack] = useState<RackId>('hull');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [swap, setSwap] = useState({ key: 0, dir: 1 });
  const [status, setStatus] = useState<{ status: string; itemId: string | null } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [short, setShort] = useState(false);
  const [pane, setPane] = useState<'stock' | 'manifest'>('stock');
  const enteredRef = useRef(false);

  /* --- take the screen off the canvas, once ---------------------------- */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlMarket = 1;
  }, []);

  useEffect(() => {
    const f = () => setShort(window.innerHeight < 560);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  /* --- the purchase pipeline reports through an event, so listen to it
         rather than polling: a settlement can change state in under a
         second and a 1.5s tick would show it late ------------------------ */
  useEffect(() => {
    const onPurchase = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setStatus({ status: String(d.status || ''), itemId: d.itemId ?? null });
      // a completed purchase re-reads the profile; give the engine a beat to
      // land the grant, then re-read what we show
      if (d.status === 'done') setTimeout(() => setView(readArmory()), 600);
    };
    window.addEventListener('raidshooter:purchase', onPurchase as EventListener);
    return () => window.removeEventListener('raidshooter:purchase', onPurchase as EventListener);
  }, []);

  /* --- read the engine's truth on every revision ------------------------ */
  useEffect(() => {
    if (!onMarket) {
      enteredRef.current = false;
      return;
    }
    withEngine((e) => {
      if (!e.marketState?.fetched && !e.marketState?.loading) {
        e.fetchMarket?.();
        e.fetchProfile?.();
      }
    });
    const t = setTimeout(() => {
      const next = readArmory();
      setView(next);
      if (next && !enteredRef.current) {
        enteredRef.current = true;
        setStatus(null);
        setPane('stock');
        // open on the wall the player's own hull lives on
        setRack('hull');
      }
    }, 0);
    return () => clearTimeout(t);
  }, [onMarket, rev]);

  const items = useMemo(() => view?.items || [], [view]);
  const rackItems = useMemo(() => items.filter((i) => i.rack === rack), [items, rack]);

  // The selection is DERIVED, not synchronised: an id that is not on the
  // current wall simply falls back to the first slot. Storing a corrected id
  // back into state would mean a render pass whose only job is to fix itself.
  const selected: ArmoryItem | null = useMemo(
    () => rackItems.find((i) => i.id === selectedId) || rackItems[0] || null,
    [rackItems, selectedId],
  );

  const counts = useMemo(() => {
    const out: Record<string, { owned: number; total: number }> = {};
    for (const r of RACKS) {
      const list = items.filter((i) => i.rack === r.id);
      out[r.id] = {
        // a consumable is never "owned", it is stocked - so a kit wall counts
        // the lines you actually hold rather than pretending they are unlocks
        owned: list.filter((i) => (i.rack === 'kit' ? (i.held || 0) > 0 : i.owned)).length,
        total: list.length,
      };
    }
    return out;
  }, [items]);

  const pick = useCallback(
    (item: ArmoryItem) => {
      setSelectedId((prev) => {
        if (prev === item.id) return prev;
        const from = rackItems.findIndex((i) => i.id === prev);
        const to = rackItems.findIndex((i) => i.id === item.id);
        setSwap((s) => ({ key: s.key + 1, dir: to > from ? 1 : -1 }));
        return item.id;
      });
      setStatus(null);
    },
    [rackItems],
  );

  const pickRack = useCallback((id: RackId) => {
    setRack(id);
    setSelectedId(null);
    setStatus(null);
    setSwap((s) => ({ key: s.key + 1, dir: 1 }));
  }, []);

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

  const refresh = useCallback(() => setView(readArmory()), []);

  /* --- the one action, resolved from real state ------------------------- */
  const action = selected && view ? actionFor(selected, view) : null;

  const runAction = useCallback(() => {
    if (!selected || !action) return;
    switch (action.kind) {
      case 'equip':
        if (selected.rack === 'hull' && selected.hullIndex !== null) equipHull(selected.hullIndex);
        else if (selected.rack === 'drone') equipDrone(selected.id);
        else if (selected.rack === 'trail') equipTrail(selected.id);
        else if (selected.rack === 'finish' && selected.colorIndex !== null) equipColor(selected.colorIndex);
        withEngine((e) => e.audio?.play?.('powerup'));
        refresh();
        break;
      case 'authorize':
        // WalletButton owns wallet auth; ask it to run rather than keeping a
        // second, competing connect path here
        window.dispatchEvent(new CustomEvent('raidshooter:wallet'));
        break;
      case 'acquire':
        acquire(selected.id);
        break;
      default:
        break;
    }
  }, [selected, action, refresh]);

  if (!onMarket) return null;

  const hullColor = view?.equipped.hullColor || '#fff';
  const busy = status ? ['switching', 'confirm', 'pending'].includes(status.status) : false;
  const copy = status && status.status ? PURCHASE_COPY[status.status] : null;

  /*----------------------------------------------------------------------
  What sits on the inspection cradle. Hulls and drones draw themselves;
  a trail or a finish is previewed ON the player's own hull, because that
  is the only honest way to show what buying it would look like; a field
  kit has no model in this game, so it gets a technical plate instead of
  an invented one.
  ----------------------------------------------------------------------*/
  const bay = (() => {
    if (!selected) return null;
    if (selected.rack === 'hull') {
      return (
        <BayViewport
          ship={selected.shipDef}
          color={hullColor}
          /* The hangar lights each bay in that pilot's own accent hue. Here it
             does not: half those hues are gold, and on this screen gold means
             money and nothing else. The facility's own cyan lights every
             cradle, and a hull's identity comes from its shape and its tier. */
          accentHue={190}
          trailHue={view?.equipped.trailHue ?? null}
          drone={null}
          unlocked
          swapKey={swap.key}
          swapDir={swap.dir}
          compact={short}
        />
      );
    }
    if (selected.rack === 'drone') {
      return (
        <BayViewport
          ship={selected.droneDef}
          color={selected.droneDef?.color || 'hsl(190, 95%, 66%)'}
          accentHue={190}
          trailHue={null}
          drone={null}
          unlocked
          swapKey={swap.key}
          swapDir={swap.dir}
          compact={short}
          subject="object"
        />
      );
    }
    if (selected.rack === 'trail' || selected.rack === 'finish') {
      return (
        <BayViewport
          ship={view?.equipped.hull?.def ?? null}
          color={selected.rack === 'finish' ? selected.swatch || hullColor : hullColor}
          accentHue={190}
          trailHue={selected.rack === 'trail' ? selected.trailHue : view?.equipped.trailHue ?? null}
          drone={null}
          unlocked
          swapKey={swap.key}
          swapDir={swap.dir}
          compact={short}
        />
      );
    }
    return null;
  })();

  const rackDef = RACKS.find((r) => r.id === rack);

  return (
    <div data-game-ui="" className="rs-cc rs-am" data-short={short ? '1' : '0'}>
      <div aria-hidden className="rs-cc-veil rs-am-veil" />

      {/*==================================================================
      HEADER
      ==================================================================*/}
      <header className="rs-cc-top rs-am-top">
        <div className="rs-hg-where">
          <button type="button" className="rs-hg-back" onClick={() => go('menu')} aria-label="Back to command deck">
            <span aria-hidden>‹</span>
          </button>
          <span className="rs-hg-title">Armory</span>
          <span className="rs-hg-bay">
            <span className="rs-hg-bay-cap">Owned</span>
            <span className="rs-num">{view ? view.ownedCount : '—'}</span>
            <span className="rs-hg-bay-of">/ {view ? view.sellableCount : '—'}</span>
          </span>
        </div>

        <div className="rs-am-head-right">
          {/* settlement is a footnote, not a headline: it says whether the
              channel is open, and nothing more */}
          <span className="rs-am-channel" data-live={view?.paymentsLive ? '1' : '0'}>
            <span className="rs-am-channel-dot" aria-hidden />
            {view?.paymentsLive ? `Settles on ${view.network === 'base' ? 'Base' : 'Base Sepolia'}` : 'Requisition offline'}
          </span>
          <div className="rs-hud-wallet"><WalletButton /></div>
        </div>
      </header>

      <NavRail
        nav={NAV}
        active="armory"
        onGo={go}
        onHome={() => go('menu')}
        onInvite={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'invite' }))}
        onFeedback={() => window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: 'feedback' }))}
      />

      {/*==================================================================
      INSPECTION CRADLE + THE RACK WALL
      ==================================================================*/}
      <main className="rs-cc-main rs-am-main rs-scroll">
        <div className="rs-am-stage">
          <div className="rs-am-inspect">
            {bay ? (
              <div className="rs-hg-bayframe rs-am-bayframe">{bay}</div>
            ) : (
              /* A field kit has no model. Rather than invent one, the cradle
                 reports the thing honestly: what it does, and how many
                 charges one requisition grants. */
              <div className="rs-am-plate">
                <span className="rs-am-plate-cap">Field kit</span>
                <span className="rs-am-plate-name">{selected?.title || '—'}</span>
                {selected?.stack ? (
                  <span className="rs-am-plate-stack rs-num">
                    {selected.stack} charge{selected.stack === 1 ? '' : 's'} per requisition
                  </span>
                ) : null}
                {selected?.held !== null && selected?.held !== undefined && (
                  <span className="rs-am-plate-held">
                    In stock: <span className="rs-num">{selected.held}</span>
                  </span>
                )}
              </div>
            )}

            {selected && (
              <div className="rs-am-inspect-id">
                <div className="rs-am-inspect-line">
                  {selected.tier && (
                    <span
                      className="rs-hg-tier"
                      style={{ '--tier-hue': String(selected.tier.hue) } as React.CSSProperties}
                    >
                      {selected.tier.label}
                    </span>
                  )}
                  {selected.rarity && (
                    <span className="rs-am-rarity" style={{ color: selected.rarity.color, borderColor: selected.rarity.color }}>
                      {selected.rarity.label}
                    </span>
                  )}
                  {selected.equipped && <span className="rs-hg-flag">Equipped</span>}
                  {!selected.equipped && selected.owned && <span className="rs-am-tag rs-am-tag-owned">Owned</span>}
                </div>
                <h1 className="rs-hg-name rs-am-name">{selected.title}</h1>
                {selected.effect && <p className="rs-am-effect">{selected.effect}</p>}
                {!selected.effect && rackDef && <p className="rs-am-effect rs-am-effect-soft">{rackDef.blurb}</p>}
              </div>
            )}

            {/*--- the one action --------------------------------------*/}
            {action && (
              <div className="rs-am-act">
                <button
                  className="rs-am-cta"
                  data-kind={action.kind}
                  disabled={action.kind === 'equipped' || action.kind === 'pending' || action.kind === 'soon' || busy}
                  onClick={runAction}
                >
                  <span className="rs-am-cta-face">
                    {busy ? 'Working…' : action.label}
                    {action.priceUsd !== null && (action.kind === 'acquire' || action.kind === 'authorize' || action.kind === 'offline') && (
                      <span className="rs-am-cta-price rs-num">${action.priceUsd.toFixed(2)}</span>
                    )}
                  </span>
                </button>

                {/* the pipeline's own status, in the game's words */}
                {copy && (
                  <p className="rs-am-status" data-tone={copy.tone} role="status">
                    <span className="rs-am-status-dot" aria-hidden />
                    {copy.text}
                  </p>
                )}
                {!copy && action.kind === 'equipped' && (
                  <button className="rs-btn rs-btn-ghost rs-am-deploy" onClick={() => go('playmode')}>Deploy</button>
                )}
              </div>
            )}
          </div>

          {/*--- the rack wall -------------------------------------------*/}
          <div className="rs-am-wall">
            <RackTabs racks={RACKS} active={rack} counts={counts} onPick={pickRack} />

            {view && !view.catalogueLoaded ? (
              <p className="rs-am-wait">
                <span className="rs-am-wait-bar" aria-hidden />
                {view.catalogueLoading ? 'Reading the manifest…' : 'Manifest unavailable — retry from the command deck.'}
              </p>
            ) : (
              <div className="rs-am-slots">
                {rackItems.map((item) => (
                  <Slot key={item.id} item={item} selected={item.id === selected?.id} onPick={() => pick(item)} />
                ))}
                {!rackItems.length && <p className="rs-sys-empty">Nothing stocked on this wall.</p>}
              </div>
            )}
          </div>
        </div>
      </main>

      {/*==================================================================
      MANIFEST + COMPARISON
      ==================================================================*/}
      <aside className="rs-cc-ops rs-hg-sys rs-am-sys rs-scroll">
        <div className="rs-hg-tabs rs-am-tabs" role="tablist" aria-label="Armory panels">
          <button role="tab" aria-selected={pane === 'stock'} data-on={pane === 'stock' ? '1' : '0'} onClick={() => setPane('stock')}>
            Comparison
          </button>
          <button role="tab" aria-selected={pane === 'manifest'} data-on={pane === 'manifest' ? '1' : '0'} onClick={() => setPane('manifest')}>
            Loadout
          </button>
        </div>

        <div className="rs-hg-pane" data-on={pane === 'manifest' ? '1' : '0'}>
          {view && (
            <Manifest equipped={view.equipped} profileLoaded={view.profileLoaded} onHangar={() => go('hangar')} />
          )}
        </div>

        <div className="rs-hg-pane" data-on={pane === 'stock' ? '1' : '0'}>
          {selected && view && (
            <>
              {/* Hulls are the only things in this game with comparable
                  numbers, so they are the only things given a comparison. */}
              {selected.stats ? (
                <SystemSection
                  label="Performance"
                  tone={`hsl(${selected.accentHue ?? 200}, 90%, 60%)`}
                  note={selected.equipped ? 'Your hull' : `vs ${view.equipped.hull?.title || 'equipped'}`}
                >
                  {/* Not muted for unowned stock the way the hangar mutes a
                      sealed hull: this is a showroom, and greying out what
                      you have not bought makes it look broken rather than
                      desirable. */}
                  <StatBank stats={selected.stats} comparing={!selected.equipped} muted={false} />
                </SystemSection>
              ) : null}

              <SystemSection label="Effect" tone="var(--rs-purple)">
                {selected.effect ? (
                  <p className="rs-sys-text">{selected.effect}</p>
                ) : selected.rack === 'trail' || selected.rack === 'finish' ? (
                  <p className="rs-sys-empty">
                    Cosmetic. Changes how the hull looks, never how it flies or scores.
                  </p>
                ) : (
                  <p className="rs-sys-empty">The catalogue lists no effect for this item.</p>
                )}
                {selected.rack === 'drone' && (
                  <>
                    <SpecRow
                      label="Pilot XP"
                      value={selected.droneXpBonus ? `+${Math.round(selected.droneXpBonus * 100)}%` : '—'}
                      tone="var(--rs-gold)"
                    />
                    <SpecRow
                      label="Currently"
                      value={
                        view.equipped.droneTitle
                          ? `${view.equipped.droneTitle} · +${Math.round((view.equipped.droneXpBonus || 0) * 100)}%`
                          : 'No drone'
                      }
                    />
                    <p className="rs-sys-foot">One drone at a time. Swapping replaces what you carry.</p>
                  </>
                )}
                {selected.rack === 'kit' && (
                  <>
                    <SpecRow label="Per requisition" value={selected.stack ? `${selected.stack} charge${selected.stack === 1 ? '' : 's'}` : '—'} />
                    <SpecRow label="In stock" value={String(selected.held ?? 0)} tone="var(--rs-gold)" />
                    {selected.assists !== null && (
                      <p className="rs-sys-foot">
                        {selected.assists
                          ? 'Spending this marks the raid as assisted in the operator log. Your score still ranks.'
                          : 'Progression only — a boosted raid ranks exactly like any other.'}
                      </p>
                    )}
                  </>
                )}
              </SystemSection>

              <SystemSection label="Requisition" tone="var(--rs-gold)">
                <SpecRow
                  label="Price"
                  value={selected.priceUsd !== null ? `$${selected.priceUsd.toFixed(2)}` : 'Awaiting manifest'}
                  tone={selected.priceUsd !== null ? 'var(--rs-gold)' : undefined}
                />
                <SpecRow label="Status" value={selected.owned ? 'In your manifest' : 'In stock'} />
                {!view.walletLinked && (
                  <p className="rs-sys-foot">
                    Purchases are keyed to a wallet. Authorize one to hold anything you acquire.
                  </p>
                )}
                {view.walletLinked && !view.paymentsLive && (
                  <p className="rs-sys-foot">
                    The requisition channel has no treasury configured, so nothing can settle yet. Browsing stays open.
                  </p>
                )}
              </SystemSection>
            </>
          )}
        </div>
      </aside>

      <TabBar nav={NAV} active="armory" moreOpen={moreOpen} onGo={go} onMore={() => setMoreOpen((v) => !v)} />

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

/** Exposed so the engine-facing bits can tell whether this overlay is live. */
export function isArmoryOverlayActive(): boolean {
  return !!engine() && (window as unknown as Record<string, unknown>).__htmlMarket === 1;
}
