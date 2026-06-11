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
  priceEth: string;
  comingSoon?: boolean;
}

export const CATALOG: MarketItem[] = [
  { id: 'color_gold', title: 'GOLD HULL', kind: 'color', priceEth: '0.001' },
  { id: 'color_void', title: 'VOID HULL', kind: 'color', priceEth: '0.001' },
  { id: 'color_emerald', title: 'EMERALD HULL', kind: 'color', priceEth: '0.001' },
  { id: 'color_ice', title: 'ICE HULL', kind: 'color', priceEth: '0.001' },
  { id: 'trail_ember', title: 'EMBER TRAIL', kind: 'trail', priceEth: '0.002' },
  { id: 'trail_ion', title: 'ION TRAIL', kind: 'trail', priceEth: '0.002' },
  { id: 'trail_void', title: 'VOID TRAIL', kind: 'trail', priceEth: '0.002' },
  { id: 'boost_xp_24h', title: 'XP BOOST 24H', kind: 'boost', priceEth: '0.001', comingSoon: true },
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
