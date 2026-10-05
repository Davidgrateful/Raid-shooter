import { test, expect } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';

/*==============================================================================
WHERE THE SHOOTERBOARD SITS

The board used to be a screen of its own over everything: a floating title,
the wallet button hovering in its corner, the podium twice (3D pedestals and
then the same three as cards) and a footer of buttons parked on the rows, so
on most screens not one ranked row was on the first screen. It now sits in
the command shell like the Hangar and the Armory. These hold that:

  - the rail (or the phone tab bar) is there, with RANKINGS as the place
  - the player's standing is on the first screen
  - nothing floats over the list, and on wide and landscape screens the pack
    starts on the first screen
  - when your own row is off screen, a copy of it pins to the list's foot
==============================================================================*/

const entries = Array.from({ length: 40 }, (_, i) => ({
  address: i === 24 ? 'guest:me' : '0x' + String(i).padStart(40, 'a'),
  name: `PILOT${i}`,
  score: 900000 - i * 9000,
  kills: 1000 - i,
  pilot: 'NOVA',
  cosmetics: { pilotId: 'nova', shipColor: '#35e8ff' },
}));

test('the board sits in the command shell, standing first, nothing over the rows', async ({ page }) => {
  await page.route('**/api/siwe/session*', (r) => r.fulfill({ json: { authenticated: false, guestId: 'guest:me' } }));
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, board: { entries, total: 40, persistent: true } });
  await goToState(page, 'board', 2500);

  // the shell: one place lit, and it is Rankings
  const here = page.locator('[aria-current="page"]:visible');
  await expect(here.first()).toContainText(/Rank/i);
  await expect(page.getByRole('button', { name: 'Back to command deck' })).toBeVisible();

  // one podium: three plates, no second set of cards
  await expect(page.locator('.rs-sb-plate')).toHaveCount(3);
  await expect(page.getByText('CHAMPION', { exact: true })).toBeVisible();

  // the standing is on the first screen
  const vh = page.viewportSize()!.height;
  const stand = await page.locator('.rs-sb-stand').boundingBox();
  expect(stand, 'standing block').not.toBeNull();
  expect(stand!.y).toBeLessThan(vh);
  await expect(page.locator('.rs-sb-stand')).toContainText(/YOUR RANK/i);
  await expect(page.locator('.rs-sb-stand')).toContainText('#25');

  // nothing floats over the list: the old footer is gone
  await expect(page.getByRole('button', { name: /^Back to command$/ })).toHaveCount(0);

  // where there are lanes (laptop, landscape phone), the pack starts on screen
  const lanes = await page.evaluate(() => getComputedStyle(document.querySelector('.rs-sb')!).display === 'grid');
  if (lanes) {
    const first = await page.locator('.rs-sb-row[data-top]').first().boundingBox();
    expect(first!.y + first!.height).toBeLessThanOrEqual(vh);
  }
});

test('your own row pins to the foot of the list while it is off screen', async ({ page }) => {
  await page.route('**/api/siwe/session*', (r) => r.fulfill({ json: { authenticated: false, guestId: 'guest:me' } }));
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, board: { entries, total: 40, persistent: true } });
  await goToState(page, 'board', 2500);
  const pinned = page.locator('.rs-sb-row[data-pinned="1"]');
  await expect(pinned).toBeVisible();
  await expect(pinned).toContainText('PILOT24');
  // jumping to the real row puts it on screen, and the copy stands down
  await page.locator('.rs-sb-jump').click();
  await expect(pinned).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.rs-sb-row[data-me="1"]:not([data-pinned])')).toBeInViewport();
});
