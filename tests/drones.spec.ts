import { test, expect, type Page } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
THE DRONES IN FLIGHT

Each of the twelve drones is a 3D model (src/components/three/droneModels.ts):
live in the hangar and Armory, baked into a sprite sheet for the raid. In a
raid each one flies its own way, shows its effect working, and answers every
5th kill of a combo with its own move (public/game/drones.js).

  - every drone bakes, and a raid draws the equipped one from its sheet
  - each flies its own way
  - the newer six's abilities (chill, magnet, burn, block, decoy) do what
    the Armory says, on frame counters - no dice
  - the effects and combo moves are drawing only: no Math.random, no score,
    no hull, no enemy touched
  - 3D off: the flat drawing, and three.js is never downloaded
  - getting one plays its arrival (crate in the Armory, drop-in in the hangar)

Desktop project only (it sets up its own runs).
==============================================================================*/

const DRONES = [
  'drone_aegis', 'drone_voltmite', 'drone_needlefinch', 'drone_gravbeetle', 'drone_medicwisp', 'drone_champion',
  'drone_frostsprite', 'drone_salvagecrab', 'drone_embermoth', 'drone_mirrorbat', 'drone_decoygecko', 'drone_scoutowl',
];

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
    // each one until it has been drawn (a slow box can go a while between frames)
    for (const id of ids) {
      $.storage.drone = id;
      const t0 = Date.now();
      while (!seen.includes(id) && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 50));
    }
    $.objectSprites.draw = real;
    return [...new Set(seen)].sort();
  }, DRONES);
  expect(drawn).toEqual([...DRONES].sort());
  expect(errors).toEqual([]);
});

test('every drone flies its own way', async ({ page }) => {
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
  // Frost drifts over the canopy; the Crab and Moth stay behind; the Bat
  // hangs back off the left wing; the Gecko clings close to it; the Owl
  // rides well ahead
  expect(paths.drone_frostsprite.right).toBeLessThan(-15);
  expect(paths.drone_salvagecrab.ahead).toBeLessThan(-8);
  expect(paths.drone_embermoth.ahead).toBeLessThan(-15);
  expect(paths.drone_mirrorbat.ahead).toBeLessThan(-8);
  expect(paths.drone_mirrorbat.right).toBeLessThan(-10);
  expect(paths.drone_decoygecko.mean).toBeLessThan(20);
  expect(paths.drone_decoygecko.right).toBeLessThan(-10);
  expect(paths.drone_scoutowl.ahead).toBeGreaterThan(30);
});

test('the newer six do what the Armory says, and roll no dice', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, serverProfile: OWNS_ALL });
  await startRun(page, 500);
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    const h = $.hero;
    $.dt = 1;
    // a Daily Run's dice: nothing below may draw on them
    $.beginSeededRng(777);
    const seeded = Math.random;
    let draws = 0;
    Math.random = () => { draws++; return seeded(); };
    const out: Record<string, unknown> = {};
    try {
      // FROST SPRITE: a hit chills for 1s: 15 PCT slower, bosses 5 PCT
      $.storage.drone = 'drone_frostsprite';
      const e: any = { x: 0, y: 0 }, boss: any = { isBoss: 1 };
      $.droneOnHit(e, 1); $.droneOnHit(boss, 1);
      const slow = [$.droneChill(e), $.droneChill(boss)];
      for (let f = 0; f < 70; f++) $.droneChill(e);
      out.frost = { slow, after: $.droneChill(e) };

      // EMBER MOTH: 20 PCT of the hit again, over 1.5s, then it is out
      $.storage.drone = 'drone_embermoth';
      let burnt = 0;
      const b: any = { receiveDamage: (_i: number, a: number) => { burnt += a; } };
      $.droneOnHit(b, 10);
      let frames = 0;
      while (b.burn && frames < 200) { $.droneBurnTick(b, -1); frames++; }
      out.ember = { burnt: Math.round(burnt * 1000) / 1000, frames };

      // SALVAGE CRAB: a power-up within 120px drifts in; one beyond it does not
      $.storage.drone = 'drone_salvagecrab';
      const near: any = { x: h.x + 80, y: h.y - 6, width: 20, height: 12 };
      const far: any = { x: h.x + 200, y: h.y - 6, width: 20, height: 12 };
      const d0 = near.x;
      for (let f = 0; f < 5; f++) { $.droneMagnet(near); $.droneMagnet(far); }
      out.crab = { pulledIn: d0 - near.x, farMoved: far.x !== h.x + 200 };

      // MIRROR BAT: one bolt, then nothing for 8s, then one again
      $.storage.drone = 'drone_mirrorbat';
      $.droneAbilityState = null;
      const bolt = { x: h.x, y: h.y };
      const first = $.droneBlock(h, bolt), second = $.droneBlock(h, bolt);
      for (let f = 0; f < 479; f++) $.updateDroneAbilities(h);
      const early = $.droneBlock(h, bolt);
      $.updateDroneAbilities(h);
      out.bat = { first, second, early, recharged: $.droneBlock(h, bolt) };

      // DECOY GECKO: 6s in, a 2s hologram; nearby enemies chase it, bosses never
      $.storage.drone = 'drone_decoygecko';
      $.droneAbilityState = null;
      for (let f = 0; f < 359; f++) $.updateDroneAbilities(h);
      const before = !!$.droneAbilityState.decoy;
      $.updateDroneAbilities(h);
      const dc = $.droneAbilityState.decoy;
      const lured = !!$.droneLure({ x: dc.x + 50, y: dc.y });
      const bossLured = !!$.droneLure({ x: dc.x + 50, y: dc.y, isBoss: 1 });
      const farLured = !!$.droneLure({ x: dc.x + 400, y: dc.y });
      for (let f = 0; f < 121; f++) $.updateDroneAbilities(h);
      out.gecko = { before, after: !!dc, lured, bossLured, farLured, gone: !$.droneAbilityState.decoy };
    } finally {
      Math.random = seeded;
      $.endSeededRng();
    }
    out.draws = draws;
    return out;
  });
  expect(r.frost).toEqual({ slow: [0.85, 0.95], after: 1 });
  expect(r.ember).toEqual({ burnt: 2, frames: 90 });
  expect((r.crab as any).pulledIn).toBeGreaterThan(20);
  expect((r.crab as any).farMoved).toBe(false);
  expect(r.bat).toEqual({ first: true, second: false, early: false, recharged: true });
  expect(r.gecko).toEqual({ before: false, after: true, lured: true, bossLured: false, farLured: false, gone: true });
  expect(r.draws).toBe(0);
});

test('a Mirror Bat really stops a bolt in a raid, then the next one lands', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0, drone: 'drone_mirrorbat' }, serverProfile: OWNS_ALL });
  await startRun(page, 800);
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    const h = $.hero;
    $.enemies.length = 0;
    $.droneAbilityState = null;
    const bolt = () => new $.Enemy({ shape: 'shard', isBolt: 1, value: 5, speed: 0, life: 1, radius: 5, hue: 320, x: h.x, y: h.y, type: 0, direction: 0, behavior() {} });
    $.enemies.push(bolt());
    $.enemies[0].inView = 1;
    h.dashTick = 0; $.powerupTimers[5] = 0;
    const life0 = h.life;
    h.update();
    const blocked = { gone: $.enemies.length === 0, life: h.life === life0 };
    $.enemies.push(bolt());
    $.enemies[0].inView = 1;
    h.update();
    return { blocked, landed: h.life < life0 };
  });
  expect(r).toEqual({ blocked: { gone: true, life: true }, landed: true });
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
    // a fixed 60fps step, whatever this machine's frame rate
    $.dt = 1;
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
    const arrival = c.dataset.arrival || '';
    // then pilot and drone link up: formation, a beam, a burst
    // (a software-rendered browser runs the bay at a few frames a second)
    while (!c.dataset.link && Date.now() - t0 < 40000) await new Promise((r) => setTimeout(r, 50));
    return { arrival, linked: c.dataset.link === '1' };
  });
  expect(seen).toEqual({ arrival: 'escort', linked: true });
});

test('every pilot + drone pair has its own combo move, and rolls no raid dice', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 }, serverProfile: OWNS_ALL });
  await startRun(page, 500);
  const r = await page.evaluate((ids) => {
    const $ = (window as any).$;
    const h = $.hero;
    const keep = { ctx: $.ctxmg, x: h.x, y: h.y, dir: h.direction, ch: h.character, drone: $.storage.drone, reduce: $.reduceMotion };
    const c = document.createElement('canvas');
    c.width = c.height = 300;
    const ctx = c.getContext('2d')!;
    $.ctxmg = ctx;
    $.reduceMotion = false;
    h.x = 150; h.y = 150; h.direction = 0;
    $.beginSeededRng(31337);
    const seeded = Math.random;
    let draws = 0;
    Math.random = () => { draws++; return seeded(); };
    const hashes = new Set<string>();
    const missing: string[] = [];
    let pairs = 0;
    try {
      for (const pilot of $.definitions.characters) {
        if (!$.pilotSync[pilot.id]) missing.push(pilot.id);
        h.character = pilot;
        for (const id of ids) {
          $.storage.drone = id;
          $.droneRig = null;
          $.updateDrone(h);
          $.droneRig.surge = { t: 0.55, life: 1.5 };
          $.droneRig.label = { t: 0.2, life: 1.4 };
          ctx.clearRect(0, 0, 300, 300);
          $.renderDroneUnder(h);
          $.renderDrone(h);
          const px = ctx.getImageData(0, 0, 300, 300).data;
          let a = 0, b = 0;
          for (let i = 0; i < px.length; i += 4) { a = (a * 31 + px[i] + px[i + 1] * 3 + px[i + 2] * 7) >>> 0; b += px[i + 3]; }
          hashes.add(a + ':' + b);
          pairs++;
        }
      }
    } finally {
      Math.random = seeded;
      $.endSeededRng();
      $.ctxmg = keep.ctx; h.x = keep.x; h.y = keep.y; h.direction = keep.dir; h.character = keep.ch;
      $.storage.drone = keep.drone; $.reduceMotion = keep.reduce; $.droneRig = null;
    }
    return { pairs, distinct: hashes.size, missing, draws };
  }, DRONES);
  // 13 pilots x 12 drones, every combo frame different
  expect(r.missing).toEqual([]);
  expect(r.pairs).toBe(156);
  expect(r.distinct).toBe(156);
  expect(r.draws).toBe(0);
});
