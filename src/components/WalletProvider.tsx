'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/lib/wagmi-config';
import { mainnet } from '@reown/appkit/networks';
import { useState, type ReactNode } from 'react';

// Initialize Reown AppKit at module load. This is wrapped in try/catch because
// WalletProvider wraps the ENTIRE app: if AppKit init ever throws (e.g. a bad
// project config or an unverified domain triggering the Verify API), an
// unguarded throw here white-screens the whole game on load. The wallet is a
// secondary feature - it must never take the game down. On failure the app
// still renders; Connect just won't open until the config is fixed.
//
// Embedded wallet (email + social -> self-custodial smart account) is only
// enabled once a real project ID is present. With the dev placeholder we keep
// it off, since those flows spin up extra secure iframes / Verify calls that
// can error without a configured project.
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
      // Two ways to get a wallet in one modal: CONNECT an existing wallet, or
      // CREATE one in-app with email / Google / X (a self-custodial smart
      // account - no extension, no seed phrase). Gated on a real project ID.
      email: !!projectId,
      socials: projectId ? ['google', 'x'] : [],
      emailShowWallets: true,
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
