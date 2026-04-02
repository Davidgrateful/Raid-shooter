'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useSIWE } from '@/hooks/useSIWE';

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { authenticated, address: siweAddress, signIn, signOut, loading } = useSIWE();

  if (!isConnected) {
    return (
      <div className="flex gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-sm text-white transition-colors"
          >
            Connect {connector.name === 'Injected' ? 'Wallet' : connector.name}
          </button>
        ))}
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-green-400">
          {shortenAddress(siweAddress || address || '')}
        </span>
        <button
          onClick={signOut}
          className="px-3 py-1.5 bg-white/10 hover:bg-red-500/30 border border-white/20 rounded text-sm text-white transition-colors"
        >
          Sign Out
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 bg-white/10 hover:bg-red-500/30 border border-white/20 rounded text-sm text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/60">
        {shortenAddress(address || '')}
      </span>
      <button
        onClick={signIn}
        disabled={loading}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-400/30 rounded text-sm text-white transition-colors disabled:opacity-50"
      >
        {loading ? 'Signing...' : 'Sign In'}
      </button>
      <button
        onClick={() => disconnect()}
        className="px-3 py-1.5 bg-white/10 hover:bg-red-500/30 border border-white/20 rounded text-sm text-white transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
