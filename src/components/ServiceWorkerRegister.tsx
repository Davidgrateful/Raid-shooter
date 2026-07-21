'use client';

import { useEffect, useState } from 'react';

// Registers the service worker (making the game installable + offline-capable)
// and surfaces a lightweight "Install app" prompt when the browser offers one.
// Everything here degrades to nothing on browsers without support — iOS Safari,
// for instance, has no beforeinstallprompt event, so the button simply never
// appears and users add to home screen via the Share sheet instead.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function ServiceWorkerRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };
    // register after load so it never competes with first paint / gameplay
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        transform: 'translateX(-50%)',
        zIndex: 60,
        clipPath:
          'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
      }}
      className="flex items-center gap-3 border border-cyan-400/40 bg-[#070b12]/95 px-4 py-2.5 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur-md"
    >
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">
        Install Raid Shooter
      </span>
      <button
        onClick={async () => {
          const d = deferred;
          setDeferred(null);
          try {
            await d.prompt();
            await d.userChoice;
          } catch {
            /* ignore */
          }
        }}
        style={{
          clipPath:
            'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
        }}
        className="bg-cyan-400 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-colors hover:bg-cyan-300"
      >
        ▶ Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="font-mono text-xs text-white/40 hover:text-cyan-300"
      >
        ✕
      </button>
    </div>
  );
}
