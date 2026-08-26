'use client';

import { engine, type MarketItem, type ShipDef } from '@/components/command/engine';
import { STAT_KEYS, STAT_LABEL, type StatView } from '@/components/hangar/data';

/*==============================================================================
ARMORY DATA LAYER

Same rule as the hangar, and it matters more here because this screen takes
money: every price, every ownership flag, every stock count and every effect
line is read from the live catalogue and the server profile. Nothing is
defaulted to a plausible number.

In particular:
  - a price is `null` until /api/market has actually answered, and the UI
    renders that as "no price yet", never as $0.00
  - `owned` is the server profile's word (`$.ownsItem`), never inferred
  - `equipped` is the engine's storage, so it agrees with the hangar
  - stat deltas come from $.pilotStats, the same function the hangar draws
  - trails and finishes are cosmetic and carry no stats, so none are invented
    for them
==============================================================================*/

/** The five racks, one per real catalogue kind. */
export type RackId = 'hull' | 'drone' | 'trail' | 'finish' | 'kit';

export const RACKS: { id: RackId; label: string; short: string; kind: string; blurb: string }[] = [
  { id: 'hull', label: 'Hulls', short: 'Hulls', kind: 'character', blurb: 'Flight frames — each flies differently' },
  { id: 'drone', label: 'Drones', short: 'Drones', kind: 'drone', blurb: 'One escort at a time, passive effect' },
  { id: 'trail', label: 'Trails', short: 'Trails', kind: 'trail', blurb: 'Engine wake — cosmetic' },
  { id: 'finish', label: 'Finish', short: 'Finish', kind: 'color', blurb: 'Hull paint — cosmetic' },
  // five walls have to fit a 390px strip without the last one being sliced in
  // half - a cut label reads as a rendering fault, not as "scroll me"
  { id: 'kit', label: 'Field kit', short: 'Kit', kind: 'consumable', blurb: 'Carried into a raid, spent on use' },
];

const KIND_TO_RACK: Record<string, RackId> = {
  character: 'hull',
  drone: 'drone',
  trail: 'trail',
  color: 'finish',
  consumable: 'kit',
};

export interface ArmoryItem {
  id: string;
  /** Catalogue title with the rack-redundant suffix trimmed (NOVA PILOT → NOVA). */
  title: string;
  rack: RackId;
  kind: string;
  /** Real catalogue price. Null until the catalogue has loaded. */
  priceUsd: number | null;
  owned: boolean;
  equipped: boolean;
  comingSoon: boolean;
  rarity: { label: string; color: string } | null;
  /** The catalogue's own effect line, cleaned of its PASSIVE: prefix. */
  effect: string | null;
  /** Charges granted per purchase, and how many are in stock right now. */
  stack: number | null;
  held: number | null;
  /** Swatch colour for finishes and trails. */
  swatch: string | null;
  trailHue: number | null;
  /** Field kits only: does spending this flag the run as assisted? */
  assists: boolean | null;
  /** Renderable definitions, so the bay can show the real object. */
  shipDef: ShipDef | null;
  droneDef: ShipDef | null;
  /** Index into the engine's own arrays, for equipping. */
  hullIndex: number | null;
  colorIndex: number | null;
  /** Hulls only: tier, accent and the four real gauges with deltas. */
  tier: { label: string; hue: number } | null;
  accentHue: number | null;
  stats: StatView[] | null;
  droneXpBonus: number | null;
}

export interface EquippedView {
  hull: { title: string; def: ShipDef | null; accentHue: number; tier: string } | null;
  hullColor: string;
  finishTitle: string;
  trailTitle: string | null;
  trailHue: number | null;
  droneTitle: string | null;
  droneXpBonus: number | null;
  /** Consumables actually in stock, ready to carry into a raid. */
  kit: { id: string; title: string; count: number }[];
}

export interface ArmoryView {
  items: ArmoryItem[];
  equipped: EquippedView;
  /** Has /api/market answered yet? Prices are meaningless before this. */
  catalogueLoaded: boolean;
  catalogueLoading: boolean;
  /** The catalogue request came back failed - distinct from "not answered yet". */
  catalogueFailed: boolean;
  /** Is a treasury configured? If not, nothing can be settled. */
  paymentsLive: boolean;
  network: string;
  walletLinked: boolean;
  /** Has /api/profile answered? Ownership is unknown until it has. */
  profileLoaded: boolean;
  profileLoading: boolean;
  profileFailed: boolean;
  ownedCount: number;
  sellableCount: number;
}

/*------------------------------------------------------------------------------
Trim the suffix a rack already says. "NOVA PILOT" inside a rack headed HULLS is
just noise; the name is the part that identifies the thing.
------------------------------------------------------------------------------*/
const SUFFIX: Record<RackId, RegExp | null> = {
  hull: /\s+PILOT$/,
  drone: /\s+DRONE$/,
  trail: /\s+ENGINE TRAIL$/,
  finish: /\s+SHIP SKIN$/,
  kit: null,
};

function cleanTitle(raw: string, rack: RackId): string {
  const re = SUFFIX[rack];
  const trimmed = re ? raw.replace(re, '') : raw;
  return trimmed.trim() || raw;
}

/** The catalogue prefixes drone effects with PASSIVE:; the rack already says so. */
function cleanEffect(ability: string | undefined): string | null {
  if (!ability) return null;
  return ability.replace(/^PASSIVE:\s*/i, '').trim() || null;
}

/*------------------------------------------------------------------------------
Field-kit effects.

The catalogue only carries an `ability` line for XP BOOST, but the other three
kits do real, specific things - and those numbers are in the engine, not in
anyone's imagination:

  health   $.useConsumable('consumable_health')  -> life += 0.4   (game.js)
  shield   $.useConsumable('consumable_shield')  -> full shield powerup
  revive   $.continueRun()                       -> life = 0.4 + shield, once

So the kits report what the engine actually does. The assist flag is real too:
the three combat kits set $.runAssisted for the operator's audit trail, while
XP BOOST deliberately does not - a boosted run still ranks normally. That
distinction matters to a player deciding what to carry, so it is shown.
------------------------------------------------------------------------------*/
const KIT_EFFECT: Record<string, { effect: string; assists: boolean }> = {
  consumable_health: { effect: 'Restores 40% of the hull, mid-raid', assists: true },
  consumable_shield: { effect: 'Raises a full shield, mid-raid', assists: true },
  consumable_revive: { effect: 'One revive per raid at 40% hull, with a shield', assists: true },
  consumable_xpboost: { effect: 'Doubles pilot XP for the raid', assists: false },
};

/*------------------------------------------------------------------------------
The whole armory, read in one pass.
------------------------------------------------------------------------------*/
export function readArmory(): ArmoryView | null {
  const e = engine();
  if (!e || !e.definitions?.characters?.length) return null;

  try {
    const store = (e.storage || {}) as Record<string, unknown>;
    const market = e.marketState || {};
    const catalogue: MarketItem[] = market.items || [];
    const catalogueLoaded = !!market.fetched;
    const roster = e.definitions.characters;
    const colors = e.definitions.shipColors || [];
    const trails = e.definitions.trails || [];
    const drones = e.definitions.drones || [];

    const colorIndex = Number(store['ship'] || 0);
    const equippedHullIndex = Math.min(Number(store['character'] || 0), roster.length - 1);
    const equippedHull = roster[equippedHullIndex];
    const equippedStats = e.pilotStats?.(equippedHull) || null;
    const equippedTrailId = String(store['trail'] || '');
    const equippedDroneId = String(store['drone'] || '');
    const equippedDrone = e.equippedDrone?.() || null;

    const items: ArmoryItem[] = catalogue.map((raw) => {
      const rack = KIND_TO_RACK[raw.kind] || 'kit';
      const stackable = raw.kind === 'consumable';
      const owned = stackable ? false : !!e.ownsItem?.(raw.id);

      /*--- hulls: the full character definition, plus real gauges ---------*/
      let shipDef: ShipDef | null = null;
      let hullIndex: number | null = null;
      let stats: StatView[] | null = null;
      let tier: { label: string; hue: number } | null = null;
      let accentHue: number | null = null;
      if (rack === 'hull') {
        const charId = raw.id.replace(/^pilot_/, '');
        const idx = roster.findIndex((c) => c.id === charId);
        if (idx >= 0) {
          hullIndex = idx;
          shipDef = roster[idx];
          tier = e.pilotTier?.(shipDef, idx) || null;
          accentHue = e.pilotAccentHue?.(idx) ?? 200;
          const own = e.pilotStats?.(shipDef) || null;
          if (own) {
            stats = STAT_KEYS.map((key) => ({
              key,
              label: STAT_LABEL[key],
              value: own[key],
              delta: equippedStats && idx !== equippedHullIndex ? own[key] - equippedStats[key] : null,
            }));
          }
        }
      }

      /*--- drones: the real def and its real XP bonus ---------------------*/
      let droneDef: ShipDef | null = null;
      let droneXpBonus: number | null = null;
      if (rack === 'drone') {
        droneDef = drones.find((d) => d.id === raw.id) || null;
        droneXpBonus = droneDef && typeof droneDef.xpBonus === 'number' ? droneDef.xpBonus : null;
      }

      /*--- cosmetics: a real swatch, no invented stats --------------------*/
      let swatch: string | null = null;
      let trailHue: number | null = null;
      let cIndex: number | null = null;
      if (rack === 'trail') {
        const t = trails.find((x) => x.id === raw.id);
        if (t) {
          trailHue = t.hue;
          swatch = `hsl(${t.hue}, 100%, 62%)`;
        }
      } else if (rack === 'finish') {
        const premium = (e.definitions?.premiumColors || []).find((p) => p.id === raw.id);
        if (premium) swatch = premium.color;
        const idx = colors.findIndex((c) => premium && c.title === premium.title);
        if (idx >= 0) cIndex = idx;
      }

      /*--- equipped state, per rack --------------------------------------*/
      let equipped = false;
      if (rack === 'hull') equipped = hullIndex === equippedHullIndex;
      else if (rack === 'drone') equipped = owned && raw.id === equippedDroneId;
      else if (rack === 'trail') equipped = owned && raw.id === equippedTrailId;
      else if (rack === 'finish') equipped = owned && cIndex !== null && cIndex === colorIndex;

      return {
        id: raw.id,
        title: cleanTitle(raw.title, rack),
        rack,
        kind: raw.kind,
        priceUsd: catalogueLoaded && typeof raw.priceUsd === 'number' ? raw.priceUsd : null,
        owned,
        equipped,
        comingSoon: !!raw.comingSoon,
        rarity: e.itemRarity?.(raw) || null,
        effect: cleanEffect(raw.ability) || (stackable ? KIT_EFFECT[raw.id]?.effect ?? null : null),
        assists: stackable ? KIT_EFFECT[raw.id]?.assists ?? null : null,
        stack: stackable ? raw.stack || 1 : null,
        held: stackable ? e.consumableCount?.(raw.id) ?? 0 : null,
        swatch,
        trailHue,
        shipDef,
        droneDef,
        hullIndex,
        colorIndex: cIndex,
        tier,
        accentHue,
        stats,
        droneXpBonus,
      };
    });

    /*--- what the player is flying right now ------------------------------*/
    const trailDef = e.equippedTrail?.() || null;
    const equippedView: EquippedView = {
      hull: equippedHull
        ? {
            title: equippedHull.title,
            def: equippedHull,
            accentHue: e.pilotAccentHue?.(equippedHullIndex) ?? 200,
            tier: e.pilotTier?.(equippedHull, equippedHullIndex)?.label || '',
          }
        : null,
      hullColor: colors[colorIndex]?.color || '#fff',
      finishTitle: colors[colorIndex]?.title || '—',
      trailTitle: trailDef ? trailDef.title : null,
      trailHue: trailDef ? trailDef.hue : null,
      droneTitle: equippedDrone ? equippedDrone.title : null,
      droneXpBonus: equippedDrone && typeof equippedDrone.xpBonus === 'number' ? equippedDrone.xpBonus : null,
      kit: items
        .filter((i) => i.rack === 'kit' && (i.held || 0) > 0)
        .map((i) => ({ id: i.id, title: i.title, count: i.held || 0 })),
    };

    return {
      items,
      equipped: equippedView,
      catalogueLoaded,
      catalogueLoading: !!market.loading,
      catalogueFailed: !!market.failed,
      paymentsLive: !!market.enabled,
      network: market.network || '',
      walletLinked: !!e.session?.authenticated,
      profileLoaded: !!e.profile?.fetched,
      profileLoading: !!e.profile?.loading,
      profileFailed: !!e.profile?.failed,
      ownedCount: items.filter((i) => i.owned).length,
      sellableCount: items.filter((i) => !i.comingSoon).length,
    };
  } catch {
    return null;
  }
}

/*==============================================================================
ACTIONS

What the button does is decided by real state, never by hope. There are exactly
six outcomes and each maps to something the engine can actually do.
==============================================================================*/
export type ActionKind =
  | 'equipped'      // you already have this on
  | 'equip'         // owned, not equipped - a pure local state change
  | 'acquire'       // purchasable, wallet linked, treasury configured
  | 'authorize'     // needs a wallet before anything can be bought
  | 'offline'       // no treasury configured; nothing can settle
  | 'soon'          // catalogue marks it as not yet in service
  | 'pending';      // catalogue has not answered yet, so there is no price

export interface Action {
  kind: ActionKind;
  label: string;
  /** Only ever set from the live catalogue. */
  priceUsd: number | null;
}

export function actionFor(item: ArmoryItem, view: ArmoryView): Action {
  if (item.comingSoon) return { kind: 'soon', label: 'Not yet in service', priceUsd: null };
  if (item.equipped) return { kind: 'equipped', label: 'Equipped', priceUsd: null };
  if (item.owned) return { kind: 'equip', label: `Equip ${item.title}`, priceUsd: null };
  if (!view.catalogueLoaded || item.priceUsd === null) {
    return { kind: 'pending', label: 'Reading manifest', priceUsd: null };
  }
  // No price on these two: neither button buys anything, and a figure on them
  // reads as the cost of connecting a wallet. The real price stays on the slot
  // and in the requisition readout.
  if (!view.walletLinked) return { kind: 'authorize', label: 'Authorize wallet', priceUsd: null };
  if (!view.paymentsLive) return { kind: 'offline', label: 'Requisition offline', priceUsd: null };
  // consumables restock, so they never read as "owned" - they read as a resupply
  const verb = item.rack === 'kit' ? 'Requisition' : 'Acquire';
  return { kind: 'acquire', label: verb, priceUsd: item.priceUsd };
}

/** Hand the item to the engine's own purchase pipeline. */
export function acquire(itemId: string): void {
  const e = engine();
  const raw = (e?.marketState?.items || []).find((i) => i.id === itemId);
  if (!e || !raw) return;
  e.buyItem?.(raw);
}

/*------------------------------------------------------------------------------
Purchase status. These are the engine's ten real states, given in-universe
wording. Nothing here invents a state the pipeline cannot reach.
------------------------------------------------------------------------------*/
export const PURCHASE_COPY: Record<string, { text: string; tone: 'work' | 'good' | 'bad' }> = {
  guest: { text: 'Wallet required to requisition', tone: 'bad' },
  soon: { text: 'Requisition channel offline', tone: 'bad' },
  switching: { text: 'Switching to Base', tone: 'work' },
  confirm: { text: 'Awaiting authorization in wallet', tone: 'work' },
  pending: { text: 'Settling on Base', tone: 'work' },
  done: { text: 'Transferred to your manifest', tone: 'good' },
  failed: { text: 'Settlement not verified', tone: 'bad' },
  cancelled: { text: 'Requisition cancelled', tone: 'bad' },
  insufficient_funds: { text: 'Not enough ETH on Base', tone: 'bad' },
  wrong_network: { text: 'Could not switch to Base', tone: 'bad' },
};
