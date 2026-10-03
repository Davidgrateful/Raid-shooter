import { test, expect } from '@playwright/test';
import { boot, VETERAN } from './support/harness';

/*==============================================================================
CLIENT SIDE OF THE ANTI-ABUSE WORK

anti-abuse.spec.ts proves the server rules. These prove the ENGINE holds up its
end - that a real run asks for a ticket and submits with it, and that a spend
the server never confirmed is not quietly forgotten. Without these, the server
checks could all pass while every honest run went out unticketed.
==============================================================================*/

test('a run requests a ticket at launch and submits its score with it', async ({ page }) => {
  await boot(page, { profile: VETERAN });

  const submitted: Array<Record<string, unknown>> = [];
  await page.route('**/api/leaderboard', async (route) => {
    if (route.request().method() === 'POST') submitted.push(route.request().postDataJSON());
    await route.continue();
  });

  // exactly what the deploy screen does (components/raid/data.ts)
  await page.evaluate(() => { const $ = (window as any).$; $.reset(); $.trackRun('run_start'); $.setState('play'); $.autofire = 1; });
  await page.waitForFunction(() => !!(window as any).$.runTicket, null, { timeout: 10_000 });
  const issued = await page.evaluate(() => (window as any).$.runTicket);
  expect(issued, 'no ticket was issued for a real run').toMatch(/^[a-f0-9]{32}$/);

  // submitScore() rightly skips a zero-score run, so play until there is
  // something to submit (hull kept topped up so the run cannot end early)
  await page.evaluate(() => { const $ = (window as any).$; setInterval(() => { if ($.hero) $.hero.life = 1; }, 150); });
  await page.waitForFunction(() => (window as any).$.score > 0, null, { timeout: 45_000 });
  await page.evaluate(() => (window as any).$.submitScore());
  await expect.poll(() => submitted.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(submitted[0].runTicket, 'the score went out without the run\'s ticket').toBe(issued);
});

test('a new run never inherits the previous run\'s ticket', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  await page.evaluate(() => (window as any).$.trackRun('run_start'));
  await page.waitForFunction(() => !!(window as any).$.runTicket, null, { timeout: 10_000 });
  const first = await page.evaluate(() => (window as any).$.runTicket);
  await page.evaluate(() => (window as any).$.trackRun('run_start'));
  await page.waitForFunction((f) => (window as any).$.runTicket && (window as any).$.runTicket !== f, first, { timeout: 10_000 });
});

test.describe('consumable spends are durable', () => {
  const OWNED = { items: [], consumables: { consumable_health: 3 } };
  // 3D off: these time a retry within seconds, and on a software-GL box the
  // 3D sprite bake's one-off setup can hold the page for 2s+ mid-test - a
  // stall that has nothing to do with spends (objects-3d.spec.ts covers it)
  const PILOT = { ...VETERAN, gfx3d: 0 };

  test('a spend the server did not confirm is retried until it is', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/consumable/use', (r) => {
      calls++;
      return r.fulfill(calls === 1
        ? { status: 503, contentType: 'application/json', body: '{"error":"down"}' }
        : { status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await boot(page, { profile: PILOT, serverProfile: OWNED });
    await page.waitForFunction(() => ((window as any).$.consumableCount?.('consumable_health') || 0) > 0, null, { timeout: 10_000 });

    const used = await page.evaluate(() => (window as any).$.useConsumable('consumable_health', () => {}));
    expect(used, 'the engine refused a consumable it owns').toBe(true);

    await expect.poll(() => calls, { timeout: 15_000, message: 'a failed spend was never retried' }).toBeGreaterThanOrEqual(2);
    await expect.poll(
      () => page.evaluate(() => JSON.parse(localStorage.getItem('rs-pending-spends') || '[]').length),
      { timeout: 5_000, message: 'a confirmed spend stayed queued' },
    ).toBe(0);
  });

  test('a spend that could not be sent survives a reload and is sent next session', async ({ page }) => {
    let serverUp = false;
    let delivered = 0;
    await page.route('**/api/consumable/use', (r) => {
      if (!serverUp) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      delivered++;
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await boot(page, { profile: PILOT, serverProfile: OWNED });
    await page.waitForFunction(() => ((window as any).$.consumableCount?.('consumable_health') || 0) > 0, null, { timeout: 10_000 });
    await page.evaluate(() => (window as any).$.useConsumable('consumable_health', () => {}));
    await page.waitForTimeout(500);
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('rs-pending-spends') || '[]').length);
    expect(queued, 'an unsent spend was not kept').toBe(1);

    // the player closes the tab; the server recovers; they come back
    serverUp = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => delivered, { timeout: 20_000, message: 'the queued spend was lost across the reload' }).toBe(1);
  });
});
