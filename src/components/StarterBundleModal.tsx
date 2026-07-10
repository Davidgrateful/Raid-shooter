'use client';

import { useEffect, useState } from 'react';
import { PilotIcon } from '@/components/PilotIcon';

// FILLER / DESIGN DRAFT — the popup UI below is real and shippable; the
// bundle contents and price are a mockup for the team to sign off on before
// this goes live, not a live SKU. This is the proven "cheap first purchase"
// pattern nearly every F2P economy runs (Clash of Clans' starter pack,
// Genshin's welcome bundle, Marvel Rivals' founder pack): a steeply
// discounted bundle aimed at converting a NEVER-PAID player into a
// HAS-PAID-ONCE player, which is the hardest conversion in free-to-play and
// the one that unlocks every later purchase. Contents below are three real,
// already-priced catalog items (see src/lib/market.ts) bundled at a real
// discount off their individual prices - swap the ids/price once the team
// picks the actual bundle.
//
// The CTA intentionally does NOT charge anything - there is no atomic
// "buy this bundle in one tx" SKU yet (that needs its own contract-side
// decision: one bundled purchase vs three separate calls). It opens the
// real Market screen instead, which already sells all three items
// individually. Wire a real one-tap bundle checkout once pricing is final.
const BUNDLE = {
  title: 'RECRUIT PACK',
  pilotId: 'nova',
  pilotTitle: 'NOVA PILOT',
  items: [
    { label: 'NOVA PILOT', was: 0.5 },
    { label: 'AEGIS HALO DRONE', was: 0.9 },
    { label: 'GOLD SHIP SKIN', was: 0.3 },
  ],
  priceUsd: 0.99,
};

const SEEN_KEY = 'starterBundleSeen';
const bundleWas = BUNDLE.items.reduce((sum, i) => sum + i.was, 0);
const savedPct = Math.round((1 - BUNDLE.priceUsd / bundleWas) * 100);

function engine() {
  return (typeof window !== 'undefined'
    ? (window as unknown as { $?: { state?: string; setState?: (s: string) => void; marketTab?: string } }).$
    : null) || null;
}

export function StarterBundleModal() {
  const [open, setOpen] = useState(false);

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

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  }

  function shopThePack() {
    const $ = engine();
    if ($ && $.setState) {
      $.marketTab = 'character';
      $.setState('market');
    }
    dismiss();
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
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-white/30 line-through">${bundleWas.toFixed(2)}</span>
            <span className="text-2xl font-black text-amber-300">${BUNDLE.priceUsd.toFixed(2)}</span>
            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">SAVE {savedPct}%</span>
          </div>
          <button
            onClick={shopThePack}
            className="mt-4 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-black uppercase tracking-wide text-black hover:bg-amber-300"
          >
            Shop the pack
          </button>
          <button onClick={dismiss} className="mt-2 text-xs text-white/30 hover:text-white/50">
            Maybe later
          </button>
          <p className="mt-3 text-[10px] leading-relaxed text-white/25">
            Cosmetics only — never affects your score or rank.
          </p>
        </div>
      </div>
    </div>
  );
}
