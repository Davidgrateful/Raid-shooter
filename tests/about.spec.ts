import { test, expect } from '@playwright/test';
import { PILOTS, DRONES, SECTORS, BOSSES } from '../src/app/about/content';

/*==============================================================================
THE PUBLIC ABOUT PAGE

/about is the page to share when someone asks what the game is. Its names
live in src/app/about/content.ts; these check them against the engine's own
sources so a renamed pilot, a new drone or a new boss fails here instead of
going stale on the public page. Also: the page (and the other reading pages)
actually scroll - the game locks the body - and fit a phone without a
sideways scroll.
==============================================================================*/

const titles = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]);

test('every pilot, drone, sector and boss on the page matches the engine', async ({ request }) => {
  const js = async (f: string) => (await request.get(`/game/${f}`)).text();
  const [chars, bullet, drones, sectors] = await Promise.all(['characters.js', 'bullet.js', 'drones.js', 'sectors.js'].map(js));

  // pilots: id, name, ability and shot trait, in the engine's order
  const engine = [...chars.matchAll(/id: '(\w+)', ability: \{ title: '([^']+)'[^}]*\}, bulletStyle: \{ kind: '(\w+)'[^}]*\}, title: '([^']+)'/g)]
    .map((m) => ({ id: m[1], ability: m[2], kind: m[3], name: m[4] }));
  expect(engine.length).toBe(13);
  const traits = Object.fromEntries([...bullet.matchAll(/^\t(\w+): \{ title: '([^']+)'/gm)].map((m) => [m[1], m[2]]));
  expect(PILOTS.map((p) => [p.id, p.name, p.ability, p.shot])).toEqual(engine.map((e) => [e.id, e.name, e.ability, traits[e.kind]]));

  // drones: every one, with its combo move
  const droneIds = titles(drones, /id: 'drone_(\w+)', title: '/g);
  const droneNames = titles(drones, /id: 'drone_\w+', title: '([^']+)'/g);
  const moves = Object.fromEntries([...drones.matchAll(/^\tdrone_(\w+): '([^']+)'/gm)].map((m) => [m[1], m[2]]));
  expect(DRONES.map((d) => d.id).sort()).toEqual([...droneIds].sort());
  for (const d of DRONES) {
    expect(d.name, d.id).toBe(droneNames[droneIds.indexOf(d.id)]);
    expect(d.combo, d.id).toBe(moves[d.id]);
  }

  // sectors in order, and every boss
  expect(SECTORS.map((x) => x.name)).toEqual(titles(sectors, /^\t\{ title: '([^']+)', hue: -?\d+, hazard:/gm));
  expect([...BOSSES].sort()).toEqual(titles(sectors, /^\t\t\{ title: '([^']+)',[^\n]*burstCount/gm).sort());
});

test('the about page shows every pilot and drone, with images that load', async ({ page }) => {
  const res = await page.goto('/about');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/About/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('RAID SHOOTER');
  await expect(page.locator('[data-pilot]')).toHaveCount(PILOTS.length);
  await expect(page.locator('[data-drone]')).toHaveCount(DRONES.length);
  await expect(page.getByText('HEAVY ROUND')).toBeVisible();
  await expect(page.getByText('NIGHT SIGHT')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play free' }).first()).toHaveAttribute('href', '/');

  // lazy images: bring each into view, then check none failed
  const imgs = page.locator('main img');
  const n = await imgs.count();
  for (let i = 0; i < n; i++) await imgs.nth(i).scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('main img')].filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0).map((i) => (i as HTMLImageElement).src))).toEqual([]);
});

for (const path of ['/about', '/terms', '/privacy']) {
  test(`${path} scrolls to its end`, async ({ page }) => {
    await page.goto(path);
    const scroller = page.locator('main.rs-doc-page');
    const grown = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight + 50);
    expect(grown).toBe(true);
    await page.locator('footer, main p').last().scrollIntoViewIfNeeded();
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
  });
}

test('the about page fits a phone without a sideways scroll', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 } });
  const page = await ctx.newPage();
  await page.goto('/about');
  const over = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    return { main: main.scrollWidth - main.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth };
  });
  expect(over.main).toBeLessThanOrEqual(0);
  expect(over.doc).toBeLessThanOrEqual(0);
  await ctx.close();
});
