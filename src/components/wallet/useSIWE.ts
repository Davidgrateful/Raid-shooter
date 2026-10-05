'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';
import { checkSession, getWallet, LINK_WINDOW_MS, setWallet, useWallet } from '@/lib/walletStore';
import { linkStatement } from '@/lib/linkMessage';

/*
 * Sign-In With Ethereum. Part of the wallet runtime, so it runs ONCE (in the
 * runtime's bridge), and keeps its state in the wallet store where the rest
 * of the app reads it without loading any wallet code. The session check
 * itself is the store's, so a signed-in player shows as signed in before the
 * SDK has even loaded.
 */

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
  const w = useWallet();
  const state = { authenticated: w.authenticated, address: w.siweAddress, loading: w.siweLoading };

  // the store checks the existing session once, wallet code or not
  useEffect(() => { void checkSession(); }, []);

  const signingRef = useRef(false);
  // Set when the player actively REJECTS the signature prompt. Gates only
  // the automatic re-prompts (auto-prompt on connect, visibility retry) -
  // without it, declining once meant getting a fresh signature popup on
  // every tab switch / app return for as long as the wallet stayed
  // connected. Manual Sign In clicks ignore it, and it resets when the
  // wallet disconnects.
  const declinedRef = useRef(false);
  const signIn = useCallback(async () => {
    if (!address || !chainId || signingRef.current) return;
    signingRef.current = true;

    setWallet({ siweLoading: true });
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
        setWallet({ authenticated: true, siweAddress: result.address, siweSigner: result.signer || result.address, siweLoading: false });
      } else {
        setWallet({ siweLoading: false });
      }
    } catch (err) {
      // a deliberate rejection stops the automatic re-prompts; any other
      // failure (network, dropped app switch) stays retryable
      const e = err as { name?: string; code?: number; message?: string };
      if (
        e?.name === 'UserRejectedRequestError' ||
        e?.code === 4001 ||
        /rejected|denied/i.test(e?.message || '')
      ) {
        declinedRef.current = true;
      }
      setWallet({ siweLoading: false });
    } finally {
      signingRef.current = false;
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    // Clear local state FIRST: the player should never see "signed in" again
    // once they've asked to sign out, even if the network request below
    // fails. The DELETE is best-effort cleanup of the server-side cookie;
    // its failure must never leave the UI stuck showing the old session.
    setWallet({ authenticated: false, siweAddress: null, siweSigner: null, siweLoading: false, linkingSince: 0 });
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
      declinedRef.current = false;
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
        !declinedRef.current &&
        address &&
        chainId
      ) {
        void signIn();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isConnected, state.authenticated, state.loading, address, chainId, signIn]);

  /*
   * LINK ANOTHER SIGN-IN. The Account section (System) let go of the wallet
   * that was connected and opened the connect window; when a DIFFERENT wallet
   * arrives while that window is open, it is asked to sign a message naming
   * the account it is joining. The server checks the signature, the nonce and
   * that statement, then links it (src/app/api/account/link). A rejection, an
   * error or the window expiring ends the attempt.
   */
  const linkingRef = useRef(false);
  const link = useCallback(async () => {
    const snap = getWallet();
    if (!address || !chainId || !snap.siweAddress || linkingRef.current) return;
    linkingRef.current = true;
    const end = (ok: boolean, text: string, patch: Record<string, unknown> = {}) =>
      setWallet({ linkingSince: 0, linkNote: { ok, text }, ...patch });
    try {
      const { nonce } = await (await fetch('/api/siwe/nonce')).json();
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: linkStatement(snap.siweAddress),
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      }).prepareMessage();
      const signature = await signMessageAsync({ message });
      const res = await fetch('/api/account/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.ok) {
        end(true, 'Linked. Either sign-in now opens this account.', { siweSigner: d.signer || address.toLowerCase() });
        window.dispatchEvent(new CustomEvent('raidshooter:linked'));
      } else {
        end(false, d.message || 'That sign-in could not be linked. Try again.');
      }
    } catch (err) {
      const e = err as { name?: string; code?: number; message?: string };
      const rejected = e?.name === 'UserRejectedRequestError' || e?.code === 4001 || /rejected|denied/i.test(e?.message || '');
      end(false, rejected ? 'Link cancelled - nothing was changed.' : 'That sign-in could not be linked. Try again.');
    } finally {
      linkingRef.current = false;
    }
  }, [address, chainId, signMessageAsync]);

  useEffect(() => {
    const since = w.linkingSince;
    if (!since || !isConnected || !address || !chainId || !state.authenticated) return;
    if (Date.now() - since > LINK_WINDOW_MS) { setWallet({ linkingSince: 0 }); return; }
    const current = (w.siweSigner || w.siweAddress || '').toLowerCase();
    if (address.toLowerCase() === current) return; // the same wallet came back; keep waiting
    // the same beat sign-in gives a mobile wallet to settle after connecting
    const timer = setTimeout(() => void link(), 1200);
    return () => clearTimeout(timer);
  }, [w.linkingSince, w.siweSigner, w.siweAddress, isConnected, address, chainId, state.authenticated, link]);

  return {
    ...state,
    signIn,
    signOut,
    isConnected,
  };
}
