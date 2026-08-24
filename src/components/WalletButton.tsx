'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useSIWE } from '@/hooks/useSIWE';

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Nuclear option: wipe every trace of a wallet session from the browser and
// reload. wagmi persists its connector state via cookieStorage; WalletConnect
// and AppKit separately cache session data in localStorage - including, if a
// player ever got routed into the embedded email/social flow, the
// CONNECTED_SOCIAL / TELEGRAM_SOCIAL_PROVIDER keys that keep silently
// signing them back into that auto-created wallet on every visit. If the
// normal disconnect call fails (relay timeout, a mobile in-app browser
// rejecting the teardown - both common), that persisted state survives and
// the wallet silently reconnects on the next page load, which reads to a
// player as "I disconnected and it came right back" - or "a new wallet keeps
// appearing." This clears all of it, matched case-insensitively against the
// real key prefixes AppKit/WalletConnect/wagmi use, so there is nothing left
// to reconnect (or re-create) from, no matter how the SDK call failed.
function forceForgetWallet() {
  try {
    const prefixes = ['wc@2', '@w3m', '@appkit', 'wagmi', 'w3m_', 'walletconnect'];
    const matches = (key: string) => {
      const k = key.toLowerCase();
      return prefixes.some((p) => k.startsWith(p) || k.includes(p));
    };
    for (const key of Object.keys(localStorage)) {
      if (matches(key)) localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (matches(key)) sessionStorage.removeItem(key);
    }
    // the wagmi cookieStorage adapter persists under cookies matching "wagmi"
    for (const c of document.cookie.split(';')) {
      const name = c.split('=')[0]?.trim();
      if (name && name.toLowerCase().includes('wagmi')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    }
  } catch (e) {
    console.error('[wallet] force reset failed', e);
  } finally {
    window.location.reload();
  }
}

// One tidy control instead of the old address + Sign Out + Disconnect + Account
// row (which crowded the header on phones). States:
//   - not connected      -> Connect Wallet
//   - connected, no SIWE  -> Sign In  (+ the address chip opens the account modal)
//   - signed in           -> a single verified address chip; tapping it opens
//                            the AppKit account view, which holds Disconnect
export function WalletButton() {
  const { address, isConnected, status } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { open } = useAppKit();
  const { authenticated, address: siweAddress, signIn, signOut, loading } = useSIWE();
  const [disconnecting, setDisconnecting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const openAccount = () => {
    try { open({ view: 'Account' }); } catch (e) { console.error('[wallet] open failed', e); }
  };

  // Other screens need to start a connect or a sign-in without owning a second
  // copy of this logic - the armory's requisition CTA is one. They ask here, so
  // this component stays the single place wallet auth actually happens, and
  // there is never a competing connect path to keep in sync.
  useEffect(() => {
    const onAsk = () => {
      try {
        if (!isConnected) { open(); } else if (!authenticated) { signIn(); }
      } catch (e) {
        console.error('[wallet] connect request failed', e);
      }
    };
    window.addEventListener('raidshooter:wallet', onAsk);
    return () => window.removeEventListener('raidshooter:wallet', onAsk);
  }, [isConnected, authenticated, open, signIn]);

  // Run both teardown steps as real, independently-caught promises so a
  // failure in one (e.g. the session DELETE) never blocks the other (the
  // wallet disconnect itself).
  const signOutAndDisconnect = async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    const results = await Promise.allSettled([signOut(), disconnectAsync()]);
    if (results[1].status === 'rejected') {
      console.error('[wallet] disconnect failed', results[1].reason);
    }
    setDisconnecting(false);
    setAttempted(true);
  };

  // If a disconnect was attempted but the wallet is STILL reporting
  // connected a couple seconds later, the connector-level teardown silently
  // failed (common on mobile / in-app browsers). Surface a hard-reset
  // fallback instead of leaving the player stuck with no way out.
  const [stuck, setStuck] = useState(false);
  const stuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (stuckTimer.current) clearTimeout(stuckTimer.current);
    if (!attempted) return;
    if (!isConnected) { setStuck(false); setAttempted(false); return; }
    stuckTimer.current = setTimeout(() => setStuck(true), 2000);
    return () => { if (stuckTimer.current) clearTimeout(stuckTimer.current); };
  }, [attempted, isConnected]);

  // Rendered next to the wallet control whenever a disconnect was requested
  // but the wallet is still reporting connected after a couple seconds - the
  // escape hatch for exactly the "signed out but it won't disconnect" case.
  const stuckBanner = stuck ? (
    <button
      onClick={forceForgetWallet}
      title="Wipes all local wallet session data and reloads the page"
      className="ml-1.5 animate-pulse rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/20 max-sm:px-1.5 max-sm:text-[9px]"
    >
      Still connected? Force reset
    </button>
  ) : null;

  // On every page load, wagmi silently tries to restore a PREVIOUS session
  // (status transitions through 'reconnecting') before showing Connect
  // Wallet at all - this only runs for a RETURNING player, someone who
  // connected before. If that stored WalletConnect pairing has since
  // expired or the relay hangs mid-handshake (the same relay flakiness
  // wallet-connect-error telemetry already caught elsewhere), reconnecting
  // never resolves either way and the player is left staring at nothing -
  // not a "Connect Wallet" button, not an error, just silence. This is
  // exactly the "old players finding it hard to connect" shape: brand-new
  // players never enter this state (nothing to reconnect), and it looks
  // like "the game is just broken" with no visible next step. Surfacing a
  // reset action after a few seconds gives them one.
  const [reconnectStuck, setReconnectStuck] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'reconnecting') {
      setReconnectStuck(false);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      return;
    }
    reconnectTimer.current = setTimeout(() => {
      setReconnectStuck(true);
      fetch('/api/wallet/connect-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'RECONNECT_TIMEOUT' }),
      }).catch(() => {});
    }, 5000);
    return () => { if (reconnectTimer.current) clearTimeout(reconnectTimer.current); };
  }, [status]);

  if (reconnectStuck) {
    return (
      <div className="flex items-center">
        <button
          onClick={forceForgetWallet}
          title="Your last wallet session didn't reconnect - wipes it and starts fresh"
          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/20 max-sm:px-2 max-sm:py-1 max-sm:text-xs"
        >
          Reconnect stuck? Tap to reset
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center">
        <button
          onClick={() => { try { open(); } catch (e) { console.error('[wallet] open failed', e); } }}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20 max-sm:px-2 max-sm:py-1 max-sm:text-xs"
        >
          Connect Wallet
        </button>
        {stuckBanner}
      </div>
    );
  }

  // connected, verified (SIWE): a single chip. It opens the account modal
  // (which offers Disconnect); the ✕ signs out + disconnects in one tap.
  if (authenticated) {
    return (
      <div className="flex items-center">
        <div className="flex items-center overflow-hidden rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-xs max-sm:text-[10px]">
          <button onClick={openAccount} className="flex items-center gap-1.5 px-2.5 py-1.5 text-emerald-300 hover:bg-white/5 max-sm:px-2 max-sm:py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono">{shortenAddress(siweAddress || address || '')}</span>
          </button>
          <button
            onClick={signOutAndDisconnect}
            disabled={disconnecting}
            title="Sign out & disconnect"
            className="border-l border-emerald-400/20 px-2 py-1.5 text-white/50 hover:bg-red-500/30 hover:text-white disabled:opacity-50 max-sm:py-1"
          >
            {disconnecting ? '…' : '✕'}
          </button>
        </div>
        {stuckBanner}
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
      <button
        onClick={signOutAndDisconnect}
        disabled={disconnecting}
        title="Disconnect wallet"
        className="rounded-lg border border-white/10 px-1.5 py-1.5 text-white/40 hover:bg-red-500/30 hover:text-white disabled:opacity-50 max-sm:px-1 max-sm:py-1"
      >
        {disconnecting ? '…' : '✕'}
      </button>
      {stuckBanner}
    </div>
  );
}
