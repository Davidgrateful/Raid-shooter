'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useSIWE } from '@/hooks/useSIWE';

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// One tidy control instead of the old address + Sign Out + Disconnect + Account
// row (which crowded the header on phones). States:
//   - not connected      -> Connect Wallet
//   - connected, no SIWE  -> Sign In  (+ the address chip opens the account modal)
//   - signed in           -> a single verified address chip; tapping it opens
//                            the AppKit account view, which holds Disconnect
export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const { authenticated, address: siweAddress, signIn, signOut, loading } = useSIWE();

  const openAccount = () => {
    try { open({ view: 'Account' }); } catch (e) { console.error('[wallet] open failed', e); }
  };

  if (!isConnected) {
    return (
      <button
        onClick={() => { try { open(); } catch (e) { console.error('[wallet] open failed', e); } }}
        className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20 max-sm:px-2 max-sm:py-1 max-sm:text-xs"
      >
        Connect Wallet
      </button>
    );
  }

  // connected, verified (SIWE): a single chip. It opens the account modal
  // (which offers Disconnect); the ✕ signs out + disconnects in one tap.
  if (authenticated) {
    return (
      <div className="flex items-center overflow-hidden rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-xs max-sm:text-[10px]">
        <button onClick={openAccount} className="flex items-center gap-1.5 px-2.5 py-1.5 text-emerald-300 hover:bg-white/5 max-sm:px-2 max-sm:py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono">{shortenAddress(siweAddress || address || '')}</span>
        </button>
        <button
          onClick={() => { try { signOut(); } finally { disconnect(); } }}
          title="Sign out & disconnect"
          className="border-l border-emerald-400/20 px-2 py-1.5 text-white/50 hover:bg-red-500/30 hover:text-white max-sm:py-1"
        >
          ✕
        </button>
      </div>
    );
  }

  // connected but not signed in: Sign In is the primary action; the chip
  // opens the account modal (holds Disconnect) so there's no separate button.
  return (
    <div className="flex items-center gap-2 max-sm:gap-1.5">
      <button
        onClick={openAccount}
        className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 font-mono text-xs text-white/60 hover:bg-white/10 max-sm:px-2 max-sm:py-1 max-sm:text-[10px]"
      >
        {shortenAddress(address || '')}
      </button>
      <button
        onClick={signIn}
        disabled={loading}
        className="rounded-lg border border-cyan-400/30 bg-cyan-500/90 px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:opacity-50 max-sm:px-2 max-sm:py-1 max-sm:text-xs"
      >
        {loading ? 'Signing…' : 'Sign In'}
      </button>
    </div>
  );
}
