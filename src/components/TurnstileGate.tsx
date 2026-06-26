'use client';

import { useEffect, useRef } from 'react';

// Renders an invisible Cloudflare Turnstile widget and stashes a fresh token
// on window so the canvas game can attach it to guest score submissions.
// Renders nothing (and does nothing) unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is
// set, so the game is unaffected until you turn the feature on.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
    __turnstileToken?: string;
    __turnstileReset?: () => void;
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileGate() {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !ref.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        // managed/invisible: only shows a challenge if the visitor looks
        // suspicious; otherwise it solves silently in the background
        appearance: 'interaction-only',
        callback: (token: string) => {
          window.__turnstileToken = token;
        },
        'expired-callback': () => {
          window.__turnstileToken = undefined;
          window.turnstile?.reset(widgetId.current || undefined);
        },
        'error-callback': () => {
          window.__turnstileToken = undefined;
        },
      });
      // let the game request a fresh token after each submission consumes one
      window.__turnstileReset = () => {
        window.__turnstileToken = undefined;
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
      };
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      window.onTurnstileLoad = renderWidget;
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
  }, []);

  if (!SITE_KEY) return null;
  // off-screen but present; managed mode keeps it invisible unless a
  // challenge is actually required
  return <div ref={ref} style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 50 }} />;
}
