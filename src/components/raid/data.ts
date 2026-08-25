'use client';

import { engine, withEngine, type ShipDef } from '@/components/command/engine';

/*==============================================================================
RAID DATA LAYER — pre-flight, the draft, and the debrief

The single hardest rule on these three screens is the one about what SURVIVES.
The engine draws a very sharp line and the interface has to draw the same one:

  RUN-ONLY   score, kills, combo, hull, the level ladder, powerup timers and -
             critically - $.upgrades. `$.resetUpgrades()` wipes the draft on
             every reset, so a pick made at level 4 is gone the moment the run
             ends. It is a build for one raid, never a purchase.

  PERMANENT  pilot XP (storage.pilotxp), the personal best, lifetime tallies,
             the daily-challenge completion + streak, and the Shooterboard
             standing.

Every number below is read from one of those two places. Nothing is modelled
here that the engine does not already track.
==============================================================================*/

/*------------------------------------------------------------------------------
UPGRADE EFFECTS

`$.definitions.upgrades` carries a title and a vague line ("SHOOT FASTER"). The
real magnitude lives in `recomputeUpgrades()`, which is where these come from -
each is that function's own arithmetic, restated so a player can read it before
committing:

    rapid       baseFireRate    *= 0.85 ^ n
    multi       baseCount        = 1 + n
    heavy       bullet.damage   *= 1.4 ^ n
    pierce      pierceCap        = 1 + 2n   (basePiercing on at n >= 1)
    velocity    bulletSpeed     *= 1.2 ^ n ,  range += 50n
    thrusters   vmax/accel      *= 1.12 ^ n
    hull        damageTakenMult *= 0.85 ^ n
    lucky       dropChance      *= 1 + 0.6n
    overcharge  powerupDuration *= 1 + 0.5n

`step` is what ONE more pick changes, phrased as the player experiences it.
Nothing here is invented; if an id ever appears without an entry, the card
falls back to the engine's own description rather than to a guess.
------------------------------------------------------------------------------*/
/*
`gloss: false` marks the two upgrades whose engine description just restates
the number - MULTI SHOT's "+1 BULLET PER SHOT" against a step of "+1 bullet
every shot", OVERCHARGE's "POWERUPS LAST LONGER" against "+50% powerup
duration". Printing both is noise on a card read in two seconds. Everywhere
else the plain-language line earns its place (PIERCING ROUNDS explains what
piercing actually does), so it stays.
*/
/*
THREE lanes, not four. An earlier pass had a MOBILITY lane coloured cyan, which
broke the colour contract: cyan means equip / active / navigation / system
state everywhere else in this game, so spending it on a refit category made a
card look like a system control. THRUSTERS moves to SURVIVAL, which is also the
truer reading - recomputeUpgrades() spends it on $.hero.vmax and $.hero.accel,
and in a bullet-hell the thing top speed buys you is dodging.

That leaves each lane on a colour that already means what the lane means:
OFFENCE red (damage), SURVIVAL green (ready/holding), SALVAGE gold (what you
pick up). No lane borrows a reserved colour.
*/
export const UPGRADE_EFFECT: Record<string, {
  step: string;
  lane: 'offence' | 'survival' | 'salvage';
  gloss?: false;
}> = {
  rapid: { step: '−15% time between shots', lane: 'offence' },
  multi: { step: '+1 bullet every shot', lane: 'offence', gloss: false },
  heavy: { step: '+40% bullet damage', lane: 'offence' },
  pierce: { step: '+2 enemies pierced per shot', lane: 'offence' },
  velocity: { step: '+20% bullet speed, +50 range', lane: 'offence' },
  thrusters: { step: '+12% top speed', lane: 'survival' },
  hull: { step: '−15% damage taken', lane: 'survival' },
  lucky: { step: '+60% powerup drop chance', lane: 'salvage' },
  overcharge: { step: '+50% powerup duration', lane: 'salvage', gloss: false },
};

export interface DraftCard {
  id: string;
  title: string;
  /** The engine's own one-line description. */
  desc: string;
  /** What one more pick actually changes, from recomputeUpgrades(). */
  step: string | null;
  /** False where the engine's description only restates the step. */
  gloss: boolean;
  lane: string;
  /** Stacks already taken this run, and the hard cap. */
  owned: number;
  max: number;
  isNew: boolean;
}

export interface DraftView {
  level: number;
  cards: DraftCard[];
  /** A boss kill queues a bonus second pick ($.bossDraftQueued). */
  bonusQueued: boolean;
}

export function readDraft(): DraftView | null {
  const e = engine();
  if (!e) return null;
  try {
    const raw = e.upgradeChoices || [];
    if (!raw.length) return null;
    const taken = e.upgrades || {};
    return {
      level: (e.level?.current ?? 0) + 1,
      bonusQueued: !!e.bossDraftQueued,
      cards: raw.map((def) => {
        const owned = taken[def.id] || 0;
        const hit = UPGRADE_EFFECT[def.id];
        return {
          id: def.id,
          title: def.title,
          desc: (def.desc || '').replace(/\n/g, ' '),
          step: hit ? hit.step : null,
          gloss: hit ? hit.gloss !== false : true,
          lane: hit ? hit.lane : 'offence',
          owned,
          max: def.max,
          isNew: owned === 0,
        };
      }),
    };
  } catch {
    return null;
  }
}

export function chooseUpgrade(id: string): void {
  withEngine((e) => e.chooseUpgrade?.(id));
}

/*==============================================================================
PRE-FLIGHT

The question this screen exists to answer is "what am I taking in with me", and
that is a real question because four different things genuinely carry into a
run and the player currently cannot see any of them together:

  the hull + its finish and trail   (storage)
  the drone and its real XP bonus   (profile + drones.js)
  field kits, spendable mid-raid    (profile.consumables)
  an XP boost, if one is stocked    (profile.consumables)
  today's daily challenge           (daily.js, deterministic from the date)

Everything below is one of those. There is no "readiness score" or other
invented aggregate, because the engine has nothing of the kind.
==============================================================================*/

export interface CarryItem {
  id: string;
  title: string;
  count: number;
  /** The key that spends it mid-run, where one exists. */
  key: string | null;
  note: string;
}

export interface LaunchView {
  hull: ShipDef | null;
  hullTitle: string;
  hullColor: string;
  accentHue: number;
  tier: string;
  ability: { title: string; text: string } | null;
  level: number;
  maxLevel: number;
  xpInto: number;
  xpSpan: number;
  atMaxLevel: boolean;
  /** −N% damage taken, earned from levels. Real: $.pilotLevelDamageMult. */
  damageReduction: number;
  finishTitle: string;
  trailTitle: string | null;
  trailHue: number | null;
  droneTitle: string | null;
  droneXpBonus: number | null;
  drone: ShipDef | null;
  carry: CarryItem[];
  /** ONYIX-style abilities roll a free refit at launch (ability.startUpgrade). */
  freeRefit: boolean;
  /** Has /api/profile answered? Until it has, "no kits" is unknown, not false. */
  profileLoaded: boolean;
  best: number;
  /** Today's challenge, and whether it is already banked. */
  daily: { text: string; done: boolean; xp: number; streak: number } | null;
  dailyRunPlayed: boolean;
  dailyRunEver: boolean;
  touch: boolean;
}

/** Field kits the engine can actually spend during a run, with their real keys. */
const CARRY_DEFS: { id: string; title: string; key: string | null; note: string }[] = [
  { id: 'consumable_health', title: 'Health pack', key: '1', note: 'Restores 40% hull' },
  { id: 'consumable_shield', title: 'Shield charge', key: '2', note: 'Raises a full shield' },
  { id: 'consumable_revive', title: 'Revive token', key: null, note: 'Offered once, on death' },
  { id: 'consumable_xpboost', title: 'XP boost', key: null, note: 'Doubles pilot XP, spent at launch' },
];

export function readLaunch(): LaunchView | null {
  const e = engine();
  if (!e || !e.definitions) return null;
  try {
    const store = (e.storage || {}) as Record<string, unknown>;
    const hull = e.currentCharacter();
    const colors = e.definitions.shipColors || [];
    const colorIndex = Number(store['ship'] || 0);
    const index = Math.min(Number(store['character'] || 0), e.definitions.characters.length - 1);
    const level = e.pilotLevel(hull.id);
    const toNext = e.pilotXpToNext(hull.id);
    const xp = e.pilotXp(hull.id);
    const thresholds = e.pilotLevelThresholds || [];
    const floor = thresholds[level - 1] ?? 0;
    const ceiling = toNext ? toNext.next : xp;
    const trail = e.equippedTrail?.() || null;
    const drone = e.equippedDrone?.() || null;
    const damageMult = e.pilotLevelDamageMult?.(hull.id);

    return {
      hull,
      hullTitle: hull.title,
      hullColor: colors[colorIndex]?.color || '#fff',
      accentHue: e.pilotAccentHue?.(index) ?? 200,
      tier: e.pilotTier?.(hull, index)?.label || '',
      ability: hull.ability ? { title: hull.ability.title, text: hull.ability.text } : null,
      level,
      maxLevel: e.pilotMaxLevel || 10,
      xpInto: Math.max(0, xp - floor),
      xpSpan: Math.max(1, ceiling - floor),
      atMaxLevel: !toNext,
      damageReduction: typeof damageMult === 'number' ? Math.max(0, 1 - damageMult) : 0,
      finishTitle: colors[colorIndex]?.title || '—',
      trailTitle: trail ? trail.title : null,
      trailHue: trail ? trail.hue : null,
      droneTitle: drone ? drone.title : null,
      droneXpBonus: drone && typeof drone.xpBonus === 'number' ? drone.xpBonus : null,
      drone,
      carry: CARRY_DEFS.map((c) => ({ ...c, count: e.consumableCount?.(c.id) ?? 0 })).filter((c) => c.count > 0),
      // $.reset() rolls one random upgrade for a hull whose ability sets
      // startUpgrade (game.js) - a real thing that carries into every run
      freeRefit: !!hull.ability?.startUpgrade,
      profileLoaded: !!e.profile?.fetched,
      best: Number(store['score'] || 0),
      daily: e.dailyChallenge
        ? {
            text: e.dailyChallenge().text,
            done: !!e.dailyDone?.(),
            xp: e.dailyNextXp?.() ?? 0,
            streak: e.dailyStreak?.() ?? 0,
          }
        : null,
      dailyRunPlayed: !!e.dailyRunPlayedToday?.(),
      dailyRunEver: !!store['dailyrunever'],
      touch: !!e.isTouchDevice,
    };
  } catch {
    return null;
  }
}

/** Start an endless raid, exactly as the canvas button always has. */
export function launchEndless(): void {
  withEngine((e) => {
    e.reset?.();
    e.trackRun?.('run_start');
    e.audio?.play?.('levelup');
    e.music?.start?.();
    e.setState('play');
  });
}
