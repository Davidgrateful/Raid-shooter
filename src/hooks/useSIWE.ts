'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';

interface SIWEState {
  authenticated: boolean;
  address: string | null;
  loading: boolean;
  error: string | null;
}

export function useSIWE() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<SIWEState>({
    authenticated: false,
    address: null,
    loading: true,
    error: null,
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
          error: null,
        });
      })
      .catch(() =>
        setState((s) => ({
          ...s,
          loading: false,
          error: 'Could not check wallet session.',
        }))
      );
  }, []);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // 1. Get nonce
      const nonceRes = await fetch('/api/siwe/nonce');
      if (!nonceRes.ok) {
        throw new Error('Could not create sign-in nonce.');
      }
      const { nonce } = await nonceRes.json();
      if (!nonce) {
        throw new Error('Sign-in nonce was empty.');
      }

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

      if (!verifyRes.ok || !result.ok) {
        throw new Error(result.error || 'Wallet signature could not be verified.');
      }

      setState({ authenticated: true, address: result.address, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet sign-in failed.';
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch('/api/siwe/session', { method: 'DELETE' });
    setState({ authenticated: false, address: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    isConnected,
  };
}
