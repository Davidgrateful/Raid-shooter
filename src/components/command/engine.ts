'use client';

import { useEffect, useState } from 'react';

/*==============================================================================
Engine bridge

The vanilla canvas engine owns the game truth: which pilot is equipped, its
colour and level, the daily challenge, the live cup. The command centre reads
that truth rather than keeping a second copy of it, so the menu can never drift
out of sync with the hangar or a run that just ended.
==============================================================================*/

export interface ShipDef {
  id: string;
  title: string;
  desc?: string;
  ability?: { title: string; text: string; startUpgrade?: number };
  bulletStyle?: { kind: string; size?: number; lineWidth?: number };
  speedMult?: number;
  damageTakenMult?: number;
  dashCooldownMult?: number;
  radius?: number;
  /** Purchase-gated pilots carry the market id that unlocks them. */
  unlock?: { purchase?: string; stat?: string; value?: number; label?: string } | null;
  comingSoon?: boolean;
  /** Drones carry their own tint and pilot-XP bonus. */
  color?: string;
  xpBonus?: number;
  draw: (ctx: CanvasRenderingContext2D, r: number, fill: string, tick: number) => void;
}

export interface TrailDef { id: string; title: string; hue: number }
export interface ColorDef { title: string; color: string }
export interface MarketItem {
  id: string;
  title: string;
  kind: string;
  priceUsd?: number;
  priceEth?: string;
  /** Charges granted per purchase (consumables only). */
  stack?: number;
  /** The catalogue's own effect line, e.g. "PASSIVE: BULLETS PIERCE ENEMIES". */
  ability?: string;
  comingSoon?: boolean;
}

export interface Engine {
  state?: string;
  storage?: Record<string, unknown>;
  definitions?: {
    characters: ShipDef[];
    shipColors: ColorDef[];
    drones?: ShipDef[];
    trails?: TrailDef[];
    premiumColors?: { id: string; title: string; color: string }[];
  };
  setState: (s: string) => void;
  updateStorage?: () => void;
  currentCharacter: () => ShipDef;
  pilotLevel: (id: string) => number;
  pilotXp: (id: string) => number;
  pilotMaxLevel: number;
  pilotXpToNext: (id: string) => { xp: number; next: number } | null;
  equippedDrone?: () => ShipDef | null;
  equippedTrail?: () => { id: string; title: string; hue: number } | null;
  dailyChallenge?: () => { text: string; stat: string; n: number };
  dailyDone?: () => boolean;
  dailyStreak?: () => number;
  dailyNextXp?: () => number;
  dailyRunPlayedToday?: () => boolean;
  promptPilotName?: () => void;
  ensurePilotName?: () => void;
  tierFor?: (score: number) => { name: string; color: string; next?: { name: string; min: number } };
  activeSeason?: { title: string; prizeShort?: string; prizeLine?: string; endsAt?: number } | null;
  cupLive?: () => boolean;
  cupLabel?: () => string;
  cupTimeLeft?: () => string;
  session?: { authenticated: boolean; address: string | null; guestId: string | null };
  fetchProfile?: () => void;
  /** A reward-only cosmetic granted since the player's last visit. */
  celebration?: { id: string; title: string } | null;
  markRewardSeen?: (id: string) => void;
  boardTab?: string;
  tick?: number;
  comboMultiplier?: number;

  /*--- hangar surface ------------------------------------------------------
  Everything the bay needs to describe a hull truthfully. These are the same
  helpers the canvas hangar has always used; the overlay reads them rather
  than recomputing anything, so the two can never disagree. */
  characterUnlocked?: (def: ShipDef) => boolean;
  characterStatus?: (def: ShipDef) => { text: string; color: string };
  pilotTier?: (def: ShipDef, index: number) => { label: string; hue: number };
  pilotAccentHue?: (index: number) => number;
  pilotStats?: (def: ShipDef) => { SPD: number; FIRE: number; ARM: number; DASH: number };
  pilotLevelThresholds?: number[];
  pilotLevelDamageMult?: (id: string) => number;
  ownsItem?: (id: string) => boolean;
  droneXpLabel?: (drone: ShipDef | null) => string;
  consumableCount?: (id: string) => number;
  profile?: { items: string[]; consumables: Record<string, number>; fetched?: number };
  marketState?: { fetched?: number; loading?: number; enabled?: boolean; network?: string; treasury?: string | null; items?: MarketItem[] };
  fetchMarket?: () => void;
  audio?: { play?: (name: string) => void };

  /*--- armory surface ------------------------------------------------------
  The purchase pipeline is the engine's, not ours: buyItem enforces the wallet
  and treasury gates and hands off to MarketBridge, which settles on Base and
  reports back. The overlay drives that pipeline and reads its status - it
  never simulates a purchase. */
  buyItem?: (item: MarketItem) => void;
  purchase?: { status: string; itemId: string | null };
  purchaseStatusText?: () => string;
  itemRarity?: (item: MarketItem) => { label: string; color: string } | null;
  usd?: (n: number) => string;
  applyOwnedItems?: () => void;
  guestToken?: () => string;

  /*--- raid surface --------------------------------------------------------
  The run itself. Everything in this block except pilot XP is RUN-ONLY: the
  engine wipes it in $.reset(), and $.upgrades in particular is a draft that
  exists for one raid and is discarded at game over. The interface must never
  present a draft pick as something the player keeps. */
  upgradeChoices?: UpgradeDef[];
  upgrades?: Record<string, number>;
  chooseUpgrade?: (id: string) => void;
  bossDraftQueued?: number;
  level?: { current: number; kills: number; killsToLevel: number };
  isTouchDevice?: boolean;
  reset?: () => void;
  trackRun?: (event: string, value?: number) => void;
  music?: { start?: () => void };
}

export interface UpgradeDef {
  id: string;
  title: string;
  desc: string;
  /** Hard stack cap. Every upgrade in this game is bounded. */
  max: number;
}

export function engine(): Engine | null {
  if (typeof window === 'undefined') return null;
  const e = (window as unknown as { $?: Engine }).$;
  return e && typeof e.setState === 'function' ? e : null;
}

/** Run `fn` against the engine, swallowing the "not booted yet" window. */
export function withEngine<T>(fn: (e: Engine) => T): T | undefined {
  try {
    const e = engine();
    return e ? fn(e) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The engine's current screen. It dispatches `raidshooter:state`, but a
 * component can mount after a transition has already fired, so we also poll -
 * the same belt-and-braces the board overlay needed.
 */
export function useEngineState(): string {
  const [state, setState] = useState<string>('');

  useEffect(() => {
    const onState = (e: Event) => setState(((e as CustomEvent).detail as string) || '');
    window.addEventListener('raidshooter:state', onState as EventListener);
    const iv = setInterval(() => {
      const s = engine()?.state;
      if (typeof s === 'string') setState((prev) => (s === prev ? prev : s));
    }, 250);
    return () => {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      clearInterval(iv);
    };
  }, []);

  return state;
}

/**
 * A ticking revision number for anything that has to be re-read from the
 * engine. The engine mutates `$.storage` in place - a hangar swap, a finished
 * run, a claimed drop - and emits no events for it, so the only honest way to
 * stay in sync is to look again. Bumps immediately on activation, then every
 * 1.5s while the screen is up, and stops entirely when it is not.
 */
export function useEngineRevision(active: boolean): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const bump = () => { if (alive) setRev((r) => r + 1); };
    const first = setTimeout(bump, 0);
    const iv = setInterval(bump, 1500);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [active]);
  return rev;
}

/*------------------------------------------------------------------------------
Player snapshot - everything the identity panel needs, read straight from the
engine on each revision.
------------------------------------------------------------------------------*/
export interface PlayerSnapshot {
  callSign: string;
  ship: ShipDef | null;
  shipColor: string;
  trailHue: number | null;
  droneTitle: string | null;
  level: number;
  maxLevel: number;
  xp: number;
  xpInto: number;
  xpSpan: number;
  best: number;
  tierName: string;
  tierColor: string;
  toNextTier: { name: string; min: number } | null;
  runs: number;
  kills: number;
  authenticated: boolean;
}

const TIER_FALLBACK: { name: string; color: string; next?: { name: string; min: number } } = { name: 'BRONZE', color: '#cd7f32' };

export function readPlayer(): PlayerSnapshot | null {
  const e = engine();
  if (!e || !e.definitions) return null;
  try {
    const store = (e.storage || {}) as Record<string, number | string>;
    const ship = e.currentCharacter();
    const colors = e.definitions.shipColors || [];
    const colorIndex = Number(store['ship'] || 0);
    const level = e.pilotLevel(ship.id);
    const toNext = e.pilotXpToNext(ship.id);
    const xp = e.pilotXp(ship.id);
    // XP inside the CURRENT level, not the lifetime total - a bar that starts
    // 90% full on a fresh level would read as a lie
    const thresholds = (e as unknown as { pilotLevelThresholds: number[] }).pilotLevelThresholds || [];
    const floor = thresholds[level - 1] ?? 0;
    const ceiling = toNext ? toNext.next : xp;
    const best = Number(store['score'] || 0);
    const tier = e.tierFor ? e.tierFor(best) : TIER_FALLBACK;
    const trail = e.equippedTrail?.() || null;
    const drone = e.equippedDrone?.() || null;

    return {
      callSign: String(store['pilotname'] || '').toUpperCase() || 'UNNAMED PILOT',
      ship,
      shipColor: colors[colorIndex]?.color || '#fff',
      trailHue: trail ? trail.hue : null,
      droneTitle: drone ? drone.title : null,
      level,
      maxLevel: e.pilotMaxLevel || 10,
      xp,
      xpInto: Math.max(0, xp - floor),
      xpSpan: Math.max(1, ceiling - floor),
      best,
      tierName: tier?.name || TIER_FALLBACK.name,
      tierColor: tier?.color || TIER_FALLBACK.color,
      toNextTier: tier?.next || null,
      runs: Number(store['rounds'] || 0),
      kills: Number(store['kills'] || 0),
      authenticated: !!e.session?.authenticated,
    };
  } catch {
    return null;
  }
}
