'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/lib/wagmi-config';
import { useState, type ReactNode } from 'react';

// Initialize Reown AppKit at module load. Supports SSR — the adapter uses
// cookieStorage and AppKit handles server-side gracefully.
createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId || 'dev-placeholder',
  networks: [...networks],
  metadata: {
    name: 'Raid Shooter',
    description: 'Canvas-based arcade shooter with Web3 wallet integration',
    url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    icons: [],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
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
