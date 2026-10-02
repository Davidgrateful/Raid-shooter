import { test, expect } from '@playwright/test';
import { boot, startRun } from './support/harness';

/*==============================================================================
UPRIGHT PHONES

Raids used to wall a phone held upright behind "Rotate to fly". Most links
from X and Telegram open upright, so that is where a new player first meets
the game - the raid, its overlays and the old canvas screens (how to play,
stats, credits, daily run) now all lay out for it instead.
==============================================================================*/

// sets its own viewport, so it runs under the desktop project only
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });

test('a raid runs upright, with no rotate prompt in the way', async ({ page }) => {
  await boot(page);
  await startRun(page, 2500);
  expect(await page.evaluate(() => (window as any).$.state)).toBe('play');
  expect(await page.locator('#rotate-overlay').count()).toBe(0);
  // the engine really laid out for portrait, not a squashed landscape canvas
  const size = await page.evaluate(() => ({ cw: (window as any).$.cw, ch: (window as any).$.ch }));
  expect(size.ch).toBeGreaterThan(size.cw);
});

for (const state of ['howto', 'stats', 'credits', 'dailyrun']) {
  test(`the ${state} screen keeps every button on screen upright`, async ({ page }) => {
    await boot(page);
    await page.evaluate((s) => (window as any).$.setState(s), state);
    await page.waitForTimeout(800);
    const off = await page.evaluate(() => {
      const $ = (window as any).$;
      return ($.buttons || [])
        .filter((b: any) => b.sx < 0 || b.ex > $.cw || b.sy < 0 || b.ey > $.ch)
        .map((b: any) => `${b.title} ${Math.round(b.sx)}-${Math.round(b.ex)}`);
    });
    expect(off, `${state}: buttons run off a ${390}px screen`).toEqual([]);
  });
}
