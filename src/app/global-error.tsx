'use client';

/*
 * Last-resort boundary for an error in the root layout itself, where error.tsx
 * cannot help because the layout it would render inside is what failed. It has
 * to supply its own <html> and <body>. Deliberately minimal: a full reload is
 * the only recovery that makes sense when the shell itself is broken.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#05070d',
        color: 'rgba(233,241,255,0.9)', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Raid Shooter hit a problem loading.</h1>
          <p style={{ fontSize: 14, color: 'rgba(233,241,255,0.55)', margin: '0 0 20px' }}>Your progress is safe.</p>
          <button type="button" onClick={() => { try { reset(); } catch { /* fall through */ } window.location.reload(); }}
            style={{ minHeight: 44, padding: '0 22px', border: '1px solid rgba(53,232,255,0.5)',
              background: 'rgba(53,232,255,0.12)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
