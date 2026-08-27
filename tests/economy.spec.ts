import { test, expect } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
ECONOMY

These numbers are the game's promises to the player: what a level costs, what
an upgrade buys, what survives a death. They are asserted against the RUNNING
engine rather than against the source, because the bug this guards against is
the source and the behaviour drifting apart.

Every ceiling below was read out of the engine during the economy audit and
matched its own documented comment exactly. If one of these fails, either the
balance was deliberately changed - in which case update the expectation and say
so in the commit - or something regressed.
==============================================================================*/

test.describe('economy', () => {
  test('pilot XP curve matches the published thresholds', async ({ page }) => {
    await boot(page);
    const curve = await page.evaluate(() => {
      const $ = (window as any).$;
      const before = $.storage.pilotxp.onyix;
      const read = (xp: number) => {
        $.storage.pilotxp.onyix = xp;
        const next = $.pilotXpToNext('onyix');
        return { xp, level: $.pilotLevel('onyix'), next: next ? next.next : null };
      };
      const rows = [0, 399, 400, 4200, 30999, 31000, 99999].map(read);
      $.storage.pilotxp.onyix = before;
      return rows;
    });

    expect(curve).toEqual([
      { xp: 0,     level: 1,  next: 400 },
      { xp: 399,   level: 1,  next: 400 },
      { xp: 400,   level: 2,  next: 1000 },
      { xp: 4200,  level: 5,  next: 6000 },
      { xp: 30999, level: 9,  next: 31000 },
      { xp: 31000, level: 10, next: null },   // max
      { xp: 99999, level: 10, next: null },   // stays capped
    ]);
  });

  test('a maxed pilot is a nice-to-have, not a different game', async ({ page }) => {
    await boot(page);
    const mult = await page.evaluate(() => {
      const $ = (window as any).$;
      const before = $.storage.pilotxp.onyix;
      $.storage.pilotxp.onyix = 0;      const l1 = $.pilotLevelDamageMult('onyix');
      $.storage.pilotxp.onyix = 31000;  const l10 = $.pilotLevelDamageMult('onyix');
      $.storage.pilotxp.onyix = before;
      return { l1, l10 };
    });
    expect(mult.l1).toBeCloseTo(1, 5);
    // The whole 31,000-XP grind buys 9% less damage taken. Anti-power-creep is
    // the design; if this ever exceeds ~15% the arcade balance is drifting.
    expect(mult.l10).toBeCloseTo(0.91, 5);
  });

  test('every field refit ceiling holds', async ({ page }) => {
    await boot(page);
    const caps = await page.evaluate(() => {
      const $ = (window as any).$;
      $.reset();
      const out: Record<string, number> = {};
      for (const def of $.definitions.upgrades) {
        $.resetUpgrades();
        $.upgrades[def.id] = def.max;
        $.recomputeUpgrades();
        const w = $.hero.weapon;
        const measured: Record<string, number> = {
          rapid: 5 / w.baseFireRate,
          multi: w.baseCount,
          heavy: w.bullet.damage,
          pierce: w.pierceCap,
          velocity: w.baseBulletSpeed / 10,
          thrusters: $.hero.vmax / 6,
          hull: 1 - $.hero.damageTakenMult,
          lucky: $.powerupDropChance,
          overcharge: $.powerupDuration / 300,
        };
        out[def.id] = measured[def.id];
      }
      $.resetUpgrades();
      return out;
    });

    expect(caps.rapid).toBeCloseTo(2.65, 1);       // 0.85^6 fire-rate ceiling
    expect(caps.multi).toBe(6);                    // 6 bullets per shot
    expect(caps.heavy).toBeCloseTo(7.53, 1);       // 1.4^6 damage ceiling
    expect(caps.pierce).toBe(9);                   // 1 + 2*4 enemies pierced
    expect(caps.velocity).toBeCloseTo(2.49, 1);    // 1.2^5
    expect(caps.thrusters).toBeCloseTo(1.76, 1);   // 1.12^5
    expect(caps.hull).toBeCloseTo(0.478, 2);       // you can ALWAYS still die
    expect(caps.lucky).toBeCloseTo(0.34, 2);       // no guaranteed-drop loop
    expect(caps.overcharge).toBeCloseTo(2.5, 1);   // shields never near 100% uptime
  });

  test('the refit pool degrades safely when it is exhausted', async ({ page }) => {
    await boot(page);
    // Max every upgrade, then ask for a draft. It must not open an empty one.
    const result = await page.evaluate(() => {
      const $ = (window as any).$;
      $.reset();
      $.resetUpgrades();
      for (const d of $.definitions.upgrades) $.upgrades[d.id] = d.max;
      $.setState('play');
      const before = $.state;
      // read the pool while it is still exhausted - resetting first would
      // measure a fresh pool and quietly pass
      const choices = $.getUpgradeChoices().length;
      $.openUpgradeDraft();
      const after = $.state;
      $.resetUpgrades();
      return { choices, before, after };
    });
    expect(result.choices).toBe(0);
    expect(result.after).toBe(result.before);  // stayed in play, no empty draft
  });

  /*
   * NOTE ON PILOT CHOICE. This test deliberately does NOT fly ONYIX.
   *
   * ONYIX's FOUNDER ability is "START WITH A FREE UPGRADE", and $.reset()
   * implements it by granting a RANDOM upgrade (game.js:343). Asserting that
   * a specific upgrade is empty after a reset therefore fails roughly one run
   * in nine, whenever the random pick happens to be the one being asserted -
   * which is exactly how this test failed on phone-landscape and passed on
   * desktop in the same run. The game was right; the test was rolling dice.
   *
   * NOVA has no startUpgrade, so the reset invariant can be stated exactly.
   * The founder grant keeps its own deterministic assertion below.
   */
  test('a run resets but a career does not', async ({ page }) => {
    // Every pilot but ONYIX is purchase-gated (characters.js unlock.purchase),
    // so selecting one the profile does not own silently falls back to ONYIX -
    // and straight back into the random founder grant. Own the pilot.
    await boot(page, {
      profile: { ...VETERAN, character: 1 },
      serverProfile: { items: ['pilot_nova'], consumables: {} },
    });
    await startRun(page, 800);
    const state = await page.evaluate(() => {
      const $ = (window as any).$;
      const pilotId = $.hero.character.id;
      $.score = 12345; $.kills = 40; $.comboMultiplier = 5; $.upgrades = { heavy: 3 };
      const carriedXp = $.pilotXp(pilotId);
      const carriedBest = $.storage.score;
      $.reset();
      return {
        pilotId,
        startUpgrade: !!($.hero.character.ability && $.hero.character.ability.startUpgrade),
        runScore: $.score,
        runCombo: $.comboMultiplier,
        stacks: Object.values($.upgrades as Record<string, number>).reduce((a, b) => a + b, 0),
        pilotXp: $.pilotXp(pilotId),
        best: $.storage.score,
        carriedXp, carriedBest,
      };
    });
    // Guard the premise: if the roster is reordered so this pilot DOES have a
    // starting upgrade, fail loudly here rather than silently going flaky.
    expect(state.startUpgrade, `${state.pilotId} grants a starting upgrade; pick a pilot that does not`).toBe(false);
    // run-only: gone
    expect(state.runScore).toBe(0);
    expect(state.runCombo).toBe(1);
    expect(state.stacks, 'refits carried across a reset').toBe(0);
    // permanent: untouched
    expect(state.pilotXp).toBe(state.carriedXp);
    expect(state.best).toBe(state.carriedBest);
  });

  /*
   * The founder grant itself, asserted without depending on WHICH upgrade the
   * roll produces: exactly one stack, drawn from the real upgrade pool.
   */
  test('a founder pilot starts a run with exactly one free refit', async ({ page }) => {
    await boot(page, { profile: { ...VETERAN, character: 0 } });
    await startRun(page, 800);
    const state = await page.evaluate(() => {
      const $ = (window as any).$;
      $.reset();
      const ids = Object.keys($.upgrades);
      return {
        pilotId: $.hero.character.id,
        startUpgrade: !!($.hero.character.ability && $.hero.character.ability.startUpgrade),
        ids,
        stacks: Object.values($.upgrades as Record<string, number>).reduce((a, b) => a + b, 0),
        pool: ($.definitions.upgrades as Array<{ id: string }>).map((u) => u.id),
      };
    });
    expect(state.startUpgrade, `${state.pilotId} is expected to be a founder pilot`).toBe(true);
    expect(state.stacks, 'founder grant should be exactly one stack').toBe(1);
    expect(state.ids).toHaveLength(1);
    expect(state.pool, 'the granted refit must come from the real pool').toContain(state.ids[0]);
  });

  test("today's daily challenge is real and pays the real streak reward", async ({ page }) => {
    await boot(page);
    const daily = await page.evaluate(() => {
      const $ = (window as any).$;
      const c = $.dailyChallenge();
      return {
        stat: c.stat, need: c.n, text: c.text,
        tracked: Object.keys($.dailyRunStats()),
        xp: [1, 2, 3].map((s) => $.dailyXpFor(s)),
      };
    });
    // the challenge must target a stat the run actually tallies
    expect(daily.tracked).toContain(daily.stat);
    expect(daily.need).toBeGreaterThan(0);
    expect(daily.text).toMatch(/^[A-Z0-9 ,.:$@\/+-]+$/); // bitmap font glyph set
    expect(daily.xp).toEqual([250, 300, 400]);
  });
});
