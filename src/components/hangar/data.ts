'use client';

import { engine, type Engine, type MarketItem, type ShipDef } from '@/components/command/engine';

/*==============================================================================
HANGAR DATA LAYER

Every value on the hangar screen is read from the engine here, once per
revision, and nothing is computed that the game does not already compute for
itself. Where a system does not exist, this file returns null rather than a
plausible-looking number - the bay is allowed to say "unavailable", it is not
allowed to make something up.

Specifically, and deliberately:
  - the four stat bars come from $.pilotStats, the same function the canvas
    hangar has always drawn
  - the tier label comes from $.pilotTier
  - lock state comes from $.characterUnlocked / $.characterStatus
  - prices come from the live market catalogue, and are simply absent until
    that catalogue has actually loaded
  - there is no persistent upgrade system in this game, so there is no
    upgrade data here (see TUNING in systems.tsx)
==============================================================================*/

export const STAT_KEYS = ['SPD', 'FIRE', 'ARM', 'DASH'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Long-form names for the four bars the engine already exposes. */
export const STAT_LABEL: Record<StatKey, string> = {
  SPD: 'Thrust',
  FIRE: 'Firepower',
  ARM: 'Armour',
  DASH: 'Dash',
};

export interface StatView {
  key: StatKey;
  label: string;
  value: number;
  /** Difference against the currently-equipped hull, or null when browsing it. */
  delta: number | null;
}

export interface LockView {
  kind: 'purchase' | 'stat' | 'soon';
  /** Market id that unlocks this hull, when it is a purchase lock. */
  itemId: string | null;
  /** Real catalogue price. Null until the catalogue has loaded. */
  priceUsd: number | null;
  text: string;
}

export interface HullView {
  index: number;
  def: ShipDef;
  title: string;
  desc: string;
  tier: { label: string; hue: number };
  accentHue: number;
  unlocked: boolean;
  equipped: boolean;
  ability: { title: string; text: string } | null;
  /** bulletStyle.kind, the pilot's real weapon profile. */
  ordnance: string | null;
  hullRadius: number | null;
  stats: StatView[];
  level: number;
  maxLevel: number;
  xpInto: number;
  xpSpan: number;
  xpTotal: number;
  atMaxLevel: boolean;
  /** Damage reduction earned from levels, as a fraction (0.04 = -4% taken). */
  damageReduction: number;
  lock: LockView | null;
}

export interface SlotItem {
  id: string;
  title: string;
  owned: boolean;
  equipped: boolean;
  /** Swatch colour where the item has one (skins, trails, drones). */
  color: string | null;
  /** Real effect line, where the game defines one. */
  note: string | null;
  priceUsd: number | null;
  /** Reward-only cosmetics are never sold - they are won. */
  rewardOnly: boolean;
  def?: ShipDef;
}

export interface HangarView {
  hulls: HullView[];
  equippedIndex: number;
  colors: SlotItem[];
  trails: SlotItem[];
  drones: SlotItem[];
  consumables: { id: string; title: string; count: number }[];
  /** Total pilot-XP multiplier currently in effect from the equipped drone. */
  droneXpBonus: number | null;
  catalogueLoaded: boolean;
  walletLinked: boolean;
  /** Has /api/profile answered? Until it has, "you own none" is unknown. */
  profileLoaded: boolean;
}

/*------------------------------------------------------------------------------
Small readers
------------------------------------------------------------------------------*/
function priceOf(items: MarketItem[], id: string | null): number | null {
  if (!id) return null;
  const hit = items.find((i) => i.id === id);
  return hit && typeof hit.priceUsd === 'number' ? hit.priceUsd : null;
}

function lockFor(e: Engine, def: ShipDef, items: MarketItem[]): LockView | null {
  if (e.characterUnlocked?.(def)) return null;
  const status = e.characterStatus?.(def);
  const text = status?.text || 'LOCKED';
  if (def.comingSoon) return { kind: 'soon', itemId: null, priceUsd: null, text };
  const itemId = def.unlock?.purchase || null;
  if (itemId) return { kind: 'purchase', itemId, priceUsd: priceOf(items, itemId), text };
  return { kind: 'stat', itemId: null, priceUsd: null, text };
}

/** Titles for the consumables the profile can hold, from the game's own market. */
const CONSUMABLES: { id: string; title: string }[] = [
  { id: 'consumable_health', title: 'Health pack' },
  { id: 'consumable_shield', title: 'Shield charge' },
  { id: 'consumable_revive', title: 'Revive token' },
  { id: 'consumable_xpboost', title: 'XP boost' },
];

/*------------------------------------------------------------------------------
The whole bay, read in one pass.
------------------------------------------------------------------------------*/
export function readHangar(): HangarView | null {
  const e = engine();
  if (!e || !e.definitions?.characters?.length) return null;

  try {
    const store = (e.storage || {}) as Record<string, unknown>;
    const items = e.marketState?.items || [];
    const catalogueLoaded = !!e.marketState?.fetched;
    const roster = e.definitions.characters;
    const equippedIndex = Math.min(Number(store['character'] || 0), roster.length - 1);
    const equippedStats = e.pilotStats?.(roster[equippedIndex]) || null;

    const hulls: HullView[] = roster.map((def, index) => {
      const raw = e.pilotStats?.(def) || null;
      const level = e.pilotLevel(def.id);
      const toNext = e.pilotXpToNext(def.id);
      const xpTotal = e.pilotXp(def.id);
      const thresholds = e.pilotLevelThresholds || [];
      const floor = thresholds[level - 1] ?? 0;
      const ceiling = toNext ? toNext.next : xpTotal;
      const damageMult = e.pilotLevelDamageMult?.(def.id);

      const stats: StatView[] = raw
        ? STAT_KEYS.map((key) => ({
            key,
            label: STAT_LABEL[key],
            value: raw[key],
            delta:
              equippedStats && index !== equippedIndex
                ? raw[key] - equippedStats[key]
                : null,
          }))
        : [];

      return {
        index,
        def,
        title: def.title,
        desc: def.desc || '',
        tier: e.pilotTier?.(def, index) || { label: '', hue: 200 },
        accentHue: e.pilotAccentHue?.(index) ?? 200,
        unlocked: !!e.characterUnlocked?.(def),
        equipped: index === equippedIndex,
        ability: def.ability ? { title: def.ability.title, text: def.ability.text } : null,
        ordnance: def.bulletStyle?.kind ? def.bulletStyle.kind.toUpperCase() : null,
        hullRadius: typeof def.radius === 'number' ? def.radius : null,
        stats,
        level,
        maxLevel: e.pilotMaxLevel || 10,
        xpInto: Math.max(0, xpTotal - floor),
        xpSpan: Math.max(1, ceiling - floor),
        xpTotal,
        atMaxLevel: !toNext,
        damageReduction: typeof damageMult === 'number' ? Math.max(0, 1 - damageMult) : 0,
        lock: lockFor(e, def, items),
      };
    });

    /*--- loadout slots. Ownership is the server profile's word, not ours. ---*/
    const baseColors = e.definitions.shipColors || [];
    const premium = e.definitions.premiumColors || [];
    const colorIndex = Number(store['ship'] || 0);
    const colors: SlotItem[] = baseColors.map((c, i) => {
      const match = premium.find((p) => p.title === c.title);
      return {
        id: match ? match.id : `color_base_${i}`,
        title: c.title,
        owned: match ? !!e.ownsItem?.(match.id) : true,
        equipped: i === colorIndex,
        color: c.color,
        note: null,
        priceUsd: match ? priceOf(items, match.id) : null,
        rewardOnly: false,
      };
    });
    // premium skins the player does not own are absent from shipColors, so
    // append them as the locked half of the rack
    premium.forEach((p) => {
      if (colors.some((c) => c.id === p.id)) return;
      colors.push({
        id: p.id,
        title: p.title,
        owned: false,
        equipped: false,
        color: p.color,
        note: null,
        priceUsd: priceOf(items, p.id),
        rewardOnly: false,
      });
    });

    const trailId = String(store['trail'] || '');
    const trails: SlotItem[] = (e.definitions.trails || []).map((t) => {
      const owned = !!e.ownsItem?.(t.id);
      return {
        id: t.id,
        title: t.title,
        owned,
        equipped: owned && t.id === trailId,
        color: `hsl(${t.hue}, 100%, 62%)`,
        note: null,
        priceUsd: priceOf(items, t.id),
        rewardOnly: !items.some((i) => i.id === t.id) && catalogueLoaded,
      };
    });

    const droneId = String(store['drone'] || '');
    const drones: SlotItem[] = (e.definitions.drones || []).map((d) => {
      const owned = !!e.ownsItem?.(d.id);
      return {
        id: d.id,
        title: d.title,
        owned,
        equipped: owned && d.id === droneId,
        color: d.color || null,
        note: d.desc || null,
        priceUsd: priceOf(items, d.id),
        rewardOnly: !items.some((i) => i.id === d.id) && catalogueLoaded,
        def: d,
      };
    });

    const equippedDrone = e.equippedDrone?.() || null;

    return {
      hulls,
      equippedIndex,
      colors,
      trails,
      drones,
      consumables: CONSUMABLES.map((c) => ({ ...c, count: e.consumableCount?.(c.id) ?? 0 })),
      droneXpBonus: equippedDrone && typeof equippedDrone.xpBonus === 'number' ? equippedDrone.xpBonus : null,
      catalogueLoaded,
      walletLinked: !!e.session?.authenticated,
      profileLoaded: !!e.profile?.fetched,
    };
  } catch {
    return null;
  }
}

/*------------------------------------------------------------------------------
Equip actions. Each one writes through the engine's own storage contract and
persists immediately, exactly as the canvas buttons did.
------------------------------------------------------------------------------*/
export function equipHull(index: number): void {
  const e = engine();
  if (!e || !e.storage) return;
  const def = e.definitions?.characters?.[index];
  if (!def || !e.characterUnlocked?.(def)) return;
  e.storage['character'] = index;
  e.updateStorage?.();
}

export function equipColor(index: number): void {
  const e = engine();
  if (!e || !e.storage) return;
  if (index < 0 || index >= (e.definitions?.shipColors?.length || 0)) return;
  e.storage['ship'] = index;
  e.updateStorage?.();
}

export function equipTrail(id: string): void {
  const e = engine();
  if (!e || !e.storage) return;
  if (id && !e.ownsItem?.(id)) return;
  e.storage['trail'] = e.storage['trail'] === id ? '' : id;
  e.updateStorage?.();
}

export function equipDrone(id: string): void {
  const e = engine();
  if (!e || !e.storage) return;
  if (id && !e.ownsItem?.(id)) return;
  e.storage['drone'] = e.storage['drone'] === id ? '' : id;
  e.updateStorage?.();
}
