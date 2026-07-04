'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/lib/wagmi-config';
import { mainnet } from '@reown/appkit/networks';
import { useState, type ReactNode } from 'react';

// Initialize Reown AppKit at module load. This is the last Vercel-working
// wallet baseline (plain WalletConnect: connect an existing wallet / injected
// extension), restored after the embedded email/social variant caused
// "Invalid App Configuration". The only addition kept over the baseline is the
// try/catch: WalletProvider wraps the ENTIRE app, so an unguarded throw here
// (bad config / unverified domain hitting the Verify API) would white-screen
// the whole game. The wallet is secondary - it must never take the game down.
//
// NOTE: the in-app "create a wallet" flow (email + Google/X -> smart account)
// is intentionally OFF here. Re-enable it ONLY after Email + Social login are
// turned on inside the Reown project dashboard, or AppKit throws on init.
try {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId: projectId || 'dev-placeholder',
    networks: [...networks],
    defaultNetwork: mainnet,
    metadata: {
      name: 'Raid Shooter',
      description: 'Canvas-based arcade shooter with Web3 wallet integration',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://raidshooter.xyz',
      icons: [],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: 'dark',
  });
} catch (err) {
  // never let a wallet-config error break the game
  console.error('[Reown] AppKit init failed — wallet disabled, game unaffected:', err);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
