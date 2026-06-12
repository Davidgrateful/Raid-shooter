// Marketplace catalog and wallet-keyed player profiles.
//
// Cosmetics only affect looks; boosts only accelerate progression and are
// listed as coming soon until server-side stat accrual ships. Nothing in
// the market may affect a live run or a score - that rule keeps
// Shooterboard credible.

export interface MarketItem {
  id: string;
  title: string;
  kind: 'color' | 'trail' | 'boost';
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
  { id: 'boost_xp_5h', title: 'XP BOOST 5 HOURS', kind: 'boost', priceUsd: 1, priceEth: '0.00033', comingSoon: true },
  { id: 'boost_xp_12h', title: 'XP BOOST 12 HOURS', kind: 'boost', priceUsd: 3, priceEth: '0.001', comingSoon: true },
  { id: 'boost_xp_24h', title: 'XP BOOST 24 HOURS', kind: 'boost', priceUsd: 5, priceEth: '0.00167', comingSoon: true },
];

export function getItem(id: string): MarketItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

// Payments go live once a treasury address is configured.
export const treasury = (process.env.NEXT_PUBLIC_BASE_TREASURY || '').toLowerCase();
export const marketEnabled = /^0x[0-9a-f]{40}$/.test(treasury);
export const baseNetwork = process.env.NEXT_PUBLIC_BASE_NETWORK === 'base' ? 'base' : 'baseSepolia';
export const baseRpcUrl =
  process.env.BASE_RPC_URL ||
  (baseNetwork === 'base' ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
