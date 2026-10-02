'use client';

import { useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  checkSession,
  getWallet,
  hasSavedConnection,
  loadWallet,
  subscribeWallet,
  wallet,
  walletLoadFailed,
  walletWanted,
} from '@/lib/walletStore';

/*==============================================================================
The wallet shell

Wraps the app, but holds no wallet code: it renders the page as-is and mounts
the wallet runtime (src/components/wallet/WalletRuntime.tsx, wagmi + AppKit)
BESIDE it the first time something needs a wallet. src/lib/walletStore.ts
says when that is.

/admin renders its own runtime (its tools need wagmi hooks in the page), so
the shell stays out of the way there rather than mounting a second one.
==============================================================================*/

// once the game has booted (or failed to), then the next idle moment: a
// returning wallet player's SDK should never compete with the first frame
function afterBoot(fn: () => void) {
  const started = Date.now();
  const tick = () => {
    const $ = (window as unknown as { $?: { state?: string } }).$;
    const booted = !!$ && !!$.state && $.state !== 'loading';
    if (!booted && Date.now() - started < 20000) { setTimeout(tick, 400); return; }
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(fn, { timeout: 3000 }); else setTimeout(fn, 600);
  };
  tick();
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const ownRuntime = pathname.startsWith('/admin');
  const wanted = useSyncExternalStore(subscribeWallet, walletWanted, () => false);
  const [Runtime, setRuntime] = useState<ComponentType | null>(null);

  // the phase on <html> (idle / loading / ready / failed): lets styles and
  // tests tell whether the SDK is here without importing any of it
  useEffect(() => {
    const put = () => { document.documentElement.dataset.rsWallet = getWallet().phase; };
    put();
    return subscribeWallet(put);
  }, []);

  // fetch the runtime the first time it is wanted
  useEffect(() => {
    if (ownRuntime || !wanted || Runtime) return;
    let live = true;
    import('./wallet/WalletRuntime')
      .then((m) => { if (live) setRuntime(() => m.default); })
      .catch((e) => { console.error('[wallet] runtime failed to load', e); walletLoadFailed(); });
    return () => { live = false; };
  }, [ownRuntime, wanted, Runtime]);

  // a returning signed-in or connected player gets theirs in the background
  useEffect(() => {
    if (ownRuntime) return;
    void checkSession().then(() => {
      if (getWallet().authenticated || hasSavedConnection()) afterBoot(() => void loadWallet());
    });
  }, [ownRuntime]);

  // screens that need a wallet ask by event; a purchase that starts before
  // the runtime is here is held, then handed to it once it has mounted
  useEffect(() => {
    if (ownRuntime) return;
    const onAsk = () => void wallet.ask();
    const onBuy = (e: Event) => {
      if (getWallet().phase === 'ready') return; // the runtime's MarketBridge has it
      const detail = (e as CustomEvent).detail;
      void loadWallet().then((a) => {
        if (a) window.dispatchEvent(new CustomEvent('raidshooter:buy', { detail }));
        else window.dispatchEvent(new CustomEvent('raidshooter:purchase', { detail: { itemId: detail?.itemId, status: 'failed' } }));
      });
    };
    window.addEventListener('raidshooter:wallet', onAsk);
    window.addEventListener('raidshooter:buy', onBuy);
    return () => {
      window.removeEventListener('raidshooter:wallet', onAsk);
      window.removeEventListener('raidshooter:buy', onBuy);
    };
  }, [ownRuntime]);

  return (
    <>
      {children}
      {Runtime && <Runtime />}
    </>
  );
}
