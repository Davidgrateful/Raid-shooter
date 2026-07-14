'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';

interface SIWEState {
  authenticated: boolean;
  address: string | null;
  loading: boolean;
}

// The game engine's own storage blob (public/game/storage.js) - the same
// durable guest token every score submission sends (see $.guestToken() in
// shooterboard.js). Reading it here lets sign-in tell the server which
// guest identity to merge progress FROM, instead of the server guessing
// from the (much less durable) session cookie.
function myGuestToken(): string | null {
  try {
    const raw = localStorage.getItem('radiusraid');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guesttoken?: string };
    return typeof parsed.guesttoken === 'string' && parsed.guesttoken.length >= 8
      ? parsed.guesttoken
      : null;
  } catch {
    return null;
  }
}

export function useSIWE() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<SIWEState>({
    authenticated: false,
    address: null,
    loading: true,
  });

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/siwe/session')
      .then((res) => res.json())
      .then((data) => {
        setState({
          authenticated: data.authenticated,
          address: data.address || null,
          loading: false,
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  const signingRef = useRef(false);
  const signIn = useCallback(async () => {
    if (!address || !chainId || signingRef.current) return;
    signingRef.current = true;

    setState((s) => ({ ...s, loading: true }));
    try {
      // 1. Get nonce
      const nonceRes = await fetch('/api/siwe/nonce');
      const { nonce } = await nonceRes.json();

      // 2. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Raid Shooter',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      });
      const messageString = message.prepareMessage();

      // 3. Sign
      const signature = await signMessageAsync({ message: messageString });

      // 4. Verify
      const verifyRes = await fetch('/api/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageString, signature, guestToken: myGuestToken() || undefined }),
      });
      const result = await verifyRes.json();

      if (result.ok) {
        setState({ authenticated: true, address: result.address, loading: false });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch {
      setState((s) => ({ ...s, loading: false }));
    } finally {
      signingRef.current = false;
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    // Clear local state FIRST: the player should never see "signed in" again
    // once they've asked to sign out, even if the network request below
    // fails. The DELETE is best-effort cleanup of the server-side cookie;
    // its failure must never leave the UI stuck showing the old session.
    setState({ authenticated: false, address: null, loading: false });
    try {
      const res = await fetch('/api/siwe/session', { method: 'DELETE' });
      return res.ok;
    } catch {
      // network hiccup - local state is already cleared above; the stale
      // server cookie will simply fail SIWE checks next time (address won't
      // match) or get overwritten on the next successful sign-in
      return false;
    }
  }, []);

  // Auto-prompt the SIWE signature once the wallet connects, so players
  // aren't left half-logged-in thinking "Connect" was the whole job.
  // Runs once per connection; declining leaves the manual Sign In button.
  const [autoPrompted, setAutoPrompted] = useState(false);
  useEffect(() => {
    if (!isConnected) {
      setAutoPrompted(false);
      return;
    }
    if (autoPrompted || state.loading || state.authenticated || !address || !chainId) {
      return;
    }
    setAutoPrompted(true);
    // mobile wallets need a beat after connecting before they can take a
    // signature request (the app switch back is still settling)
    const timer = setTimeout(() => void signIn(), 1200);
    return () => clearTimeout(timer);
  }, [isConnected, autoPrompted, state.loading, state.authenticated, address, chainId, signIn]);

  // mobile: returning from the wallet app sometimes drops the signature
  // prompt; retry once when the page becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        isConnected &&
        !state.authenticated &&
        !state.loading &&
        address &&
        chainId
      ) {
        void signIn();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isConnected, state.authenticated, state.loading, address, chainId, signIn]);

  return {
    ...state,
    signIn,
    signOut,
    isConnected,
  };
}
