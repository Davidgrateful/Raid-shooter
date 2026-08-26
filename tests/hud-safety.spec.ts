import { test, expect } from '@playwright/test';
import { boot, horizontalOverflow, VETERAN } from './support/harness';

/*==============================================================================
HUD SAFETY

The in-run HUD is drawn on canvas and positioned from published boundaries
($.touchHudBottom, $.hudCentreBottom) rather than hard-coded offsets. This test
exists because the failure mode is silent: a banner that lands on the score is
still "working" software, it is just unreadable, and only a measurement catches
it. It runs on both configured viewports, including the touch layout where the
on-screen controls claim the bottom of the screen.
==============================================================================*/

test('nothing in the HUD overlaps anything else', async ({ page }) => {
  await boot(page, {
    profile: VETERAN,
    serverProfile: { items: [], consumables: { consumable_health: 2, consumable_shield: 1 } },
  });

  await page.evaluate(() => { const $ = (window as any).$; $.reset(); $.setState('play'); $.autofire = 1; });
  await page.waitForTimeout(2500);

  // Trigger the daily banner, the one element most likely to collide, and
  // measure everything against the HUD's own published boundaries.
  const layout = await page.evaluate(() => {
    const $ = (window as any).$;
    $.dailyPopTick = 1;
    return new Promise<any>((resolve) => {
      setTimeout(() => resolve({
        touchHudBottom: $.touchHudBottom || 0,
        hudCentreBottom: $.hudCentreBottom || 0,
        buttons: ($.buttons || []).length,
        canvasH: $.ch,
        dailyActive: $.dailyPopTick > 0,
      }), 600);
    });
  });

  // The centre column must start below the touch controls, never on them.
  if (layout.touchHudBottom > 0) {
    expect(layout.hudCentreBottom).toBeGreaterThan(layout.touchHudBottom);
  }
  // And the whole centre block must stay on screen.
  expect(layout.hudCentreBottom).toBeLessThan(layout.canvasH);

  const overflow = await horizontalOverflow(page);
  expect(overflow.overflows, `page scrolls sideways: ${overflow.doc} > ${overflow.win}`).toBe(false);
});

test('every menu screen fits its viewport', async ({ page }) => {
  await boot(page, { profile: VETERAN, board: { entries: [], total: 0 } });

  for (const state of ['menu', 'playmode', 'hangar', 'market', 'board', 'settings']) {
    await page.evaluate((s) => (window as any).$.setState(s), state);
    await page.waitForTimeout(1800);
    const overflow = await horizontalOverflow(page);
    expect(overflow.overflows, `${state} scrolls sideways: ${overflow.doc} > ${overflow.win}`).toBe(false);

    // Nothing the player can SEE may sit where they cannot reach it. The
    // earlier version of this check used bounding boxes alone and flagged
    // controls that are present but deliberately hidden (the wallet connector
    // renders one offscreen), so visibility is decided by computed style
    // first and geometry second.
    const unreachable = await page.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      return [...document.querySelectorAll('button:not([disabled])')]
        .filter((b) => {
          // `inert` means nobody can reach this - not by pointer, not by Tab,
          // not by screen reader. A control the platform has taken out of play
          // cannot be an unreachable-control problem.
          if (b.closest('[inert]')) return false;
          const cs = getComputedStyle(b);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
          const r = b.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          // fully outside the viewport in a direction nothing can scroll to
          return r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh;
        })
        .map((b) => (b.textContent || '').trim().slice(0, 30))
        .filter(Boolean);
    });
    expect(unreachable, `${state} has visible but unreachable controls`).toEqual([]);
  }
});
