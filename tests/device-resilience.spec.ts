import { test, expect } from '@playwright/test';
import { boot, VETERAN } from './support/harness';

/*==============================================================================
DEVICE RESILIENCE

These cover two behaviours that only MATTER on a real phone but can be proved
here, because both are ordinary DOM events the engine either handles or does
not. What cannot be proved here is that iOS actually fires them the way the
fixes assume - that is stated in the Phase 22 report as UNVERIFIED and needs a
physical device. This file holds the handlers honest in the meantime.

Neither test claims device verification. They assert the engine reacts to the
event, nothing more.
==============================================================================*/

test('safe-area insets refresh on a resize DURING a run', async ({ page }) => {
  /*
   * resizecb deliberately skips re-fitting the canvas while playing, so a
   * resize cannot disrupt gameplay. The cost was that the notch / home
   * indicator measurements went stale for the rest of the run - and on iOS
   * Safari the address bar collapses mid-play, which is exactly a resize with
   * no orientation change. The insets are now refreshed even when the full
   * re-fit is skipped.
   */
  await boot(page, { profile: VETERAN });

  await page.evaluate(() => {
    const $ = (window as any).$;
    $.reset();
    $.setState('play');
  });

  const result = await page.evaluate(async () => {
    const $ = (window as any).$;
    const root = document.documentElement;

    // Baseline with no inset, read the way the engine reads it.
    root.style.setProperty('--safe-top', '0px');
    $.refreshSafeAreas();
    const before = $.safeAreaTop;

    // Now simulate the device reporting a notch, and fire a resize the way a
    // collapsing address bar would.
    root.style.setProperty('--safe-top', '44px');
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 100));

    const after = $.safeAreaTop;
    const state = $.state;
    root.style.removeProperty('--safe-top');
    return { before, after, state };
  });

  expect(result.state, 'the run should still be in play - this must not re-fit the canvas').toBe('play');
  expect(result.before).toBe(0);
  expect(result.after, 'safe-area inset went stale across a mid-run resize').toBe(44);
});

test('a backgrounded run pauses on visibilitychange, not only on blur', async ({ page }) => {
  /*
   * The engine paused on `blur` alone. iOS fires `visibilitychange` reliably
   * when the player switches apps or the screen locks, and `blur` less so, so
   * a raid could stay nominally live while nobody was looking at it.
   */
  await boot(page, { profile: VETERAN });

  const result = await page.evaluate(async () => {
    const $ = (window as any).$;
    $.reset();
    $.setState('play');
    const playing = $.state;

    // Report the page as hidden and fire the event the browser would.
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 100));
    const afterHide = $.state;

    // put `hidden` back so nothing downstream sees a lying document
    if (original) Object.defineProperty(Document.prototype, 'hidden', original);
    else Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    return { playing, afterHide };
  });

  expect(result.playing).toBe('play');
  expect(result.afterHide, 'a hidden run kept running instead of pausing').toBe('pause');
});

test('the frame delta stays clamped so a resumed run cannot leap', async ({ page }) => {
  /*
   * Not a fix - a check that an existing guard still holds. updateDelta clamps
   * $.dt to 10, which is what stops a run resumed after minutes in the
   * background from advancing the world in one enormous step. Worth pinning:
   * it is invisible until the day someone removes it.
   */
  await boot(page, { profile: VETERAN });

  const dt = await page.evaluate(() => {
    const $ = (window as any).$;
    $.reset();
    $.setState('play');
    $.lt = Date.now() - 600_000;   // ten minutes ago
    $.updateDelta();
    return $.dt;
  });

  expect(dt, 'a ten-minute gap produced an unclamped delta').toBeLessThanOrEqual(10);
  expect(dt).toBeGreaterThan(0);
});
