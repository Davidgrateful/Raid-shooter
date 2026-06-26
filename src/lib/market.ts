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
  {
    id: 'consumable_health', title: 'HEALTH PACK x3', kind: 'consumable', priceUsd: 0.5, priceEth: '0.00017', stack: 3,
  },
  {
    id: 'consumable_shield', title: 'SHIELD CHARGE x3', kind: 'consumable', priceUsd: 0.75, priceEth: '0.00025', stack: 3,
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
];

export function getItem(id: string): MarketItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

// Payments go live once a treasury address is configured.
export const treasury = (process.env.NEXT_PUBLIC_BASE_TREASURY || '').trim().toLowerCase();
export const marketEnabled = /^0x[0-9a-f]{40}$/.test(treasury);
export const baseNetwork = process.env.NEXT_PUBLIC_BASE_NETWORK === 'base' ? 'base' : 'baseSepolia';
export const baseRpcUrl =
  process.env.BASE_RPC_URL ||
  (baseNetwork === 'base' ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
