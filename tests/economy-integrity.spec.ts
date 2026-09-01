import { test, expect } from '@playwright/test';
import { boot, VETERAN, NEWCOMER } from './support/harness';
import { weekKey } from '../src/lib/weekly';
import { mergePilotXp } from '../src/lib/profile';

/*==============================================================================
ECONOMY INTEGRITY

Four leaks found in the Phase 10 live-content audit, all of which cost the game
something real: a streak that paid out for not playing, two different "weeks"
three days apart, progression that did not survive a new device, and reward
failures that looked exactly like having no reward.
==============================================================================*/

test.describe('the play streak requires playing', () => {
  /*
   * refreshStreak used to POST /api/streak on every menu visit, so the DAILY
   * PLAY STREAK counted opening the app. Three days of launching the game and
   * backing straight out earned a free shield charge; thirty earned a pilot.
   * The read and the record are now separate calls.
   */
  test('opening the deck without raiding records nothing', async ({ page }) => {
    const posts: string[] = [];
    await page.route('**/api/streak', async (route) => {
      if (route.request().method() === 'POST') posts.push('post');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ days: 0, claimedAt: 0, pilotClaimed: false, goal: 3, pilotGoal: 30 }),
      });
    });

    // NEWCOMER has never finished a run, so storage.rounds is 0
    await boot(page, { profile: NEWCOMER });
    await page.waitForTimeout(2500);

    const rounds = await page.evaluate(() => Number((window as any).$.storage.rounds) || 0);
    expect(rounds, 'this profile should have no completed runs').toBe(0);
    expect(posts, 'a streak play was recorded for someone who never raided').toEqual([]);
  });

  test('a completed run does record a play', async ({ page }) => {
    const posts: string[] = [];
    await page.route('**/api/streak', async (route) => {
      if (route.request().method() === 'POST') posts.push('post');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ days: 1, claimedAt: 0, pilotClaimed: false, goal: 3, pilotGoal: 30 }),
      });
    });

    // VETERAN has 63 completed rounds, and no record has been made for them
    await page.addInitScript(() => { try { localStorage.removeItem('rs-streak-rounds'); } catch { /* private mode */ } });
    await boot(page, { profile: VETERAN });
    await page.waitForTimeout(3000);

    expect(posts.length, 'a finished run did not record a play').toBeGreaterThan(0);
  });
});

test.describe('one definition of a week', () => {
  /*
   * The weekly GIFT used `Math.floor(Date.now() / (7 * 86400000))` - an
   * epoch-aligned week, and the Unix epoch was a Thursday. The weekly LADDER
   * rolls over on Monday. The game meant two different things by "weekly",
   * three days apart.
   */
  test('the gift week and the ladder week start on the same day', () => {
    const ladder = weekKey();
    const start = Date.parse(`${ladder}T00:00:00Z`);
    expect(Number.isNaN(start), 'the week key is not a parseable date').toBe(false);
    expect(new Date(start).getUTCDay(), 'the shared week does not start on a Monday').toBe(1);
  });

  test('the week key is stable within a week and moves across one', () => {
    const monday = Date.UTC(2026, 7, 31, 0, 0, 0);      // Mon 31 Aug 2026
    const sunday = Date.UTC(2026, 8, 6, 23, 59, 0);     // Sun 6 Sep, same week
    const nextMon = Date.UTC(2026, 8, 7, 0, 0, 0);      // Mon 7 Sep, next week

    expect(weekKey(monday)).toBe(weekKey(sunday));
    expect(weekKey(monday)).not.toBe(weekKey(nextMon));
    // and the old Thursday boundary must NOT split a week any more
    const thursday = Date.UTC(2026, 8, 3, 12, 0, 0);
    expect(weekKey(monday), 'a Thursday still splits the week').toBe(weekKey(thursday));
  });
});

test.describe('pilot XP survives a new device', () => {
  /*
   * pilotxp lived only in localStorage, so the one thing the game presents as
   * "your progression" was the only thing that did not survive a cleared
   * browser - while purchases and rank, which were not earned by playing, did.
   * The merge takes the higher value per pilot in both directions.
   */
  const who = () => `guest:xp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  test('a higher local total is adopted', async () => {
    const key = who();
    expect(await mergePilotXp(key, { onyix: 4200 })).toEqual({ onyix: 4200 });
    expect(await mergePilotXp(key, { onyix: 9100 })).toEqual({ onyix: 9100 });
  });

  test('a fresh device full of zeroes cannot erase real progress', async () => {
    const key = who();
    await mergePilotXp(key, { onyix: 31000, nova: 6000 });
    const after = await mergePilotXp(key, { onyix: 0, nova: 0 });
    expect(after, 'a new device wiped a real total').toEqual({ onyix: 31000, nova: 6000 });
  });

  test('a forged payload cannot corrupt a profile', async () => {
    const key = who();
    await mergePilotXp(key, { onyix: 4200 });
    const after = await mergePilotXp(key, {
      onyix: Number.NaN,
      nova: Number.POSITIVE_INFINITY,
      atlasbeam: -5000,
      'bad id!': 999,
    } as Record<string, number>);
    expect(after.onyix, 'NaN overwrote a real total').toBe(4200);
    expect(after.nova).toBeUndefined();
    expect(after.atlasbeam).toBeUndefined();
    expect(after['bad id!']).toBeUndefined();
  });

  test('the merge is idempotent', async () => {
    const key = who();
    const first = await mergePilotXp(key, { onyix: 12_000 });
    const second = await mergePilotXp(key, { onyix: 12_000 });
    expect(second).toEqual(first);
  });
});

test('a failed reward fetch is shown, not swallowed', async ({ page }) => {
  /*
   * Both reward calls ended in `.catch(() => {})`, so a dropped request looked
   * exactly like "nothing to claim" - silent on the one thing the deck most
   * wants the player to notice.
   */
  await page.route('**/api/streak**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }));
  await page.route('**/api/claim/weekly**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }));

  await boot(page, { profile: VETERAN });
  await page.waitForTimeout(2500);

  const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  expect(text, 'a failed reward fetch left the deck silent').toContain('unavailable');
  expect(text, 'no way to retry a failed reward fetch').toContain('retry');
});
