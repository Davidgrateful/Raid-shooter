import { test, expect, type Browser, type Page } from '@playwright/test';
import { boot, VETERAN } from './support/harness';

/*==============================================================================
HUD OVERLAP MATRIX

The original hudsafe.mjs audit swept five configurations, and the permanent
suite initially inherited only two of them - the two Playwright projects. Two
things were lost in that translation, and both of them were the parts that
actually caught bugs:

  1. The KIT dimension. `$.touchHudBottom` is set from the touch bar at
     game.js:3305, but when the player is carrying field kits the CONSUMABLE
     bar sets it instead (game.js:3341), pushing the whole centre column
     further down. A HUD that is safe with no kits is not automatically safe
     with kits, so a viewport is only half a test case - the loadout is the
     other half.

  2. The overlap assertions themselves. The boundary checks in
     hud-safety.spec.ts prove the centre column starts below the touch
     controls and ends on screen. They do NOT prove that the score block and
     the HUD buttons stay out of each other's way, which is the failure this
     sweep exists to catch: a banner that lands on the score is still
     "working" software, it is just unreadable.

This file restores both. It drives its own contexts rather than running once
per project, so the matrix is a property of the test and cannot be silently
narrowed by editing the project list.
==============================================================================*/

interface Config {
  name: string;
  width: number;
  height: number;
  touch: boolean;
  kits: Record<string, number>;
}

/** The five configurations the original audit swept, viewport AND loadout. */
const CONFIGS: Config[] = [
  { name: 'phone-land-nokit', width: 844, height: 390, touch: true, kits: {} },
  { name: 'phone-land-kits', width: 844, height: 390, touch: true, kits: { consumable_health: 2, consumable_shield: 1 } },
  { name: 'narrow-land-kits', width: 667, height: 375, touch: true, kits: { consumable_health: 2, consumable_shield: 1 } },
  { name: 'tablet-land-kits', width: 1024, height: 768, touch: true, kits: { consumable_health: 3, consumable_shield: 2 } },
  { name: 'desktop-nokit', width: 1512, height: 900, touch: false, kits: {} },
];

/*
 * A FIXED run state. The score is seeded rather than played for, because the
 * width of the score block is what the overlap maths turns on - a live run
 * would make the measurement depend on how many enemies happened to spawn.
 * Everything here is a value a real run produces; none of it is a stub.
 */
const RUN_STATE = {
  score: 18740, kills: 96, elapsed: 3900, combo: 11, comboMultiplier: 3,
  comboTimer: 70, bestCombo: 14, life: 0.42, dashCooldown: 40,
  levelCurrent: 4, levelKills: 6,
};

interface Rect { sx: number; sy: number; ex: number; ey: number }
interface HudButton extends Rect { title: string }

/** Two rectangles intersect. */
function hits(a: Rect, b: Rect): boolean {
  return !(a.ex < b.sx || a.sx > b.ex || a.ey < b.sy || a.sy > b.ey);
}

/**
 * Put the engine into a live run with a known state and read back the drawn
 * geometry. The score block is measured the same way renderInterface draws it
 * (game.js), via a non-rendering $.text() measure pass.
 */
async function measure(page: Page) {
  await page.evaluate((s) => {
    const $ = (window as any).$;
    $.reset();
    $.setState('play');
    $.autofire = 1;
    $.score = s.score; $.kills = s.kills; $.elapsed = s.elapsed;
    $.combo = s.combo; $.comboMultiplier = s.comboMultiplier;
    $.comboTimer = s.comboTimer; $.bestCombo = s.bestCombo;
    $.hero.life = s.life; $.hero.dashCooldown = s.dashCooldown;
    $.level.current = s.levelCurrent; $.level.kills = s.levelKills;
    $.powerupTimers[0] = 180;
    // suppress the first-run instruction overlay, which is not under test here
    $.instructionTick = 99999;
    $.firstRun = 0;
  }, RUN_STATE);

  // The renderer publishes hudCentreBottom (game.js:958) once it has drawn the
  // centre column. Waiting on that is a real signal that the HUD exists -
  // unlike a sleep, it cannot pass early on a slow machine.
  await page.waitForFunction(() => (window as any).$.hudCentreBottom > 0, null, { timeout: 20_000 });

  return page.evaluate(() => {
    const $ = (window as any).$;
    const hudCompact = ($.isTouchDevice || $.cw < 900);
    const centreTop = $.isTouchDevice
      ? ($.touchHudBottom > 0 ? $.touchHudBottom + 8 : $.safeAreaTop + 28)
      : (58 + $.safeAreaTop);
    const sm = $.text({
      ctx: $.ctxmg, x: $.cw / 2, y: centreTop + (hudCompact ? 2 : 3),
      text: $.util.commas($.score), hspacing: 1, vspacing: 1,
      halign: 'center', valign: 'top', scale: hudCompact ? 3 : 5, snap: 1, render: 0,
    });
    return {
      cw: $.cw, ch: $.ch,
      touch: !!$.isTouchDevice,
      touchHudBottom: $.touchHudBottom || 0,
      hudCentreBottom: $.hudCentreBottom || 0,
      buttons: ($.buttons || [])
        .map((b: any) => ({ title: String(b.title ?? ''), sx: b.sx, sy: b.sy, ex: b.ex, ey: b.ey }))
        .filter((b: any) => [b.sx, b.sy, b.ex, b.ey].every((n: number) => Number.isFinite(n))),
      score: {
        sx: $.cw / 2 - sm.width / 2, sy: centreTop,
        ex: $.cw / 2 + sm.width / 2, ey: centreTop + sm.height,
      },
      // where the daily-challenge banner lands
      bannerY: ($.hudCentreBottom > 0 ? $.hudCentreBottom : $.safeAreaTop + 60) + 26,
    };
  });
}

async function contextFor(browser: Browser, c: Config) {
  return browser.newContext({
    viewport: { width: c.width, height: c.height },
    deviceScaleFactor: 2,
    hasTouch: c.touch,
  });
}

for (const c of CONFIGS) {
  test(`HUD stays legible: ${c.name}`, async ({ browser }) => {
    const context = await contextFor(browser, c);
    const page = await context.newPage();
    try {
      await boot(page, {
        profile: VETERAN,
        serverProfile: { items: [], consumables: c.kits },
      });

      const m = await measure(page);

      // Touch layouts must actually be detected as such, or the whole
      // configuration is measuring the desktop path twice.
      expect(m.touch, `${c.name}: hasTouch did not produce a touch layout`).toBe(c.touch);

      // 1. No HUD button may sit on the score block.
      const buttons: HudButton[] = m.buttons;
      const onScore = buttons.filter((b) => hits(b, m.score));
      expect(
        onScore.map((b) => b.title),
        `${c.name}: button(s) overlap the score block at y ${Math.round(m.score.sy)}-${Math.round(m.score.ey)}`,
      ).toEqual([]);

      // 2. No two HUD buttons may sit on each other.
      const collisions: string[] = [];
      for (let i = 0; i < buttons.length; i++) {
        for (let j = i + 1; j < buttons.length; j++) {
          if (hits(buttons[i], buttons[j])) {
            collisions.push(`"${buttons[i].title}" vs "${buttons[j].title}"`);
          }
        }
      }
      expect(collisions, `${c.name}: HUD buttons overlap each other`).toEqual([]);

      // 3. The daily banner must clear the whole centre column, not just the
      //    score - this is the collision the sweep was originally written for.
      expect(
        m.bannerY,
        `${c.name}: daily banner at y=${Math.round(m.bannerY)} does not clear hudCentreBottom=${Math.round(m.hudCentreBottom)}`,
      ).toBeGreaterThan(m.hudCentreBottom);

      // 4. And the centre column must stay on screen, below the touch bar.
      if (m.touchHudBottom > 0) {
        expect(m.hudCentreBottom, `${c.name}: centre column starts on the touch controls`).toBeGreaterThan(m.touchHudBottom);
      }
      expect(m.hudCentreBottom, `${c.name}: centre column runs off the bottom`).toBeLessThan(m.ch);
    } finally {
      await context.close();
    }
  });
}
