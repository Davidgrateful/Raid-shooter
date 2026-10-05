// What the public About page says about the game. Every name here mirrors the
// engine's own definitions (public/game/characters.js, drones.js, bullet.js
// $.shotTraits, sectors.js) - tests/about.spec.ts checks they still agree, so
// a renamed pilot or a new drone fails a test instead of going stale here.

export interface PilotFact {
  id: string;
  name: string;
  ability: string;
  abilityText: string;
  shot: string;
  shotText: string;
  premium?: boolean;
}

export const PILOTS: PilotFact[] = [
  { id: 'onyix', name: 'ONYIX', ability: 'FOUNDER', abilityText: 'Starts every raid with a free upgrade', shot: 'HEAVY ROUND', shotText: 'Every 5th shot hits 50% harder' },
  { id: 'nova', name: 'NOVA', ability: 'SLIPSTREAM', abilityText: 'A longer dash', shot: 'LONG TRACER', shotText: 'Shots fly 15% faster and farther' },
  { id: 'tankrex', name: 'TANK REX', ability: 'BULWARK', abilityText: 'Resists damage when badly hurt', shot: 'KNOCKBACK', shotText: 'Hits shove enemies back' },
  { id: 'astravane', name: 'ASTRA VANE', ability: 'TAILWIND', abilityText: 'A longer combo window', shot: 'SEEKER', shotText: 'Darts curve toward a nearby enemy' },
  { id: 'ironhalo', name: 'IRON HALO', ability: 'OVERCHARGER', abilityText: 'Power-ups last longer', shot: 'STAGGER', shotText: 'Hits briefly stall an enemy' },
  { id: 'runepilot', name: 'RUNE PILOT', ability: 'SCAVENGER', abilityText: 'More power-up drops', shot: 'WEAVE', shotText: 'Glyphs weave, sweeping a wider lane' },
  { id: 'nebulafox', name: 'NEBULA FOX', ability: 'VAMPIRE', abilityText: 'Heals from kills', shot: 'TWIN FANGS', shotText: 'Two parallel shots at 60% each' },
  { id: 'javelin9', name: 'JAVELIN 9', ability: 'LANCER', abilityText: 'Faster bullets', shot: 'PIERCE', shotText: 'Lances pass through one more enemy' },
  { id: 'atlasbeam', name: 'ATLAS BEAM', ability: 'HEAVY CAL', abilityText: 'Sharper damage', shot: 'WIDE BEAM', shotText: 'Beams hit enemies from further out' },
  { id: 'glitchprince', name: 'GLITCH PRINCE', ability: 'JITTER', abilityText: 'Faster firing', shot: 'GLITCH HIT', shotText: 'Every 4th hit deals double' },
  { id: 'solstice', name: 'SOLSTICE', ability: 'OVERDRIVE', abilityText: 'Faster bullets, lighter armour', shot: 'SPLASH', shotText: 'Impacts splash 25% to nearby enemies', premium: true },
  { id: 'crimsonwisp', name: 'CRIMSON WISP', ability: 'EMBER WAKE', abilityText: 'Heals from kills', shot: 'EMBER SPARK', shotText: 'A kill sparks 35% onto the next enemy', premium: true },
  { id: 'voltrider', name: 'RIDER', ability: 'HEAVY THROTTLE', abilityText: 'Speeds up the longer you survive', shot: 'RICOCHET', shotText: 'Shots bounce once off the arena edge', premium: true },
];

export interface DroneFact {
  id: string;
  name: string;
  does: string;
  combo: string;
  reward?: boolean;
}

export const DRONES: DroneFact[] = [
  { id: 'aegis', name: 'AEGIS HALO', does: 'Softens collision damage', combo: 'BULWARK' },
  { id: 'voltmite', name: 'VOLT MITE', does: 'Shots chain to a nearby enemy', combo: 'STORM CROWN' },
  { id: 'needlefinch', name: 'NEEDLE FINCH', does: 'Bullets pierce enemies', combo: 'STRAFE' },
  { id: 'gravbeetle', name: 'GRAV BEETLE', does: 'Pulls nearby enemies inward', combo: 'COLLAPSE' },
  { id: 'medicwisp', name: 'MEDIC WISP', does: 'Slowly regenerates the hull', combo: 'BLOOM' },
  { id: 'frostsprite', name: 'FROST SPRITE', does: 'Hits chill enemies for a second', combo: 'BLIZZARD' },
  { id: 'salvagecrab', name: 'SALVAGE CRAB', does: 'Power-ups drift in from range', combo: 'HAUL' },
  { id: 'embermoth', name: 'EMBER MOTH', does: 'Hits set a short burn', combo: 'WILDFIRE' },
  { id: 'mirrorbat', name: 'MIRROR BAT', does: 'An enemy bolt glances off every 8s', combo: 'ECHO' },
  { id: 'decoygecko', name: 'DECOY GECKO', does: 'Throws a hologram enemies chase', combo: 'MIRAGE' },
  { id: 'scoutowl', name: 'SCOUT OWL', does: 'Marks enemies off screen', combo: 'NIGHT SIGHT' },
  { id: 'champion', name: 'CHAMPION CREST', does: 'Won, never sold - for cup winners', combo: 'CROWNED', reward: true },
];

export const SECTORS: { name: string; hazard: string }[] = [
  { name: 'DEEP SPACE', hazard: 'Open space: just you and the fleet' },
  { name: 'ASTEROID BELT', hazard: 'Faceted rocks drift across the arena' },
  { name: 'BLACK HOLE ZONE', hazard: 'An event horizon that drags at your hull' },
  { name: 'SOLAR STORM', hazard: 'A wall of plasma rolls across the arena' },
  { name: 'ION NEBULA', hazard: 'Lightning arcs between drifting ion clouds' },
  { name: 'WRECK FIELD', hazard: 'Derelict hulls: cover that blocks fire both ways' },
  { name: 'PULSAR', hazard: 'Two beams sweep round a neutron star' },
  { name: 'MINEFIELD', hazard: 'An arena sown with proximity mines' },
  { name: 'METEOR SHOWER', hazard: 'Lanes light up, then the meteors follow' },
  { name: 'CRYSTAL FIELD', hazard: 'Crystals shatter into shards that hit enemies' },
];

export const BOSSES: string[] = [
  'ASTEROID KING', 'VOID TYRANT', 'SOLAR WARDEN', 'PLASMA MEDUSA', 'HIVE QUEEN', 'XENO MONARCH',
  'STORM CALLER', 'SCRAP COLOSSUS', 'PULSAR LORD', 'MINE LAYER', 'COMET HERALD', 'PRISM GIANT',
];
