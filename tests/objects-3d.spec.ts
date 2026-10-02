import { test, expect } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
THE ARENA'S OBJECTS, FROM 3D MODELS

With 3D graphics on, every object kind is rendered once from a lit 3D model
into a sprite sheet after boot (src/components/three/objectSprites.ts) and the
engine draws those instead of its flat shapes. The fight is still 2D:

  - all seven kinds (and the six drones, tests/drones.spec.ts) bake, and a raid draws its objects from them
  - 3D off: flat shapes, and three.js is never downloaded
  - a bake that lands mid-raid never moves a seeded raid's dice

Desktop project only (it sets up its own runs).
==============================================================================*/

const allBaked = () => { const s = (window as any).$.objectSprites; return !!s && ['rock', 'ice', 'crystal', 'crate', 'satellite', 'fuel', 'mine'].every((k) => s.kinds.includes(k)); };

test('every kind bakes, and a raid draws its objects from the sheets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page, { profile: VETERAN });
  // the bake only takes idle time; in this software-rendered browser the
  // deck's animated 3D ship leaves almost none, so wait on a quiet screen
  await page.evaluate(() => (window as any).$.setState('stats'));
  await page.waitForFunction(allBaked, null, { timeout: 90000 });
  await startRun(page, 1000);
  const drawn = await page.evaluate(async () => {
    const $ = (window as any).$;
    $.instructionTick = 99999;
    // put objects of every kind next to the plane
    ['rock', 'ice', 'crystal', 'crate', 'satellite', 'fuel', 'mine'].forEach((k, i) => {
      $.spawnObjectAt(k, $.hero.x + 150 + (i % 4) * 90, $.hero.y - 80 + Math.floor(i / 4) * 120);
    });
    const kinds = new Set<string>();
    const real = $.objectSprites.draw;
    $.objectSprites.draw = (ctx: unknown, o: { kind: string }) => { const ok = real(ctx, o); if (ok) kinds.add(o.kind); return ok; };
    await new Promise((r) => setTimeout(r, 800));
    $.objectSprites.draw = real;
    return [...kinds].sort();
  });
  expect(drawn).toEqual(['crate', 'crystal', 'fuel', 'ice', 'mine', 'rock', 'satellite']);
  expect(errors).toEqual([]);
});

test('3D graphics off: flat objects, and the 3D code is never downloaded', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
  await startRun(page, 4000);
  const st = await page.evaluate(() => ({ sprites: !!(window as any).$.objectSprites, three: !!(window as any).__THREE__ }));
  expect(st).toEqual({ sprites: false, three: false });
});

test("3D that is asked for mid-raid waits for the raid, and never draws from its dice", async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
  const r = await page.evaluate(async () => {
    const $ = (window as any).$;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    // a quiet screen: nothing on it draws from Math.random (the deck's
    // starfield would), so every draw counted below is the 3D code's
    $.setState('stats');
    await sleep(300);
    $.beginSeededRng(4242);
    const seeded = Math.random;
    let draws = 0;
    const counting = () => { draws++; return seeded(); };
    Math.random = counting;
    // switch 3D on while the seeded stream is live
    $.storage.gfx3d = 1;
    window.dispatchEvent(new CustomEvent('raidshooter:state', { detail: 'stats' }));
    await sleep(4000);
    const during = { draws, loaded: !!$.objectSprites, still: Math.random === counting };
    $.endSeededRng();
    // the raid is over: now it loads and bakes
    const t0 = Date.now();
    while (!($.objectSprites && $.objectSprites.kinds.length === 13) && Date.now() - t0 < 90000) await sleep(200);
    return { during, baked: $.objectSprites ? $.objectSprites.kinds.length : 0 };
  });
  expect(r).toEqual({ during: { draws: 0, loaded: false, still: true }, baked: 13 });
});

test('a Daily Run asked for while three.js is loading waits for it to land', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
  const r = await page.evaluate(async () => {
    const $ = (window as any).$;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    $.setState('stats');
    $.storage.gfx3d = 1;
    window.dispatchEvent(new CustomEvent('raidshooter:state', { detail: 'stats' }));
    const t0 = Date.now();
    while (!($.threeBusy && $.threeBusy()) && Date.now() - t0 < 20000) await sleep(5);
    const busy = !!($.threeBusy && $.threeBusy());
    $.startDailyRun();
    const heldBack = !$.dailyRunActive;
    while ($.threeBusy() && Date.now() - t0 < 60000) await sleep(20);
    await sleep(100);
    return { busy, heldBack, startedAfter: !!$.dailyRunActive, state: $.state };
  });
  expect(r).toEqual({ busy: true, heldBack: true, startedAfter: true, state: 'play' });
});
