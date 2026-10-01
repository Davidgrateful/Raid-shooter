/**
 * Runs a non-urgent task once the browser is idle, so the deck's extras (panel
 * fetches, the 3D ship) don't compete with the game engine's boot on a slow
 * phone (measured: ~250ms of 4x-throttled boot). Returns a cancel function.
 */
export function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 1200);
  return () => window.clearTimeout(t);
}
