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
    // Two ways to get a wallet, both in the same modal:
    //   - CONNECT an existing wallet (WalletConnect QR / injected extension), or
    //   - CREATE one in-app with email or a social login (AppKit provisions a
    //     self-custodial smart account - no extension, no seed phrase).
    // `emailShowWallets` keeps the wallet list visible alongside the email/
    // social options so neither path is hidden. Needs a real Reown project ID;
    // email + Google/X are enabled by default on new Reown projects.
    email: true,
    socials: ['google', 'x'],
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
