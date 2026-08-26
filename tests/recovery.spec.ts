import { test, expect } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';

/*==============================================================================
RECOVERY

Every data-backed screen must let a player recover from a temporary failure
WITHOUT leaving the screen. The regression this guards against is subtle and
was real: a failed request that leaves a permanent "loading" state is still a
rendering page, it just lies. So each case drives the full state machine -
error, retry while still down, retry once it recovers - and asserts the screen
comes back with real content.
==============================================================================*/

test.describe('in-place recovery', () => {
  test('the armory recovers without leaving the screen', async ({ page }) => {
    let marketDown = true;
    let requests = 0;
    await page.route('**/api/market*', (r) => {
      requests++;
      return marketDown
        ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' })
        : r.continue();
    });

    await boot(page, { profile: VETERAN });
    await goToState(page, 'market', 2500);

    // ERROR: named, and recoverable here
    const recover = page.locator('.rs-am-wall .rs-recover');
    await expect(recover).toBeVisible();
    await expect(recover).toContainText(/unavailable/i);

    // RETRY while still down: exactly one request, and the screen stays usable
    const before = requests;
    await page.locator('.rs-am-wall .rs-recover-btn').click();
    await page.waitForTimeout(1500);
    expect(requests - before).toBe(1);
    await expect(recover).toBeVisible();

    // RETRY once the server is back: real stock returns
    marketDown = false;
    await page.locator('.rs-am-wall .rs-recover-btn').click();
    await page.waitForTimeout(2500);
    expect(await page.locator('.rs-am-slot').count()).toBeGreaterThan(0);
  });

  test('the board recovers and never invents a standing', async ({ page }) => {
    let boardDown = true;
    await page.route('**/api/leaderboard*', (r) =>
      boardDown
        ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' })
        : r.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({
              entries: [
                { address: '0xa1', name: 'VECTOR', score: 98400, kills: 900, pilot: 'nova' },
                { address: 'guest:me', name: 'ONYX', score: 41250, kills: 400, pilot: 'onyix' },
              ], total: 2, persistent: true,
            }),
          }));
    await page.route('**/api/siwe/session*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":false,"guestId":"guest:me"}' }));

    await boot(page, { profile: VETERAN });
    await goToState(page, 'board', 2500);

    const stand = page.locator('.rs-sb-stand');
    await expect(stand).toContainText(/unavailable/i);
    // it must NOT claim a rank it cannot read
    await expect(stand).not.toContainText(/YOUR RANK/i);

    boardDown = false;
    await page.locator('.rs-sb-stand .rs-recover-btn').click();
    await page.waitForTimeout(2500);
    await expect(stand).toContainText(/YOUR RANK/i);
  });
});
