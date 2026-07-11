'use client';

import { useEffect, useRef, useState } from 'react';
import { PilotIcon } from '@/components/PilotIcon';
import { useAppKit } from '@reown/appkit/react';
import { useSIWE } from '@/hooks/useSIWE';

// A steeply discounted first-purchase bundle - the proven "cheap first
// purchase" pattern nearly every F2P economy runs (Clash of Clans' starter
// pack, Genshin's welcome bundle, Marvel Rivals' founder pack): aimed at
// converting a NEVER-PAID player into a HAS-PAID-ONCE player, the hardest
// conversion in free-to-play and the one that unlocks every later purchase.
//
// A real atomic SKU (see bundle_recruit in src/lib/market.ts, kind:'bundle')
// - one on-chain payment, verified once, that fans out to grant all three
// items server-side (profile.ts grantItem). The CTA below reuses the exact
// same window event bridge the canvas MARKET screen uses
// (raidshooter:buy -> MarketBridge.tsx sends the tx -> raidshooter:purchase
// reports back), so this popup is a real checkout, not a detour into Market.
const BUNDLE = {
  id: 'bundle_recruit',
  title: 'RECRUIT PACK',
  pilotId: 'nova',
  items: [
    { label: 'NOVA PILOT', was: 0.5 },
    { label: 'AEGIS HALO DRONE', was: 0.9 },
    { label: 'GOLD SHIP SKIN', was: 0.3 },
  ],
  priceUsd: 0.99,
  priceEth: '0.00033',
};

const SEEN_KEY = 'starterBundleSeen';
const bundleWas = BUNDLE.items.reduce((sum, i) => sum + i.was, 0);
const savedPct = Math.round((1 - BUNDLE.priceUsd / bundleWas) * 100);

interface MarketState { treasury?: string | null; network?: string; enabled?: boolean }

function engine() {
  return (typeof window !== 'undefined'
    ? (window as unknown as { $?: { fetchProfile?: () => void; marketState?: MarketState; audio?: { play: (id: string) => void } } }).$
    : null) || null;
}

const STATUS_LABEL: Record<string, string> = {
  switching: 'Switching to Base…',
  confirm: 'Confirm in wallet…',
  pending: 'Confirming on Base…',
  failed: 'Payment not verified — try again.',
  cancelled: 'Cancelled.',
  insufficient_funds: 'Not enough ETH on Base.',
  wrong_network: 'Switch to Base failed.',
};

export function StarterBundleModal() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { authenticated } = useSIWE();
  const { open: openWallet } = useAppKit();
  const busyRef = useRef(false);

  useEffect(() => {
    const seen = () => {
      try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
    };
    // never shown twice, and never to anyone who's already bought something.
    // Re-checked on EVERY menu visit, not just once at mount - the menu
    // fires this event repeatedly for as long as the tab stays open (game
    // over -> menu -> play again -> game over -> menu ...), so a check that
    // only ran once at mount would miss a dismissal that happened after the
    // listener was already registered and show the popup again next lap.
    if (seen()) return;

    let cancelled = false;
    const onState = (e: Event) => {
      if (cancelled || seen()) return;
      const isMenu = (e as CustomEvent).detail === 'menu';
      if (!isMenu) return;
      fetch('/api/profile')
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const ownsSomething = Array.isArray(d.items) && d.items.length > 0;
          if (!ownsSomething) setOpen(true);
        })
        .catch(() => {});
    };
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => { cancelled = true; window.removeEventListener('raidshooter:state', onState as EventListener); };
  }, []);

  // listens for the same raidshooter:purchase event the canvas MARKET
  // screen listens for; only reacts when it's our bundle's itemId so a
  // regular Market purchase elsewhere doesn't leak into this popup's status.
  useEffect(() => {
    const onPurchase = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: string; status: string }>).detail;
      if (!detail || detail.itemId !== BUNDLE.id) return;
      busyRef.current = detail.status === 'confirm' || detail.status === 'pending' || detail.status === 'switching';
      if (detail.status === 'done') {
        setStatus(null);
        setDone(true);
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
        const $ = engine();
        $?.fetchProfile?.();
        $?.audio?.play?.('levelup');
      } else {
        setStatus(detail.status);
      }
    };
    window.addEventListener('raidshooter:purchase', onPurchase);
    return () => window.removeEventListener('raidshooter:purchase', onPurchase);
  }, []);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  }

  function shopThePack() {
    if (busyRef.current) return;
    if (!authenticated) {
      try { openWallet(); } catch { /* modal best-effort */ }
      return;
    }
    const $ = engine();
    const treasury = $?.marketState?.treasury;
    const network = $?.marketState?.network;
    if (!$?.marketState?.enabled || !treasury) {
      setStatus('failed');
      return;
    }
    setStatus('confirm');
    window.dispatchEvent(new CustomEvent('raidshooter:buy', {
      detail: { itemId: BUNDLE.id, priceEth: BUNDLE.priceEth, treasury, network },
    }));
  }

  if (!open) return null;

  return (
    <div
      data-game-ui=""
      onClick={dismiss}
      style={{ position: 'fixed', inset: 0, zIndex: 70 }}
      className="flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0b0e16] shadow-[0_0_60px_rgba(255,207,77,0.12)]"
      >
        {/* header banner */}
        <div className="relative bg-gradient-to-b from-amber-400/15 to-transparent px-5 pb-4 pt-5 text-center">
          <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
            New pilot offer
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">{BUNDLE.title}</h2>
          <p className="mt-1 text-xs text-white/50">One-time bundle — won&apos;t show again</p>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* item preview row */}
        <div className="flex items-center justify-center gap-4 px-5 py-4">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <PilotIcon cosmetics={{ pilotId: BUNDLE.pilotId, shipColor: '#ffd75e' }} size={28} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">Pilot</span>
          </div>
          <span className="text-white/20">+</span>
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg">🛰️</div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">Drone</span>
          </div>
          <span className="text-white/20">+</span>
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg">✨</div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">Skin</span>
          </div>
        </div>

        {/* contents list */}
        <div className="mx-5 divide-y divide-white/5 rounded-lg border border-white/10 bg-white/[0.02]">
          {BUNDLE.items.map((i) => (
            <div key={i.label} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-white/70">{i.label}</span>
              <span className="text-white/30 line-through">${i.was.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* price + CTA */}
        <div className="px-5 pb-5 pt-4 text-center">
          {done ? (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-emerald-300">Pack unlocked!</p>
              <p className="mt-1 text-xs text-white/50">Nova, the Aegis Halo drone, and the gold skin are in your hangar.</p>
              <button
                onClick={dismiss}
                className="mt-4 w-full rounded-lg bg-emerald-400 py-2.5 text-sm font-black uppercase tracking-wide text-black hover:bg-emerald-300"
              >
                Nice
              </button>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-white/30 line-through">${bundleWas.toFixed(2)}</span>
                <span className="text-2xl font-black text-amber-300">${BUNDLE.priceUsd.toFixed(2)}</span>
                <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">SAVE {savedPct}%</span>
              </div>
              <button
                onClick={shopThePack}
                disabled={busyRef.current}
                className="mt-4 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-black uppercase tracking-wide text-black hover:bg-amber-300 disabled:opacity-50"
              >
                {!authenticated ? 'Connect wallet to buy' : (status && STATUS_LABEL[status]) || 'Shop the pack'}
              </button>
              <button onClick={dismiss} className="mt-2 text-xs text-white/30 hover:text-white/50">
                Maybe later
              </button>
              <p className="mt-3 text-[10px] leading-relaxed text-white/25">
                Cosmetics only — never affects your score or rank.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
