'use client';

import { useEffect, useState } from 'react';
import { WalletButton } from './WalletButton';

export function Header() {
  const [fullscreen, setFullscreen] = useState(false);
  const [gameState, setGameState] = useState('');

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreen);
    updateFullscreen();

    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = (window as typeof window & { $?: { state?: string } }).$?.state || '';
      setGameState(state);
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen is not available in this browser context.', error);
    }
  }

  function showControls() {
    window.dispatchEvent(new Event('raid-shooter:show-controls'));
  }

  if (gameState === 'play') {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-3 px-3 py-3 pointer-events-none sm:px-4">
      <div className="pointer-events-auto rounded border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white/80 shadow-[0_0_24px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:text-sm">
        RAID SHOOTER
      </div>
      <div className="pointer-events-auto flex max-w-[72vw] flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={showControls}
          className="rounded border border-white/15 bg-black/55 px-3 py-2 text-xs text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          Controls
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded border border-white/15 bg-black/55 px-3 py-2 text-xs text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        <WalletButton />
      </div>
    </header>
  );
}
