'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useSIWE } from '@/hooks/useSIWE';
import { walletReady } from '@/lib/wagmi-config';

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const { authenticated, address: siweAddress, signIn, signOut, loading } = useSIWE();

  if (!isConnected) {
    // Wallet not configured yet: opening the modal would just dead-end at the
    // WalletConnect relay. Tell the operator plainly instead of showing players
    // a broken flow. (No-op for players until the project ID is set.)
    if (!walletReady) {
      return (
        <button
          onClick={() =>
            alert(
              'Wallet sign-in is not configured yet.\n\nSet NEXT_PUBLIC_REOWN_PROJECT_ID in Vercel (free ID at cloud.reown.com) and redeploy. Guests can still play and rank without a wallet.'
            )
          }
          title="Wallet sign-in not configured (set NEXT_PUBLIC_REOWN_PROJECT_ID)"
          className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-white/5 border border-white/10 rounded text-sm text-white/50 transition-colors"
        >
          Connect Wallet
        </button>
      );
    }
    return (
      <button
        onClick={() => open()}
        className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded text-sm text-white transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  if (authenticated) {
    return (
      <div className="flex items-center gap-3 max-sm:gap-1.5">
        <span className="text-xs max-sm:text-[10px] text-green-400">
          {shortenAddress(siweAddress || address || '')}
        </span>
        <button
          onClick={signOut}
          className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-white/10 hover:bg-red-500/30 border border-white/20 rounded text-sm text-white transition-colors"
        >
          Sign Out
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-white/10 hover:bg-red-500/30 border border-white/20 rounded text-sm text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 max-sm:gap-1.5">
      <span className="text-xs max-sm:text-[10px] text-white/60">
        {shortenAddress(address || '')}
      </span>
      <button
        onClick={signIn}
        disabled={loading}
        className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-blue-600 hover:bg-blue-500 border border-blue-400/30 rounded text-sm text-white transition-colors disabled:opacity-50"
      >
        {loading ? 'Signing...' : 'Sign In'}
      </button>
      <button
        onClick={() => open({ view: 'Account' })}
        className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded text-sm text-white transition-colors"
      >
        Account
      </button>
      <button
        onClick={() => disconnect()}
        className="px-3 py-1.5 max-sm:px-2 max-sm:py-1 max-sm:text-xs bg-white/10 hover:bg-red-500/30 border border-white/20 rounded text-sm text-white transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
