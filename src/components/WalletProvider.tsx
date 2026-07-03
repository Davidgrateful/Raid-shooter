'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/lib/wagmi-config';
import { mainnet } from '@reown/appkit/networks';
import { useState, type ReactNode } from 'react';

// Initialize Reown AppKit at module load. Supports SSR — the adapter uses
// cookieStorage and AppKit handles server-side gracefully.
createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId || 'dev-placeholder',
  networks: [...networks],
  defaultNetwork: mainnet,
  metadata: {
    name: 'Raid Shooter',
    description: 'Canvas-based arcade shooter with Web3 wallet integration',
    url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    icons: [],
  },
  features: {
    analytics: false,
    // Embedded (in-app) wallet: a player can sign in with email or a social
    // account and AppKit provisions a self-custodial smart account for them -
    // no extension, no seed phrase, no QR. This is the frictionless path for
    // web2 arcade players; power users still get the normal WalletConnect /
    // injected options in the same modal. Requires a real Reown project ID.
    email: true,
    socials: ['google', 'apple', 'x', 'discord'],
    emailShowWallets: true,
  },
  themeMode: 'dark',
});

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
