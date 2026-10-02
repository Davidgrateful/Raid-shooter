import { test, expect, type Page } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
THE DRONES IN FLIGHT

Each of the six drones is a 3D model (src/components/three/droneModels.ts):
live in the hangar and Armory, baked into a sprite sheet for the raid. In a
raid each one flies its own way, shows its effect working, and answers every
5th kill of a combo with its own move (public/game/drones.js).

  - every drone bakes, and a raid draws the equipped one from its sheet
  - the six fly six different ways
  - the effects and combo moves are drawing only: no Math.random, no score,
    no hull, no enemy touched
  - 3D off: the flat drawing, and three.js is never downloaded
  - getting one plays its arrival (crate in the Armory, drop-in in the hangar)

Desktop project only (it sets up its own runs).
==============================================================================*/

const DRONES = ['drone_aegis', 'drone_voltmite', 'drone_needlefinch', 'drone_gravbeetle', 'drone_medicwisp', 'drone_champion'];

// a pilot who owns all six (the Crest is a cup prize, granted the same way)
const OWNS_ALL = { items: DRONES, consumables: {} };

test('every drone bakes, and a raid draws the equipped one from its sheet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page, { profile: VETERAN, serverProfile: OWNS_ALL });
  // the bake only takes idle time: wait on a quiet screen
  await page.evaluate(() => (window as any).$.setState('stats'));
  await page.waitForFunction((ids) => {
    const s = (window as any).$.objectSprites;
    return !!s && ids.every((id: string) => s.kinds.includes(id));
  }, DRONES, { timeout: 120000 });
  // the equipped drone (VETERAN flies the Volt Mite) is baked before the rocks
  const order = await page.evaluate(() => (window as any).$.objectSprites.kinds.slice());
  expect(order[0]).toBe('drone_voltmite');

  await startRun(page, 1000);
  const drawn = await page.evaluate(async (ids) => {
    const $ = (window as any).$;
    $.instructionTick = 99999;
    const seen: string[] = [];
    const real = $.objectSprites.draw;
    $.objectSprites.draw = (ctx: unknown, o: { kind: string }) => { const ok = real(ctx, o); if (ok && o.kind.startsWith('drone_')) seen.push(o.kind); return ok; };
    for (const id of ids) {
      $.storage.drone = id;
      await new Promise((r) => setTimeout(r, 250));
    }
    $.objectSprites.draw = real;
    return [...new Set(seen)].sort();
  }, DRONES);
  expect(drawn).toEqual([...DRONES].sort());
  expect(errors).toEqual([]);
});

test('six drones, six ways of flying', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, serverProfile: OWNS_ALL });
  await startRun(page, 500);
  const paths = await page.evaluate((ids) => {
    const $ = (window as any).$;
    const h = $.hero;
    const out: Record<string, { mean: number; spread: number; ahead: number; right: number }> = {};
    for (const id of ids) {
      $.storage.drone = id;
      $.droneRig = null;
      // a fixed ship, facing right, at 60fps
      $.dt = 1;
      const d: number[] = [];
      let ahead = 0, right = 0;
      for (let f = 0; f < 600; f++) {
        h.x = 500; h.y = 400; h.direction = 0;
        $.updateDrone(h);
        if (f > 300) {
          const r = $.droneRig;
          d.push(Math.hypot(r.x - h.x, r.y - h.y));
          ahead += r.x - h.x; right += r.y - h.y;
        }
      }
      const mean = d.reduce((a, b) => a + b, 0) / d.length;
      out[id] = { mean: Math.round(mean), spread: Math.round(Math.max(...d) - Math.min(...d)), ahead: Math.round(ahead / d.length), right: Math.round(right / d.length) };
    }
    return out;
  }, DRONES);
  // Aegis orbits wide; the Mite hops (its distance keeps changing); the Finch
  // holds off the right wing, ahead; the Beetle trails behind; the Wisp sits
  // above-left; the Crest rides ahead of the nose
  expect(paths.drone_aegis.mean).toBeGreaterThan(35);
  expect(Math.abs(paths.drone_aegis.ahead)).toBeLessThan(20);
  expect(paths.drone_voltmite.spread).toBeGreaterThan(6);
  expect(paths.drone_needlefinch.right).toBeGreaterThan(20);
  expect(paths.drone_needlefinch.ahead).toBeGreaterThan(8);
  expect(paths.drone_gravbeetle.ahead).toBeLessThan(-25);
  expect(paths.drone_medicwisp.right).toBeLessThan(-15);
  expect(paths.drone_medicwisp.ahead).toBeLessThan(-10);
  expect(paths.drone_champion.ahead).toBeGreaterThan(15);
});

test('effects and combo moves are drawing only: no dice, no score, no hull', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, serverProfile: OWNS_ALL });
  await startRun(page, 500);
  const r = await page.evaluate((ids) => {
    const $ = (window as any).$;
    const h = $.hero;
    // as in a Daily Run or a duel: Math.random is the raid's dice, and any
    // roll on it here would shift the waves
    $.beginSeededRng(4242);
    const seeded = Math.random;
    let draws = 0;
    Math.random = () => { draws++; return seeded(); };
    const before = { score: $.score, life: h.life, enemies: $.enemies.length, combo: $.combo };
    const fx: Record<string, { fx: number; surge: boolean; label: string }> = {};
    try {
      for (const id of ids) {
        $.storage.drone = id;
        $.droneRig = null;
        $.updateDrone(h);
        $.droneEvent('hit', 0.5);
        $.droneEvent('chain', h.x + 40, h.y, h.x + 90, h.y + 20);
        $.droneEvent('pierce', h.x + 60, h.y, 0);
        $.droneEvent('kill', h.x + 60, h.y);
        $.droneEvent('combo', 5);
        for (let f = 0; f < 3; f++) { $.updateDrone(h); $.renderDroneUnder(h); $.renderDrone(h); }
        fx[id] = { fx: $.droneFx.length, surge: !!$.droneRig.surge, label: $.droneRig.label ? $.droneMoves[id] : '' };
        // and the whole move plays out
        for (let f = 0; f < 120; f++) { $.updateDrone(h); $.renderDroneUnder(h); $.renderDrone(h); }
      }
    } finally {
      Math.random = seeded;
      $.endSeededRng();
    }
    const after = { score: $.score, life: h.life, enemies: $.enemies.length, combo: $.combo };
    return { draws, same: JSON.stringify(before) === JSON.stringify(after), fx };
  }, DRONES);
  expect(r.draws).toBe(0);
  expect(r.same).toBe(true);
  for (const id of DRONES) {
    expect(r.fx[id].surge, id).toBe(true);
    expect(r.fx[id].label, id).toMatch(/^[A-Z ]+$/);
  }
  // each one's own effect showed (the Wisp's motes need a damaged hull; the
  // Beetle's pull is the field drawn under the ship, not a one-off)
  for (const id of ['drone_aegis', 'drone_voltmite', 'drone_needlefinch', 'drone_champion']) {
    expect(r.fx[id].fx, id).toBeGreaterThan(0);
  }
});

test('a real combo of 5 fires the move once, then rests', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, serverProfile: OWNS_ALL });
  await startRun(page, 500);
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    $.storage.drone = 'drone_voltmite';
    $.droneRig = null;
    $.updateDrone($.hero);
    $.combo = 4;
    $.registerKill(10, 10);
    const first = !!$.droneRig.surge;
    $.droneRig.surge = null;
    $.combo = 9;
    $.registerKill(10, 10);
    return { first, cooled: !$.droneRig.surge };
  });
  expect(r).toEqual({ first: true, cooled: true });
});

test('3D off: the flat drone flies, and three.js is never downloaded', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, serverProfile: OWNS_ALL });
  await startRun(page, 1500);
  const st = await page.evaluate(async () => {
    const $ = (window as any).$;
    const d = $.equippedDrone();
    let flat = 0;
    const real = d.draw;
    d.draw = function (...a: unknown[]) { flat++; return real.apply(this, a); };
    await new Promise((r) => setTimeout(r, 400));
    d.draw = real;
    return { flat: flat > 0, rig: !!$.droneRig, three: !!(window as any).__THREE__ };
  });
  expect(st).toEqual({ flat: true, rig: true, three: false });
});

async function bayReady(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-bay3d]');
    return el && el.getAttribute('data-bay3d') !== 'loading';
  }, null, { timeout: 20000 });
  return page.evaluate(() => document.querySelector('[data-bay3d]')!.getAttribute('data-bay3d'));
}

test('a drone bought in the Armory arrives by crate', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  await page.evaluate(() => (window as any).$.setState('market'));
  await page.waitForSelector('.rs-am-slots > *', { timeout: 20000 });
  await page.getByRole('tab', { name: /Drones/ }).click();
  await page.locator('.rs-am-slots > *').filter({ hasText: 'AEGIS HALO' }).first().click();
  await expect(page.locator('.rs-am-name').first()).toHaveText(/AEGIS HALO/);
  test.skip((await bayReady(page)) !== 'ready', 'no WebGL in this browser');
  await page.waitForTimeout(500);
  const arrival = await page.evaluate(async () => {
    window.dispatchEvent(new CustomEvent('raidshooter:purchase', { detail: { itemId: 'drone_aegis', status: 'done' } }));
    const c = document.querySelector('[data-bay3d="ready"] canvas') as HTMLCanvasElement;
    await new Promise((r) => setTimeout(r, 100));
    const during = c.dataset.arrival || '';
    // a software-rendered browser runs the bay at a few frames a second
    const t0 = Date.now();
    while (c.dataset.arrival && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 100));
    return { during, after: c.dataset.arrival || '' };
  });
  expect(arrival).toEqual({ during: 'crate', after: '' });
});

test('a drone equipped in the hangar drops in beside the hull', async ({ page }) => {
  await boot(page, { profile: VETERAN, serverProfile: OWNS_ALL });
  await page.evaluate(() => (window as any).$.setState('hangar'));
  test.skip((await bayReady(page)) !== 'ready', 'no WebGL in this browser');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^GRAV BEETLE/ }).first().click();
  const seen = await page.evaluate(async () => {
    const c = document.querySelector('[data-bay3d="ready"] canvas') as HTMLCanvasElement;
    const t0 = Date.now();
    while (!c.dataset.arrival && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
    return c.dataset.arrival || '';
  });
  expect(seen).toBe('escort');
});
