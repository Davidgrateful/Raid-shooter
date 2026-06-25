// Marketplace catalog and wallet-keyed player profiles.
//
// Cosmetics only - they only affect looks. Nothing in the market may
// affect a live run or a score; that rule keeps Shooterboard credible.

export interface MarketItem {
  id: string;
  title: string;
  kind: 'color' | 'trail' | 'character';
  priceUsd: number;
  priceEth: string;
  comingSoon?: boolean;
}

// priceEth approximates priceUsd at deploy time - adjust as ETH moves.
export const CATALOG: MarketItem[] = [
  { id: 'color_gold', title: 'GOLD SHIP SKIN', kind: 'color', priceUsd: 2, priceEth: '0.00067' },
  { id: 'color_void', title: 'VOID SHIP SKIN', kind: 'color', priceUsd: 2, priceEth: '0.00067' },
  { id: 'color_emerald', title: 'EMERALD SHIP SKIN', kind: 'color', priceUsd: 2, priceEth: '0.00067' },
  { id: 'color_ice', title: 'ICE SHIP SKIN', kind: 'color', priceUsd: 2, priceEth: '0.00067' },
  { id: 'trail_ember', title: 'EMBER ENGINE TRAIL', kind: 'trail', priceUsd: 3, priceEth: '0.001' },
  { id: 'trail_ion', title: 'ION ENGINE TRAIL', kind: 'trail', priceUsd: 3, priceEth: '0.001' },
  { id: 'trail_void', title: 'VOID ENGINE TRAIL', kind: 'trail', priceUsd: 3, priceEth: '0.001' },
  { id: 'pilot_solstice', title: 'SOLSTICE PILOT', kind: 'character', priceUsd: 5, priceEth: '0.00167' },
  { id: 'pilot_crimsonwisp', title: 'CRIMSON WISP PILOT', kind: 'character', priceUsd: 5, priceEth: '0.00167' },
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
