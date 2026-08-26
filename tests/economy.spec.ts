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

  test('a run resets but a career does not', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await startRun(page, 800);
    const state = await page.evaluate(() => {
      const $ = (window as any).$;
      $.score = 12345; $.kills = 40; $.comboMultiplier = 5; $.upgrades = { heavy: 3 };
      const carriedXp = $.pilotXp('onyix');
      const carriedBest = $.storage.score;
      $.reset();
      return {
        runScore: $.score,
        runCombo: $.comboMultiplier,
        heavyStacks: $.upgrades.heavy || 0,
        pilotXp: $.pilotXp('onyix'),
        best: $.storage.score,
        carriedXp, carriedBest,
      };
    });
    // run-only: gone
    expect(state.runScore).toBe(0);
    expect(state.runCombo).toBe(1);
    expect(state.heavyStacks).toBe(0);
    // permanent: untouched
    expect(state.pilotXp).toBe(state.carriedXp);
    expect(state.best).toBe(state.carriedBest);
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
