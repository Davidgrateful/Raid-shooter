// Marketplace catalog and wallet-keyed player profiles.
//
// Cosmetics only - they only affect looks. Nothing in the market may
// affect a live run or a score; that rule keeps Shooterboard credible.

export interface MarketItem {
  id: string;
  title: string;
  kind: 'color' | 'trail' | 'character' | 'consumable' | 'drone';
  priceUsd: number;
  priceEth: string;
  comingSoon?: boolean;
  // how many charges one purchase grants (consumables only, default 1)
  stack?: number;
  // shown alongside character items in the storefront
  ability?: string;
  // reward-only items are never listed for sale; they're granted to
  // tournament winners from the admin, which keeps them exclusive
  reward?: boolean;
}

// priceEth approximates priceUsd at deploy time - adjust as ETH moves.
export const CATALOG: MarketItem[] = [
  { id: 'color_gold', title: 'GOLD SHIP SKIN', kind: 'color', priceUsd: 0.3, priceEth: '0.0001' },
  { id: 'color_void', title: 'VOID SHIP SKIN', kind: 'color', priceUsd: 0.3, priceEth: '0.0001' },
  { id: 'color_emerald', title: 'EMERALD SHIP SKIN', kind: 'color', priceUsd: 0.3, priceEth: '0.0001' },
  { id: 'color_ice', title: 'ICE SHIP SKIN', kind: 'color', priceUsd: 0.3, priceEth: '0.0001' },
  { id: 'trail_ember', title: 'EMBER ENGINE TRAIL', kind: 'trail', priceUsd: 0.3, priceEth: '0.0001' },
  { id: 'trail_ion', title: 'ION ENGINE TRAIL', kind: 'trail', priceUsd: 0.3, priceEth: '0.0001' },
  { id: 'trail_void', title: 'VOID ENGINE TRAIL', kind: 'trail', priceUsd: 0.3, priceEth: '0.0001' },
  {
    id: 'pilot_solstice', title: 'SOLSTICE PILOT', kind: 'character', priceUsd: 1, priceEth: '0.00033',
    ability: 'OVERDRIVE: FASTER BULLETS, LIGHTER ARMOR',
  },
  {
    id: 'pilot_crimsonwisp', title: 'CRIMSON WISP PILOT', kind: 'character', priceUsd: 1, priceEth: '0.00033',
    ability: 'EMBER WAKE: HEAL HP FROM KILLS',
  },
  // unlock shortcuts for free pilots - same stats as the grind-unlocked
  // version, just skips the stat gate; never a power advantage, only convenience
  {
    id: 'pilot_nova', title: 'NOVA PILOT', kind: 'character', priceUsd: 0.5, priceEth: '0.00017',
    ability: 'SLIPSTREAM: LONGER DASH',
  },
  {
    id: 'pilot_tankrex', title: 'TANK REX PILOT', kind: 'character', priceUsd: 0.5, priceEth: '0.00017',
    ability: 'BULWARK: RESIST WHEN BADLY HURT',
  },
  {
    id: 'pilot_astravane', title: 'ASTRA VANE PILOT', kind: 'character', priceUsd: 0.5, priceEth: '0.00017',
    ability: 'TAILWIND: LONGER COMBO WINDOW',
  },
  {
    id: 'pilot_runepilot', title: 'RUNE PILOT', kind: 'character', priceUsd: 0.5, priceEth: '0.00017',
    ability: 'SCAVENGER: MORE POWERUP DROPS',
  },
  {
    id: 'pilot_nebulafox', title: 'NEBULA FOX PILOT', kind: 'character', priceUsd: 0.5, priceEth: '0.00017',
    ability: 'VAMPIRE: HEAL HP FROM KILLS',
  },
  {
    id: 'consumable_health', title: 'HEALTH PACK', kind: 'consumable', priceUsd: 0.5, priceEth: '0.00017', stack: 3,
  },
  {
    id: 'consumable_shield', title: 'SHIELD CHARGE', kind: 'consumable', priceUsd: 0.75, priceEth: '0.00025', stack: 3,
  },
  {
    id: 'consumable_revive', title: 'REVIVE TOKEN', kind: 'consumable', priceUsd: 1, priceEth: '0.00033', stack: 1,
  },
  // combat drones - equip one at a time for a passive effect; deliberately
  // small bonuses (see DRONE_DEFS in drones.js) so they shift playstyle
  // without becoming pay-to-win on Shooterboard runs
  {
    id: 'drone_aegis', title: 'AEGIS HALO DRONE', kind: 'drone', priceUsd: 0.9, priceEth: '0.0003',
    ability: 'PASSIVE: REDUCES COLLISION DAMAGE',
  },
  {
    id: 'drone_voltmite', title: 'VOLT MITE DRONE', kind: 'drone', priceUsd: 0.9, priceEth: '0.0003',
    ability: 'PASSIVE: SHOTS CHAIN TO A NEARBY ENEMY',
  },
  {
    id: 'drone_needlefinch', title: 'NEEDLE FINCH DRONE', kind: 'drone', priceUsd: 0.9, priceEth: '0.0003',
    ability: 'PASSIVE: BULLETS PIERCE ENEMIES',
  },
  {
    id: 'drone_gravbeetle', title: 'GRAV BEETLE DRONE', kind: 'drone', priceUsd: 0.9, priceEth: '0.0003',
    ability: 'PASSIVE: PULLS NEARBY ENEMIES INWARD',
  },
  {
    id: 'drone_medicwisp', title: 'MEDIC WISP DRONE', kind: 'drone', priceUsd: 0.9, priceEth: '0.0003',
    ability: 'PASSIVE: SLOWLY REGENERATES HULL',
  },
  // ---- reward-only, never for sale (granted to tournament winners) ----
  {
    id: 'trail_champion', title: 'CHAMPION TRAIL', kind: 'trail', priceUsd: 0, priceEth: '0', reward: true,
  },
  {
    id: 'drone_champion', title: 'CHAMPION CREST DRONE', kind: 'drone', priceUsd: 0, priceEth: '0', reward: true,
    ability: 'PASSIVE: WINNERS-ONLY COSMETIC CREST',
  },
];

export function getItem(id: string): MarketItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

// The catalog the public storefront should show - reward-only items are
// hidden so they stay exclusive to tournament winners.
export const PUBLIC_CATALOG = CATALOG.filter((item) => !item.reward);

// Payments go live once a treasury address is configured.
export const treasury = (process.env.NEXT_PUBLIC_BASE_TREASURY || '').trim().toLowerCase();
export const marketEnabled = /^0x[0-9a-f]{40}$/.test(treasury);
export const baseNetwork = process.env.NEXT_PUBLIC_BASE_NETWORK === 'base' ? 'base' : 'baseSepolia';
export const baseRpcUrl =
  process.env.BASE_RPC_URL ||
  (baseNetwork === 'base' ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
