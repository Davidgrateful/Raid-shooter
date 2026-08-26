'use client';

import { useEffect, useRef } from 'react';
import { Recover } from '@/components/command/Recover';
import { SpecRow, SystemSection } from '@/components/hangar/systems';
import type { ArmoryItem, EquippedView, RackId } from './data';

/*==============================================================================
RACKS + MANIFEST

The armory keeps the hangar's component language on purpose: hairline-ruled
instrument sections, tabular figures, technical captions. What changes is what
those instruments are pointed at - the hangar reports on one hull you own, the
armory reports on a stock list and what swapping into it would do.

A rack is a wall of slots, not a grid of product cards. Each slot is small, it
shows the real object where the game can draw one, and its state (owned,
equipped, on order) is carried by the slot's own edge rather than by a badge
bolted onto a card.
==============================================================================*/

/*------------------------------------------------------------------------------
Rack selector - which wall of the armory you are standing at.
------------------------------------------------------------------------------*/
export function RackTabs({
  racks,
  active,
  counts,
  onPick,
}: {
  racks: { id: RackId; label: string; short: string }[];
  active: RackId;
  counts: Record<string, { owned: number; total: number }>;
  onPick: (id: RackId) => void;
}) {
  return (
    <div className="rs-am-racks" role="tablist" aria-label="Armory racks">
      {racks.map((r) => {
        const c = counts[r.id] || { owned: 0, total: 0 };
        return (
          <button
            key={r.id}
            role="tab"
            aria-selected={r.id === active}
            className="rs-am-rack"
            data-on={r.id === active ? '1' : '0'}
            onClick={() => onPick(r.id)}
          >
            <span className="rs-am-rack-label">{r.label}</span>
            <span className="rs-am-rack-label rs-am-rack-label-sm">{r.short}</span>
            <span className="rs-am-rack-count rs-num">
              {c.owned}<span className="rs-am-rack-of">/{c.total}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/*------------------------------------------------------------------------------
A single slot on the wall. Small, real, and honest about its state.
------------------------------------------------------------------------------*/
export function Slot({
  item,
  selected,
  onPick,
}: {
  item: ArmoryItem;
  selected: boolean;
  onPick: () => void;
}) {
  const state = item.equipped ? 'equipped' : item.owned ? 'owned' : item.comingSoon ? 'soon' : 'stock';
  return (
    <button
      type="button"
      className="rs-am-slot"
      data-on={selected ? '1' : '0'}
      data-state={state}
      aria-pressed={selected}
      onClick={onPick}
      title={item.title}
    >
      <span className="rs-am-slot-art" aria-hidden>
        {item.shipDef || item.droneDef ? (
          <ObjectGlyph item={item} />
        ) : item.swatch ? (
          <span className="rs-am-slot-swatch" style={{ background: item.swatch }} />
        ) : (
          <span className="rs-am-slot-kit rs-num">{item.stack ? `×${item.stack}` : '—'}</span>
        )}
      </span>

      <span className="rs-am-slot-body">
        <span className="rs-am-slot-name">{item.title}</span>
        <span className="rs-am-slot-meta">
          {item.equipped ? (
            <span className="rs-am-tag rs-am-tag-on">Equipped</span>
          ) : item.owned ? (
            <span className="rs-am-tag rs-am-tag-owned">Owned</span>
          ) : item.comingSoon ? (
            <span className="rs-am-tag">Soon</span>
          ) : item.priceUsd !== null ? (
            <span className="rs-am-slot-price rs-num">${item.priceUsd.toFixed(2)}</span>
          ) : (
            /* no catalogue, no price - never a placeholder $0.00 */
            <span className="rs-am-slot-price rs-am-slot-price-wait">— —</span>
          )}
          {item.held !== null && item.held > 0 && (
            <span className="rs-am-slot-held rs-num">{item.held} held</span>
          )}
        </span>
      </span>

      {item.rarity && (
        <span className="rs-am-slot-rarity" style={{ background: item.rarity.color }} aria-hidden />
      )}
    </button>
  );
}

/** Ships and drones draw themselves — the same functions the game flies. */
function ObjectGlyph({ item }: { item: ArmoryItem }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const def = item.shipDef || item.droneDef;
  const isHull = !!item.shipDef;
  useEffect(() => {
    const c = ref.current;
    if (!c || !def || typeof def.draw !== 'function') return;
    const size = 34;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    // an unowned object is still shown in full - this is a showroom, and a
    // grey silhouette would make stock look broken rather than desirable
    if (isHull) ctx.rotate(-Math.PI / 2);
    try {
      def.draw(ctx, size * (isHull ? 0.24 : 0.36), item.swatch || 'hsl(190, 95%, 66%)', 0);
    } catch {
      /* an object that cannot draw simply shows an empty slot */
    }
  }, [def, isHull, item.swatch]);
  return <canvas ref={ref} className="rs-am-slot-canvas" aria-hidden />;
}

/*------------------------------------------------------------------------------
MANIFEST - what you are flying right now.

This is the first thing the armory says, because "what am I using" has to be
answerable before "what could I buy" means anything. It is a readout of the
same storage the hangar writes, so the two can never disagree.
------------------------------------------------------------------------------*/
export function Manifest({
  equipped,
  profileLoaded,
  profileLoading,
  profileFailed,
  onRetryProfile,
  suppressRetry = false,
  onHangar,
}: {
  equipped: EquippedView;
  /** Until the profile answers, an empty kit list is unknown, not empty. */
  profileLoaded: boolean;
  profileLoading: boolean;
  profileFailed: boolean;
  onRetryProfile: () => void;
  /** The screen is already showing one retry that covers this failure too. */
  suppressRetry?: boolean;
  onHangar: () => void;
}) {
  return (
    <SystemSection
      label="Current loadout"
      tone="var(--rs-green)"
      note={<button className="rs-am-manifest-link" onClick={onHangar}>Hangar ›</button>}
    >
      <SpecRow label="Hull" value={equipped.hull?.title || '—'} />
      <SpecRow label="Finish" value={equipped.finishTitle} tone={equipped.hullColor} />
      <SpecRow
        label="Trail"
        value={equipped.trailTitle || 'None'}
        tone={equipped.trailHue !== null ? `hsl(${equipped.trailHue}, 100%, 66%)` : undefined}
      />
      <SpecRow
        label="Drone"
        value={
          equipped.droneTitle
            ? `${equipped.droneTitle}${equipped.droneXpBonus ? ` · +${Math.round(equipped.droneXpBonus * 100)}% XP` : ''}`
            : 'None'
        }
        tone={equipped.droneTitle ? 'var(--rs-cyan)' : undefined}
      />
      {equipped.kit.length > 0 ? (
        <div className="rs-am-kit">
          {equipped.kit.map((k) => (
            <span key={k.id} className="rs-am-kit-item">
              <span>{k.title}</span>
              <span className="rs-num">×{k.count}</span>
            </span>
          ))}
        </div>
      ) : profileFailed && suppressRetry ? (
        /* Named, but not given a second button - see `suppressRetry`. */
        <p className="rs-sys-foot">Hold unavailable.</p>
      ) : profileFailed ? (
        /* This used to say "reading your hold" forever, because the profile
           request swallowed its own failure. It now says what happened and
           offers the way out. */
        <Recover
          message="Hold unavailable."
          busy={profileLoading}
          onRetry={onRetryProfile}
          tone="line"
        />
      ) : !profileLoaded ? (
        <p className="rs-sys-foot">Reading your hold…</p>
      ) : (
        <p className="rs-sys-foot">No field kit carried. Kits are spent when used in a raid.</p>
      )}
    </SystemSection>
  );
}
