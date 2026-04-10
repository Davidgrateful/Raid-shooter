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

  return {
    ...state,
    signIn,
    signOut,
    isConnected,
  };
}
