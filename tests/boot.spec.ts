import { test, expect } from '@playwright/test';

/*==============================================================================
BOOT TIME

The splash used to run a FIXED 6 seconds from the moment it was entered, on top
of however long the engine had already spent booting. Measured on the built app
before this change:

    desktop            engine up 1589ms | splash left 9350ms
    phone, 4x CPU      engine up 1496ms | splash left 9438ms

Throttling the CPU four times over moved the total by 88ms, which is the proof
it was a timer rather than work - and the logo, the heaviest thing drawn on that
screen, had finished loading at 399ms. A first-time player waited nine seconds
to reach a menu, and the progress bar charted a countdown while presenting
itself as a load.

It is now a budget for the WHOLE boot, measured from navigation, so slow init
spends the same budget instead of adding to it. These tests hold the two
properties that matter: the wait is bounded, and it is escapable.
==============================================================================*/

/** ms from navigation until the engine leaves the loading state. */
async function timeToMenu(page: import('@playwright/test').Page): Promise<number> {
  const t0 = Date.now();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).$, null, { timeout: 60_000 });
  await page.waitForFunction(() => (window as any).$.state !== 'loading', null, { timeout: 60_000 });
  return Date.now() - t0;
}

test('the splash does not add a fixed wait on top of the boot', async ({ page }) => {
  /*
   * The ceiling is deliberately loose - a CI runner is slower than a laptop and
   * this must not fail for being a slow day. It is still far below the 9.4s the
   * old fixed timer produced, so a regression to "wait N seconds regardless"
   * cannot pass.
   */
  const ms = await timeToMenu(page);
  expect(ms, `reaching the menu took ${ms}ms`).toBeLessThan(8000);
});

test('a tap escapes the splash, and the screen says so', async ({ page }) => {
  /*
   * A tap has always skipped this. Nothing ever said so: the screen read
   * LOADING, which tells a player to wait. The hint is drawn to canvas, so it
   * cannot be asserted as text - what IS assertable is that the skip works and
   * is armed early, which is the behaviour the hint advertises.
   */
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).$, null, { timeout: 60_000 });
  await page.waitForFunction(() => (window as any).$.state === 'loading', null, { timeout: 60_000 });

  await page.waitForTimeout(700);           // past the 250ms arming threshold
  const t0 = Date.now();
  // A click presses and releases inside one frame, so the loading state - which
  // reads $.mouse.down once per rendered frame - can miss it entirely. Holding
  // for a few frames is what a real thumb does anyway.
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForFunction(() => (window as any).$.state !== 'loading', null, { timeout: 10_000 });
  const ms = Date.now() - t0;

  expect(ms, `a tap took ${ms}ms to leave the splash`).toBeLessThan(2000);
});

test('a slow device does not wait longer than a fast one', async ({ page, browser }) => {
  /*
   * The property the old code got exactly backwards. A fixed post-boot timer
   * means a slow phone waits its own boot PLUS the timer; a budget means both
   * devices land in the same place. Four-times CPU throttling is a stand-in for
   * a mid-range phone.
   */
  const fast = await timeToMenu(page);

  const ctx = await browser.newContext();
  const slow = await ctx.newPage();
  const cdp = await ctx.newCDPSession(slow);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const throttled = await timeToMenu(slow);
  await ctx.close();

  // Not "identical" - a slower device really does boot slower, and that part is
  // honest. What must not happen is the splash charging that cost twice.
  expect(throttled, `fast ${fast}ms vs throttled ${throttled}ms`).toBeLessThan(fast + 3500);
});
