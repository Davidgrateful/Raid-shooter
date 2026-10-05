'use client';

import { useSyncExternalStore } from 'react';

/*==============================================================================
The wallet, on demand

The wallet SDK (wagmi + Reown AppKit + WalletConnect, about 2.8 MB of
JavaScript) used to load before the command deck could draw, for every player,
although most players never connect a wallet. It now lives in
src/components/wallet/WalletRuntime.tsx and loads only when it is needed:

  - the player taps Connect Wallet / Sign In, or a screen asks for it
    (raidshooter:wallet), or a purchase starts (raidshooter:buy)
  - a returning player is signed in, or has a saved wallet connection: then it
    loads in the background once the game has booted, so their wallet is
    ready by the time they reach the Armory

Everything outside the runtime reads the wallet through this store, never
through wagmi directly, so nothing has to wait for the SDK just to draw. The
signed-in state comes from /api/siwe/session (a cookie check), which needs no
wallet code at all.
==============================================================================*/

export type WalletPhase = 'idle' | 'loading' | 'ready' | 'failed';

export interface WalletSnapshot {
  /** idle: the SDK has not been asked for; ready: the runtime is mounted */
  phase: WalletPhase;
  /** wagmi's connection state (false until the runtime is ready) */
  isConnected: boolean;
  /** wagmi's status, e.g. 'reconnecting' (the runtime publishes it) */
  status: string;
  address: string | null;
  /** SIWE: signed in with a server session */
  authenticated: boolean;
  /** the address the server session is for */
  siweAddress: string | null;
  /** a session check or a signature is in flight */
  siweLoading: boolean;
  /** the address that actually signed in, when it is a linked sign-in of the
   *  account in siweAddress (src/lib/accounts.ts); else the same address */
  siweSigner: string | null;
  /** Link another sign-in: waiting for a different wallet to connect and sign
   *  (ms timestamp it started, or 0). Expires, so an abandoned attempt never
   *  turns a later, unrelated connection into a link prompt. */
  linkingSince: number;
  /** the last link attempt's outcome, for the Account section to show */
  linkNote: { ok: boolean; text: string } | null;
}

/** What the runtime can do once it is mounted. */
export interface WalletActions {
  open(view?: 'Account'): void;
  signIn(): Promise<void>;
  signOut(): Promise<boolean>;
  disconnect(): Promise<void>;
}

let snap: WalletSnapshot = {
  phase: 'idle',
  isConnected: false,
  status: 'disconnected',
  address: null,
  authenticated: false,
  siweAddress: null,
  siweLoading: true,
  siweSigner: null,
  linkingSince: 0,
  linkNote: null,
};

/** How long a "Link another sign-in" attempt waits for the new wallet. */
export const LINK_WINDOW_MS = 3 * 60_000;
let actions: WalletActions | null = null;
let wanted = false;
const listeners = new Set<() => void>();
const readyWaiters: Array<(a: WalletActions | null) => void> = [];

function emit() { for (const l of listeners) l(); }

export function setWallet(patch: Partial<WalletSnapshot>) {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof WalletSnapshot)[]) {
    if (snap[k] !== patch[k]) { changed = true; break; }
  }
  if (!changed) return;
  snap = { ...snap, ...patch };
  emit();
}

export function getWallet(): WalletSnapshot { return snap; }

export function subscribeWallet(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The runtime registers (or, on unmount, clears) what it can do. */
export function registerWalletActions(a: WalletActions | null) {
  actions = a;
  if (a) {
    setWallet({ phase: 'ready' });
    while (readyWaiters.length) readyWaiters.shift()!(a);
  }
}

/** Whether something has asked for the SDK (the shell mounts it when true). */
export function walletWanted() { return wanted; }

/** Ask for the SDK. Resolves with the runtime's actions once it is mounted. */
export function loadWallet(): Promise<WalletActions | null> {
  if (actions) return Promise.resolve(actions);
  if (!wanted) {
    wanted = true;
    if (snap.phase === 'idle' || snap.phase === 'failed') setWallet({ phase: 'loading' });
    emit();
  }
  return new Promise((resolve) => readyWaiters.push(resolve));
}

/** The shell reports a chunk that would not load (offline, blocked). */
export function walletLoadFailed() {
  wanted = false;
  setWallet({ phase: 'failed' });
  while (readyWaiters.length) readyWaiters.shift()!(null);
}

/*--- the server session, read once without any wallet code ------------------*/
let sessionChecked = false;
export function checkSession(): Promise<void> {
  if (sessionChecked) return Promise.resolve();
  sessionChecked = true;
  return fetch('/api/siwe/session')
    .then((r) => r.json())
    .then((d: { authenticated?: boolean; address?: string; signer?: string }) => {
      setWallet({ authenticated: !!d.authenticated, siweAddress: d.address || null, siweSigner: d.signer || null, siweLoading: false });
    })
    .catch(() => setWallet({ siweLoading: false }));
}

/** A saved wagmi connection in the cookie wagmi-config persists to. */
export function hasSavedConnection(): boolean {
  try {
    const c = document.cookie.split('; ').find((x) => x.startsWith('wagmi.store='));
    if (!c) return false;
    const raw = decodeURIComponent(c.slice('wagmi.store='.length));
    // {"state":{"connections":{"__type":"Map","value":[[id,{...}]]},"current":"..."}}
    return /"current":"[^"]+"/.test(raw);
  } catch {
    return false;
  }
}

/*--- what the UI calls ----------------------------------------------------------*/
function run(fn: (a: WalletActions) => unknown) {
  return loadWallet().then((a) => {
    if (!a) return;
    try { return fn(a); } catch (e) { console.error('[wallet] action failed', e); }
  });
}

export const wallet = {
  /** Connect Wallet: the AppKit modal (loads the SDK first if needed). */
  connect: () => run((a) => a.open()),
  /** The connected account's view (holds Disconnect). */
  openAccount: () => run((a) => a.open('Account')),
  signIn: () => run((a) => a.signIn()),
  /** Sign out of the server session and disconnect the wallet, both best-effort. */
  signOutAndDisconnect: async () => {
    setWallet({ authenticated: false, siweAddress: null, siweSigner: null, linkingSince: 0 });
    const a = actions;
    const signOut = a ? a.signOut() : fetch('/api/siwe/session', { method: 'DELETE' }).then((r) => r.ok).catch(() => false);
    await Promise.allSettled([signOut, a ? a.disconnect() : Promise.resolve()]);
  },
  /**
   * Link another sign-in to the account this session is for: let go of the
   * wallet connected now and open the connect window, so the player can pick
   * the other wallet, or Google / email. When a DIFFERENT wallet connects,
   * the runtime asks it to sign the link (useSIWE.ts) - never silently.
   */
  startLink: () => {
    if (!snap.authenticated) return Promise.resolve();
    setWallet({ linkingSince: Date.now(), linkNote: null });
    return run(async (a) => {
      if (snap.isConnected) await a.disconnect();
      a.open();
    });
  },
  cancelLink: () => setWallet({ linkingSince: 0 }),
  /** "Connect or sign in, whichever is next" - what other screens ask for. */
  ask: () => run((a) => {
    if (!snap.isConnected) a.open();
    else if (!snap.authenticated) return a.signIn();
  }),
};

export function useWallet(): WalletSnapshot {
  return useSyncExternalStore(subscribeWallet, getWallet, getWallet);
}
