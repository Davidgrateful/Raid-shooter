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

  /* The TRAP. This test was called "trap it, and give it back" long before it
     checked either - it asserted focus moved in and Escape closed, and stopped.
     Tab from the last control must wrap to the first, not land on the page
     behind the dialog. */
  const wrapped = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]') as HTMLElement;
    const items = Array.from(d.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input, [href]'))
      .filter((el) => el.offsetParent !== null);
    if (items.length < 2) return { skip: true } as const;
    items[items.length - 1].focus();
    return { skip: false, last: document.activeElement === items[items.length - 1] } as const;
  });
  if (!wrapped.skip) {
    expect(wrapped.last, 'could not park focus on the last control').toBe(true);
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return !!(d && document.activeElement && d.contains(document.activeElement));
    });
    expect(stillInside, 'Tab escaped the dialog to the page behind it').toBe(true);
  }

  // Escape closes it
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(await page.locator('[role="dialog"]').count()).toBe(0);

  /* And GIVE IT BACK: focus returns to whatever opened the dialog, rather than
     being dumped on <body> where the next Tab restarts from the top. */
  const returned = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { tag: el ? el.tagName.toLowerCase() : 'none', text: (el?.textContent || '').trim().slice(0, 30) };
  });
  expect(returned.tag, 'focus was dropped on close instead of returning to the opener').not.toBe('body');
  expect(returned.text.toLowerCase()).toContain('feedback');
});

/*==============================================================================
The upgrade draft is the one modal that opens DURING a run and blocks it until
the player picks. Measured before this was fixed: aria-modal absent,
document.activeElement was <body> (focus never entered), and Tab from the last
card escaped to the "Connect Wallet" button behind the veil.
==============================================================================*/
test('the in-run upgrade draft behaves like the blocking modal it is', async ({ page }) => {
  await boot(page, { profile: VETERAN });

  await page.evaluate(() => {
    const $ = (window as any).$;
    $.reset();
    $.resetUpgrades();
    $.setState('play');
    $.openUpgradeDraft();
  });
  const draft = page.locator('.rs-draft[role="dialog"]');
  await expect(draft).toBeVisible({ timeout: 15_000 });

  await expect(draft, 'the draft is not announced as a modal').toHaveAttribute('aria-modal', 'true');

  // focus must be on a card, not left on the page underneath
  await expect
    .poll(async () => page.evaluate(() => {
      const d = document.querySelector('.rs-draft[role="dialog"]');
      return !!(d && document.activeElement && d.contains(document.activeElement));
    }), { message: 'focus never entered the draft', timeout: 5000 })
    .toBe(true);

  // Tab from the last card must not reach the page behind
  await page.evaluate(() => {
    const d = document.querySelector('.rs-draft[role="dialog"]') as HTMLElement;
    const cards = d.querySelectorAll<HTMLElement>('button:not([disabled])');
    cards[cards.length - 1]?.focus();
  });
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => {
    const d = document.querySelector('.rs-draft[role="dialog"]');
    return !!(d && document.activeElement && d.contains(document.activeElement));
  });
  expect(inside, 'Tab escaped the run-blocking draft to the page behind it').toBe(true);
});

/*==============================================================================
A focus ring that exists in the DOM but cannot be seen is not a focus ring. The
browser default here computed to `outline: auto 1px rgb(16,16,16)` - near-black
on a near-black UI - so this asserts the ring is actually OURS.
==============================================================================*/
test('keyboard focus is visibly indicated', async ({ page }) => {
  await boot(page, { profile: VETERAN });

  // walk to a real control rather than assuming the first Tab lands on one
  let styled: { width: string; color: string } | null = null;
  for (let i = 0; i < 10 && !styled; i++) {
    await page.keyboard.press('Tab');
    styled = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return { width: cs.outlineWidth, color: cs.outlineColor };
    });
  }
  expect(styled, 'Tab never reached a focusable control').not.toBeNull();

  // a 2px ring is ours; the UA default here was 1px
  expect(
    parseFloat(styled!.width),
    `focus ring is ${styled!.width} - the invisible UA default is back`,
  ).toBeGreaterThanOrEqual(2);
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
