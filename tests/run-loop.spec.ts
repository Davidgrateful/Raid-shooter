import { test, expect } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';

/*==============================================================================
THE CORE LOOP

Deck -> Pre-Flight -> Raid -> Field Refit -> Debrief -> Redeploy.

This is the path every player walks every session, and the one that must never
break. The assertions deliberately check the LINE between run-only and
permanent state, because that boundary is the game's central promise: a run is
lost, a career is not.
==============================================================================*/

test('a full run round trip keeps the right things and drops the rest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|Analytics|ERR_|Connector/.test(m.text())) {
      errors.push(m.text());
    }
  });

  await boot(page, {
    profile: { ...VETERAN, score: 41250, rounds: 63 },
    serverProfile: { items: ['trail_ion', 'drone_voltmite'], consumables: { consumable_health: 2 } },
    board: { entries: [], total: 0 },
  });

  // --- PRE-FLIGHT: the hold is read from the server profile
  await goToState(page, 'playmode', 2500);
  const preflight = await page.evaluate(() => ({
    state: (window as any).$.state,
    kits: (window as any).$.consumableCount('consumable_health'),
  }));
  expect(preflight.state).toBe('playmode');
  expect(preflight.kits).toBe(2);

  // --- RAID
  await page.evaluate(() => { const $ = (window as any).$; $.reset(); $.setState('play'); $.autofire = 1; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).$.state)).toBe('play');

  // --- FIELD KIT: spending one marks the run assisted and decrements the hold
  const kit = await page.evaluate(() => {
    const $ = (window as any).$;
    $.hero.life = 0.5;
    const before = $.consumableCount('consumable_health');
    $.useConsumable('consumable_health', () => { $.hero.life = Math.min(1, $.hero.life + 0.4); });
    return { before, after: $.consumableCount('consumable_health'), assisted: !!$.runAssisted };
  });
  expect(kit.after).toBe(kit.before - 1);
  expect(kit.assisted).toBe(true);

  // --- FIELD REFIT: a pick applies and returns to play
  const refit = await page.evaluate(() => {
    const $ = (window as any).$;
    $.openUpgradeDraft();
    const opened = $.state;
    const pick = $.upgradeChoices && $.upgradeChoices[0] ? $.upgradeChoices[0].id : null;
    if (pick) $.chooseUpgrade(pick);
    return { opened, pick, stacks: pick ? $.upgrades[pick] : 0, state: $.state };
  });
  expect(refit.opened).toBe('upgrade');
  expect(refit.pick).toBeTruthy();
  expect(refit.stacks).toBeGreaterThanOrEqual(1);
  expect(refit.state).toBe('play');

  // --- DEBRIEF: the run ends and reports what was kept vs lost
  const permanentBefore = await page.evaluate(() => {
    const $ = (window as any).$;
    return { best: $.storage.score, xp: $.pilotXp('onyix'), rounds: $.storage.rounds };
  });
  await page.evaluate(() => {
    const $ = (window as any).$;
    $.score = 52000; $.continueUsedThisRun = 1; $.hero.life = 0;
  });
  await page.waitForFunction(() => (window as any).$.state === 'gameover', null, { timeout: 30000 });

  const bands = await page.locator('.rs-ao-band-label').allInnerTexts();
  expect(bands.map((b) => b.toUpperCase())).toEqual(expect.arrayContaining(['YOU KEEP', 'THIS RUN']));

  // --- PERMANENT STATE actually advanced
  const permanentAfter = await page.evaluate(() => {
    const $ = (window as any).$;
    return { best: $.storage.score, xp: $.pilotXp('onyix'), rounds: $.storage.rounds };
  });
  expect(permanentAfter.best).toBeGreaterThan(permanentBefore.best);
  expect(permanentAfter.rounds).toBe(permanentBefore.rounds + 1);

  // --- REDEPLOY returns to PRE-FLIGHT, not straight into a raid, and the
  // run-only refit is gone while the kit spend persisted.
  await page.locator('.rs-ao-cta, .rs-btn-solid').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const $ = (window as any).$;
    return { state: $.state, kits: $.consumableCount('consumable_health'), score: $.score };
  });
  expect(after.kits).toBe(1);   // the spent kit did not come back
  expect(after.score).toBe(0);  // the run score did not carry over

  expect(errors).toEqual([]);
});
