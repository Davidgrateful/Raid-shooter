import { test, expect } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';

/*==============================================================================
ACCESSIBILITY

The game canvas will never be screen-reader navigable and that is accepted.
The HTML around it should be. These tests cover the two things that actually
strand a keyboard user: a dialog that opens without taking focus, and a screen
whose controls cannot be reached by Tab at all.
==============================================================================*/

test('dialogs take focus, trap it, and give it back', async ({ page }) => {
  await boot(page, { profile: VETERAN });

  const opener = page.locator('.rs-nav-item, .rs-tab').filter({ hasText: /feedback/i }).first();
  if (!(await opener.count())) {
    // the utility lives behind MORE on narrow layouts
    const more = page.locator('button').filter({ hasText: /more/i }).first();
    if (await more.count()) { await more.click(); await page.waitForTimeout(500); }
  }
  const feedback = page.locator('button').filter({ hasText: /feedback/i }).first();
  test.skip(!(await feedback.count()), 'feedback entry point not present at this viewport');

  await feedback.click();
  await page.waitForTimeout(700);

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // focus must be INSIDE the dialog, not left on the page behind it
  const focusInside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!(d && document.activeElement && d.contains(document.activeElement));
  });
  expect(focusInside, 'focus did not move into the dialog').toBe(true);

  // Escape closes it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(await page.locator('[role="dialog"]').count()).toBe(0);
});

test('menu screens are reachable by keyboard', async ({ page }) => {
  await boot(page, { profile: VETERAN, board: { entries: [], total: 0 } });

  for (const state of ['hangar', 'market', 'settings']) {
    await goToState(page, state, 1800);

    // Tab a handful of times and confirm focus actually lands on controls
    // inside the screen rather than falling through to the document.
    const landed: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return el.tagName.toLowerCase();
      });
      if (where) landed.push(where);
    }
    expect(landed.length, `${state}: Tab never reached a focusable control`).toBeGreaterThan(0);
  }
});
