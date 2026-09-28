import { test, expect, type Browser, type Page } from '@playwright/test';

/*==============================================================================
LAYOUT FIT - the primary action is on screen, everywhere

Prompted by a player's video: iPhone, landscape, browser bar showing - about
844x340 of usable screen. On pre-flight, LAUNCH RAID was cut off at the bottom
and Daily Run was entirely off-screen, while the space under the hull sat empty
and a quarter of the width was a blank column reserved for panels the screen
does not have. Measuring every screen at fourteen sizes found the same fault in
more places: the deck's DEPLOY and the hangar's deploy on landscape phones,
LAUNCH RAID under the tab bar on iPad landscape, and below the fold at
1280x720 and 1366x768 - the two most common laptop screens.

These tests open their own contexts per viewport (like hud-matrix), so they run
in that project rather than once per viewport project.
==============================================================================*/

const VETERAN = {
  mute: 1, autofire: 1, score: 41250, pilotname: 'ONYX', ship: 1, character: 0, trail: 'trail_ion',
  drone: 'drone_voltmite', pilotxp: { onyix: 4200 }, controls: 'hybrid', music: 0, seen: 1, guideseen: 1, rounds: 63,
};

async function deck(browser: Browser, w: number, h: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000 });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('starterBundlePace', JSON.stringify({
    day: new Date().toISOString().slice(0, 10), showsToday: 99, needPlays: 99, playsSinceShown: 0 })));
  await page.addInitScript((p) => localStorage.setItem('radiusraid', JSON.stringify(p)), VETERAN);
  await page.route('**/api/profile*', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [], consumables: { consumable_health: 2 } }) }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).$?.state === 'menu', null, { timeout: 60_000 });
  await page.waitForTimeout(1800);
  for (let i = 0; i < 3; i++) {
    const s = page.locator('div[data-game-ui].bg-black\\/70').first();
    if (!(await s.isVisible().catch(() => false))) break;
    await s.click({ position: { x: 8, y: 8 } }); await page.waitForTimeout(300);
  }
  return page;
}
const to = async (page: Page, state: string) => { await page.evaluate((s) => (window as any).$.setState(s), state); await page.waitForTimeout(1500); };

/** On screen, and actually the thing a tap at its centre would hit. */
async function reachable(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((e) => {
    const b = e.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, Math.min(b.top + b.height / 2, innerHeight - 1));
    return { onScreen: b.top >= 0 && b.bottom <= innerHeight + 0.5, hit: !!top && (e === top || e.contains(top)), bottom: Math.round(b.bottom) };
  });
}

const SIZES: Array<[number, number, string]> = [
  [844, 340, 'iPhone landscape, browser bar (the video)'], [844, 390, 'iPhone landscape'], [667, 300, 'SE landscape, browser bar'],
  [932, 430, 'Pro Max landscape'], [390, 844, 'iPhone portrait'], [768, 1024, 'iPad portrait'],
  [1024, 768, 'iPad landscape'], [1280, 720, 'laptop 720p'], [1366, 768, 'laptop 768'], [1440, 900, 'desktop'],
];
const PRIMARY: Array<[string, string, string]> = [
  ['menu', '.rs-cta', 'DEPLOY'],
  ['playmode', '.rs-lx-launch', 'LAUNCH RAID'],
  ['hangar', 'button:has-text("Deploy this hull")', 'the hangar deploy'],
];

for (const [w, h, name] of SIZES) {
  test(`every screen's primary action is reachable without scrolling - ${name} ${w}x${h}`, async ({ browser }) => {
    const page = await deck(browser, w, h);
    for (const [state, sel, label] of PRIMARY) {
      if (state !== 'menu') await to(page, state);
      const r = await reachable(page, sel);
      expect(r.onScreen, `${label} is below the fold at ${w}x${h} (bottom ${r.bottom}/${h})`).toBe(true);
      expect(r.hit, `${label} is covered by something else at ${w}x${h}`).toBe(true);
    }
    await page.context().close();
  });
}

test('pre-flight shows the daily run too, not just a clipped launch - at the video size', async ({ browser }) => {
  const page = await deck(browser, 844, 340);
  await to(page, 'playmode');
  const r = await reachable(page, '.rs-lx-daily');
  expect(r.onScreen, 'Daily Run was off-screen at 844x340').toBe(true);
  await page.context().close();
});

for (const [w, h] of [[844, 340], [1280, 720]] as Array<[number, number]>) {
  test(`pre-flight uses the full width - no blank reserved column at ${w}x${h}`, async ({ browser }) => {
    const page = await deck(browser, w, h);
    await to(page, 'playmode');
    const right = await page.locator('.rs-lx-main').evaluate((e) => e.getBoundingClientRect().right);
    expect(right, `pre-flight's content area stops ${Math.round(w - right)}px short of the edge`).toBeGreaterThan(w - 24);
    await page.context().close();
  });
}

test('the rail fits whole at the video size, on every screen that has it', async ({ browser }) => {
  const page = await deck(browser, 844, 340);
  for (const state of ['menu', 'playmode', 'hangar', 'market']) {
    if (state !== 'menu') await to(page, state);
    const hidden = await page.evaluate(() => {
      const rail = document.querySelector('.rs-cc-rail'); if (!rail) return ['no rail'];
      const rb = rail.getBoundingClientRect();
      return [...rail.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().bottom > rb.bottom + 1)
        .map((b) => b.getAttribute('aria-label') || (b.textContent || '').trim());
    });
    expect(hidden, `rail controls below the fold on ${state}`).toEqual([]);
  }
  await page.context().close();
});

test('collapsed rail utilities have a name a screen reader can announce', async ({ browser }) => {
  // hiding the text label with display:none also removed it from the
  // accessibility tree - these were announced as a bare glyph
  const page = await deck(browser, 844, 390);
  await expect(page.getByRole('button', { name: 'Invite a wingman' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeVisible();
  await page.context().close();
});

test('the deck loadout badges do not sit on the hull on a short screen', async ({ browser }) => {
  const page = await deck(browser, 844, 340);
  const clash = await page.evaluate(() => {
    const ship = document.querySelector('.rs-cc-ship canvas') || document.querySelector('.rs-cc-ship');
    const badges = document.querySelector('.rs-bay-loadout');
    if (!ship || !badges || getComputedStyle(badges).display === 'none') return 0;
    const a = ship.getBoundingClientRect(), b = badges.getBoundingClientRect();
    const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return ix * iy;
  });
  expect(clash, 'loadout badges overlap the ship').toBe(0);
  await page.context().close();
});

test('an empty board still explains itself on a short screen', async ({ browser }) => {
  // Weekly and Daily start empty after every reset; the line saying so used to
  // sit behind the footer's Back button at this height
  const page = await deck(browser, 667, 300);
  await page.route('**/api/leaderboard*', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ entries: [], total: 0, persistent: true }) }));
  await to(page, 'board');
  const empty = page.locator('.rs-board-empty').first();
  await expect(empty).toBeVisible();
  const r = await reachable(page, '.rs-board-empty');
  expect(r.hit, 'the empty-board explanation is hidden behind the footer').toBe(true);
  await page.context().close();
});
