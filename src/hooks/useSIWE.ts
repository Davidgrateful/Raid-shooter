'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';

interface SIWEState {
  authenticated: boolean;
  address: string | null;
  loading: boolean;
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

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;

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
        body: JSON.stringify({ message: messageString, signature }),
      });
      const result = await verifyRes.json();

      if (result.ok) {
        setState({ authenticated: true, address: result.address, loading: false });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch('/api/siwe/session', { method: 'DELETE' });
    setState({ authenticated: false, address: null, loading: false });
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
