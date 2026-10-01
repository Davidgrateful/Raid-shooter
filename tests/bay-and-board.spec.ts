import { test, expect, type Page } from '@playwright/test';
import { boot, VETERAN } from './support/harness';
import { PILOT_MOTION, motionFor } from '../src/components/three/pilotMotion';
import { PLANE_SPECS } from '../src/components/three/planeSpecs';

/*==============================================================================
THE BAY, THE ARMORY CRADLE AND THE BOARD'S PODIUM

  motion    every pilot has its own landing, idle and test-fire, and every
            landing ends exactly at rest (a plane that lands 0.1 off its pad
            would sit visibly wrong forever)
  stage     the 3D bay renders on a transparent canvas - it used to be a
            walled room on an opaque black background, which read as a black
            box pasted on the screen
  armory    on a phone the cradle stays pinned while the wall scrolls, and its
            < > step through the wall, so the next item is always one tap away
  board     the in-game Shooterboard has the 3D podium too, not only
            /leaderboard
==============================================================================*/

const AT_REST = { x: 0, y: 0, z: 0, ry: 0, rx: 0, rz: 0, s: 1, flicker: 0 };

test.describe('pilot motion', () => {
  test('every pilot has its own landing, and every landing ends at rest', () => {
    const ids = Object.keys(PLANE_SPECS);
    expect(ids.length).toBe(13);
    const signatures = new Set<string>();
    for (const id of ids) {
      expect(PILOT_MOTION[id], `${id} has no motion`).toBeTruthy();
      const m = motionFor(id);
      for (const dir of [1, -1]) {
        const end = m.land(1, dir);
        for (const k of Object.keys(AT_REST) as Array<keyof typeof AT_REST>) {
          expect(Math.abs(end[k] - AT_REST[k]), `${id} ${k} at touchdown`).toBeLessThan(1e-6);
        }
      }
      // the arrival is a real move, not a no-op
      const start = m.land(0.15, 1);
      const moved = Math.abs(start.x) + Math.abs(start.y) + Math.abs(start.z) + Math.abs(start.ry) + Math.abs(start.rx) + Math.abs(1 - start.s) + start.flicker;
      expect(moved, `${id} does not move while landing`).toBeGreaterThan(0.2);
      // a coarse fingerprint of the flight path: no two pilots land alike
      const sig = [0.1, 0.3, 0.5, 0.8].map((u) => { const p = m.land(u, 1); return [p.x, p.y, p.z, p.ry, p.rx, p.s].map((v) => v.toFixed(2)).join(','); }).join('|');
      signatures.add(sig);
      expect(m.fire.burst).toBeGreaterThan(0);
      expect(m.fire.guns.length).toBeGreaterThan(0);
    }
    expect(signatures.size).toBe(ids.length);
  });
});

async function bayReady(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-bay3d]');
    return el && el.getAttribute('data-bay3d') !== 'loading';
  }, null, { timeout: 20000 });
  return page.evaluate(() => document.querySelector('[data-bay3d]')!.getAttribute('data-bay3d'));
}

test('the 3D bay is an open stage on a transparent canvas, not a black box', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  await page.evaluate(() => (window as any).$.setState('hangar'));
  test.skip((await bayReady(page)) !== 'ready', 'no WebGL in this browser');
  const alpha = await page.evaluate(() => {
    const c = document.querySelector('[data-bay3d="ready"] canvas') as HTMLCanvasElement;
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    return gl ? gl.getContextAttributes()?.alpha : null;
  });
  expect(alpha).toBe(true);
});

test.describe('the armory cradle on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stays pinned while the wall scrolls, and its arrows step through the wall', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await page.evaluate(() => (window as any).$.setState('market'));
    await page.waitForSelector('.rs-am-slots > *', { timeout: 20000 });
    const name = async () => ((await page.locator('.rs-am-name').first().textContent()) || '').trim();

    // scroll the wall a long way: the cradle (and the item on it) stays on screen
    const pinned = await page.evaluate(async () => {
      const inspect = document.querySelector('.rs-am-inspect') as HTMLElement;
      let sc: HTMLElement | null = inspect.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (!sc) return { scrolled: 0, top: -1 };
      sc.scrollTop = sc.scrollHeight;
      await new Promise((r) => setTimeout(r, 250));
      const r = inspect.getBoundingClientRect();
      return { scrolled: sc.scrollTop, top: r.top, bottom: r.bottom };
    });
    expect(pinned.scrolled).toBeGreaterThan(200);
    expect(pinned.top).toBeGreaterThanOrEqual(0);
    expect(pinned.bottom).toBeLessThan(844 * 0.4);

    // pick something far down the wall: it shows on the pinned cradle
    const slots = page.locator('.rs-am-slots > *');
    const last = slots.nth((await slots.count()) - 1);
    await last.click();
    await expect.poll(name).toBe(await last.getAttribute('title'));

    // and the cradle's own arrows move to the neighbour without touching the wall
    const before = await name();
    await page.getByRole('button', { name: 'Next item' }).click();
    await expect.poll(name).not.toBe(before);
    await page.getByRole('button', { name: 'Previous item' }).click();
    await expect.poll(name).toBe(before);
  });
});

test('the in-game Shooterboard stands its top three on the 3D podium', async ({ page }) => {
  const entries = ['VEGA', 'KITE', 'ORBIT', 'SABLE'].map((n, i) => ({
    address: '0x' + String(i).padStart(40, 'a'), name: n, score: 90000 - i * 1000, kills: 100, pilot: 'NOVA', verified: true,
    cosmetics: { pilotId: ['nova', 'tankrex', 'onyix', 'runepilot'][i], shipColor: '#35e8ff' },
  }));
  await boot(page, { profile: VETERAN, board: { entries, total: 4, persistent: true } });
  await page.evaluate(() => (window as any).$.setState('board'));
  await expect(page.getByText('CHAMPION', { exact: true })).toBeVisible({ timeout: 15000 });
  const podium = page.locator('.rs-sb-podium3d');
  await expect(podium).toHaveCount(1);
  const vh = page.viewportSize()!.height;
  if (vh > 560) {
    const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
    if (webgl) await expect(podium.locator('canvas')).toBeVisible({ timeout: 15000 });
  } else {
    // a landscape phone keeps its first screen for the ranked cards
    await expect(podium).toBeHidden();
  }
});
