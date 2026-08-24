'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { HullView, SlotItem, StatView } from './data';

/*==============================================================================
SYSTEMS COLUMN

The right side of the bay is a technical readout for the hull on the cradle -
one continuous instrument column divided by hairline rules, not a stack of
floating cards. Cards would be the dashboard habit; a spec sheet is what a
hangar terminal actually looks like, and it lets four unrelated systems
(performance, armament, loadout, tuning) sit together without each one
demanding its own frame.

Every number here comes from the engine. Where the game has no system, the
section says so plainly instead of inventing one.
==============================================================================*/

export function SystemSection({
  label,
  note,
  children,
  tone,
}: {
  label: string;
  note?: ReactNode;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <section className="rs-sys">
      <div className="rs-sys-head">
        <span className="rs-sys-tick" aria-hidden style={tone ? { background: tone } : undefined} />
        <span className="rs-sys-label">{label}</span>
        {note && <span className="rs-sys-note">{note}</span>}
      </div>
      <div className="rs-sys-body">{children}</div>
    </section>
  );
}

/*------------------------------------------------------------------------------
Performance: the four bars the engine already derives from a hull's tuning
numbers ($.pilotStats). Segmented, because a segmented bar reads as a gauge
and a smooth one reads as a progress bar - these are measurements, not
progress. When you are browsing a hull you do not fly, each row also carries
the difference against the one you do.
------------------------------------------------------------------------------*/
const CELLS = 12;

function StatRow({ stat }: { stat: StatView }) {
  // A hull with a real but tiny value (NOVA's armour reads 3) rounded to zero
  // lit cells, which looks like missing data rather than like "almost none".
  const filled = stat.value > 0 ? Math.max(1, Math.round(stat.value * CELLS)) : 0;
  const delta = stat.delta;
  const dir = delta === null || Math.abs(delta) < 0.02 ? 0 : delta > 0 ? 1 : -1;
  return (
    <div className="rs-stat">
      <span className="rs-stat-key">{stat.key}</span>
      <span className="rs-stat-gauge" role="img" aria-label={`${stat.label} ${Math.round(stat.value * 100)} of 100`}>
        {Array.from({ length: CELLS }, (_, i) => (
          <i key={i} data-on={i < filled ? '1' : '0'} />
        ))}
      </span>
      <span className="rs-stat-num rs-num">{String(Math.round(stat.value * 100)).padStart(2, '0')}</span>
      <span className="rs-stat-delta" data-dir={dir}>
        {dir === 0 ? '' : `${dir > 0 ? '▲' : '▼'}${Math.abs(Math.round((delta as number) * 100))}`}
      </span>
    </div>
  );
}

export function StatBank({ stats, comparing, muted }: { stats: StatView[]; comparing: boolean; muted: boolean }) {
  if (!stats.length) return <p className="rs-sys-empty">Performance data unavailable for this hull.</p>;
  // The gauges are deliberately NOT tinted with the pilot's accent hue. Colour
  // carries meaning in this game - gold is earned progression, cyan is action
  // and selection - and a per-pilot hue would have painted a stat bar gold on
  // one hull and red on the next while meaning exactly the same thing. The
  // accent stays where it is a legend: the bay lighting and the roster strip.
  return (
    <>
      <div className="rs-stat-bank" data-muted={muted ? '1' : '0'}>
        {stats.map((s) => (
          <StatRow key={s.key} stat={s} />
        ))}
      </div>
      {comparing && <p className="rs-sys-foot">Change against your equipped hull</p>}
    </>
  );
}

/*------------------------------------------------------------------------------
Armament: the hull's real weapon profile and its ability, both straight from
the character definition.
------------------------------------------------------------------------------*/
export function SpecRow({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rs-spec">
      <span className="rs-spec-key">{label}</span>
      <span className="rs-spec-val" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

/*------------------------------------------------------------------------------
Loadout racks: colour, trail, drone. Each chip is a real catalogue entry -
owned chips equip on click, unowned ones carry their real price and route to
the armory. Nothing here is a placeholder.
------------------------------------------------------------------------------*/
export function Rack({
  items,
  kind,
  onEquip,
  onAcquire,
}: {
  items: SlotItem[];
  kind: 'color' | 'trail' | 'drone';
  onEquip: (item: SlotItem, index: number) => void;
  onAcquire: () => void;
}) {
  return (
    <div className="rs-rack" data-kind={kind}>
      {items.map((item, i) => {
        const locked = !item.owned;
        return (
          <button
            key={item.id}
            type="button"
            className="rs-slot"
            data-locked={locked ? '1' : '0'}
            data-on={item.equipped ? '1' : '0'}
            title={
              locked
                ? item.rewardOnly
                  ? `${item.title} — won, never sold`
                  : `${item.title} — locked`
                : item.equipped
                  ? `${item.title} — equipped`
                  : `Equip ${item.title}`
            }
            onClick={() => (locked ? onAcquire() : onEquip(item, i))}
          >
            {kind === 'drone' && item.def ? (
              <DroneGlyph item={item} />
            ) : (
              <span
                className="rs-slot-swatch"
                aria-hidden
                style={item.color ? { background: item.color } : undefined}
              />
            )}
            <span className="rs-slot-body">
              <span className="rs-slot-name">{item.title}</span>
              {kind === 'drone' && item.note && <span className="rs-slot-note">{item.note}</span>}
              {kind === 'drone' && item.def?.xpBonus ? (
                <span className="rs-slot-xp">+{Math.round(item.def.xpBonus * 100)}% pilot XP</span>
              ) : null}
            </span>
            {locked ? (
              <span className="rs-slot-tag">
                {item.rewardOnly ? 'Won' : item.priceUsd !== null ? `$${item.priceUsd.toFixed(2)}` : 'Locked'}
              </span>
            ) : item.equipped ? (
              <span className="rs-slot-tag rs-slot-tag-on">On</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** A drone renders itself — the same draw() the game flies. */
function DroneGlyph({ item }: { item: SlotItem }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const def = item.def;
    if (!c || !def || typeof def.draw !== 'function') return;
    const size = 26;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    try {
      def.draw(ctx, size * 0.36, item.color || 'hsl(190, 90%, 62%)', 0);
    } catch {
      /* a drone that cannot draw simply shows an empty slot */
    }
  }, [item.def, item.color]);
  return <canvas ref={ref} className="rs-slot-swatch rs-slot-glyph" aria-hidden />;
}

/*------------------------------------------------------------------------------
TUNING

The honest section. Raid Shooter has exactly one way to make a hull stronger,
and it is not purchasable: fly it. Pilot levels are earned from kills, and each
level trims 1% off the damage that hull takes (see $.pilotLevelDamageMult in
characters.js, applied in hero.js). That is shown here as what it is.

There is NO persistent upgrade system in this game - `upgrades.js` deals only
in draft picks that exist inside a single run and are discarded at gameover.
So the second half of this section is an explicitly empty bay: the right shape,
correctly sized, marked unavailable. When an upgrade system does land, it drops
into this slot without a relayout. It is not filled with a mock-up in the
meantime.
------------------------------------------------------------------------------*/
export function TuningBlock({ hull }: { hull: HullView }) {
  const pct = Math.round(hull.damageReduction * 100);
  const levelsLeft = hull.maxLevel - hull.level;
  return (
    <>
      <div className="rs-tune">
        <div className="rs-tune-row">
          <span className="rs-tune-key">Hull plating</span>
          <span className="rs-tune-val rs-num" data-earned={pct > 0 ? '1' : '0'}>
            {pct > 0 ? `−${pct}% damage taken` : 'No bonus yet'}
          </span>
        </div>
        <div className="rs-tune-ladder" aria-hidden>
          {Array.from({ length: hull.maxLevel }, (_, i) => (
            <i key={i} data-on={i < hull.level ? '1' : '0'} />
          ))}
        </div>
        <p className="rs-tune-note">
          {hull.atMaxLevel
            ? 'Fully tuned. This hull has earned every level it can.'
            : `Each level trims 1% more damage. ${levelsLeft} level${levelsLeft === 1 ? '' : 's'} left to earn — kills only, never sold.`}
        </p>
      </div>

      {/* The slot a real upgrade system will occupy. Empty on purpose. */}
      <div className="rs-tune-slot" aria-label="Component upgrades — not yet available">
        <span className="rs-tune-slot-tag">Component upgrades</span>
        <span className="rs-tune-slot-state">Not yet available</span>
      </div>
    </>
  );
}
