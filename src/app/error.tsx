'use client';

import { useEffect } from 'react';

/*
 * Route-level error boundary. Without this file a render error anywhere in the
 * app dropped the player on Next's stock error page: white, unbranded, and with
 * no way back into the game short of editing the URL.
 *
 * It says what happened in one line, offers the one useful action (try again,
 * which re-renders the segment without a full reload), and a way home. The
 * error is logged for the browser console; nothing about it is shown to the
 * player, because a stack trace is not something they can act on.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[raid-shooter] render error', error);
  }, [error]);

  return (
    <main
      role="alert"
      style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
        background: '#05070d', color: 'rgba(233,241,255,0.9)', textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#35e8ff', margin: 0 }}>
          Signal lost
        </p>
        <h1 style={{ fontSize: 22, margin: '10px 0 8px', fontWeight: 700 }}>Something on this screen broke.</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(233,241,255,0.55)', margin: '0 0 22px' }}>
          Your pilot, progress and purchases are safe — they live on the server, not on this page.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: 44, padding: '0 20px', border: '1px solid rgba(53,232,255,0.5)',
              background: 'rgba(53,232,255,0.12)', color: '#fff', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12, cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {/* A full navigation, not next/link, on purpose: <Link> navigates
              client-side INSIDE the React tree that just threw, so it can land
              straight back in the broken state. A real page load rebuilds the
              app from scratch, which is the point of a recovery button. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              minHeight: 44, padding: '0 20px', display: 'inline-flex', alignItems: 'center',
              border: '1px solid rgba(233,241,255,0.18)', color: 'rgba(233,241,255,0.85)',
              letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12, textDecoration: 'none',
            }}
          >
            Back to the deck
          </a>
        </div>
      </div>
    </main>
  );
}
