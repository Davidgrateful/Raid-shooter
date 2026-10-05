import { test, expect, type Page } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
SECTOR BOSSES, FULLER ARENAS, ACHIEVEMENTS AND THE SYSTEM SCREEN

  - each of the six newer sectors brings its own boss on its first boss wave
    of a run, then the waves draw from the shared pool as before
  - the arenas carry more objects, and the sectors built around them more again
  - achievements count and unlock from what a run does, show on the pilot
    screen's Record pane, and roll no dice
  - the System screen puts every option one tap away

Engine-level, so it runs under the desktop project only.
==============================================================================*/

const HOME: Array<[number, string]> = [
  [4, 'STORM CALLER'], [5, 'SCRAP COLOSSUS'], [6, 'PULSAR LORD'],
  [7, 'MINE LAYER'], [8, 'COMET HERALD'], [9, 'PRISM GIANT'],
];

async function enterSector(page: Page, index: number) {
  await page.evaluate((i) => {
    const $ = (window as any).$;
    $.instructionTick = 99999;
    $.level.current = i * 5;
    $.updateSector();
  }, index);
}

test.describe('sector bosses', () => {
  for (const [index, title] of HOME) {
    test(`${title} meets the pilot in its own sector, and fights without an error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await boot(page, { profile: VETERAN });
      await startRun(page, 1200);
      await enterSector(page, index);
      const first = await page.evaluate(() => {
        const $ = (window as any).$;
        $.hero.life = 1;
        $.spawnBoss();
        const b = $.boss;
        b.x = $.hero.x + 260; b.y = $.hero.y;
        return { title: b.title, home: !!b.variant.home };
      });
      expect(first).toEqual({ title, home: true });

      // let it fight through every phase: 4s at each quarter of its health,
      // the pilot kept alive so the fight runs its whole course
      for (const frac of [0.9, 0.6, 0.35, 0.15]) {
        await page.evaluate((f) => {
          const $ = (window as any).$;
          if ($.boss) $.boss.life = $.boss.lifeMax * f;
          $.hero.life = 1;
        }, frac);
        await page.waitForTimeout(1000);
      }
      expect(errors, `${title} threw while fighting`).toEqual([]);

      // the second boss wave in the same sector comes from the shared pool
      const second = await page.evaluate(() => {
        const $ = (window as any).$;
        const i = $.enemies.indexOf($.boss);
        if (i >= 0) $.enemies.splice(i, 1);
        $.boss = null;
        $.spawnBoss();
        return { title: $.boss.title, home: !!$.boss.variant.home };
      });
      expect(second.home, `${title} came back for a second wave`).toBe(false);
    });
  }
});

test('the arenas carry more objects, and the sectors built around them more again', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  await startRun(page, 1200);
  const count = async (i: number) => { await enterSector(page, i); return page.evaluate(() => (window as any).$.objects.length); };
  const deep = await count(0);
  const mines = await count(7);
  const crystals = await count(9);
  expect(deep).toBeGreaterThanOrEqual(18);
  expect(mines).toBeGreaterThan(deep);
  expect(crystals).toBeGreaterThan(deep);
});

test.describe('achievements', () => {
  test('a goal unlocks from play, banners in the run, and is listed on the Record pane', async ({ page }) => {
    await boot(page, { profile: { ...VETERAN, ach: { counts: { crates: 49 }, done: {}, seen: {} } } });
    await startRun(page, 1200);
    const unlocked = await page.evaluate(() => new Promise<string>((resolve) => {
      window.addEventListener('raidshooter:achievement', (e) => resolve(String((e as CustomEvent).detail)), { once: true });
      (window as any).$.achieve('crates', 1);
    }));
    expect(unlocked).toBe('CRATE_CRACKER');
    // a goal is only won once
    const again = await page.evaluate(() => { const $ = (window as any).$; const t = $.storage.ach.done.CRATE_CRACKER; $.achieve('crates', 10); return $.storage.ach.done.CRATE_CRACKER === t; });
    expect(again).toBe(true);

    await page.evaluate(() => (window as any).$.setState('hangar'));
    await page.waitForTimeout(1500);
    const record = page.locator('.rs-ach');
    await expect(record.locator('.rs-ach-row[data-done="1"]')).toContainText('Crate cracker', { ignoreCase: true });
    await expect(record.locator('.rs-ach-row')).toHaveCount(10);
  });

  test("counting goals never touches a seeded raid's dice", async ({ page }) => {
    await boot(page, { profile: VETERAN });
    const draws = await page.evaluate(() => {
      const $ = (window as any).$;
      const roll = (count: boolean) => {
        $.beginSeededRng(777);
        if (count) { for (let i = 0; i < 30; i++) { $.achieve('crates', 1); $.achieveOnce('sectors', 'S' + i); } }
        const r = [Math.random(), Math.random(), Math.random()];
        $.endSeededRng();
        return r;
      };
      return { plain: roll(false), counted: roll(true) };
    });
    expect(draws.counted).toEqual(draws.plain);
  });
});

test('the System screen: every option one tap away, in sections', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  await page.evaluate(() => (window as any).$.setState('settings'));
  const sys = page.locator('.rs-set');
  await expect(sys.getByRole('heading', { level: 2 })).toHaveText(['Pilot', 'Account', 'Controls', 'Sound', 'Display', 'Help'], { ignoreCase: true });
  // Account: linking a wallet and a Google / email login to one account
  await expect(sys.locator('#rs-set-account')).toContainText('Linked sign-ins');
  // desktop: the sections run down the left
  await expect(sys.getByRole('navigation', { name: 'System sections' })).toBeVisible();

  await sys.getByRole('radiogroup', { name: 'Damage numbers' }).getByRole('radio', { name: 'Off' }).click();
  expect(await page.evaluate(() => (window as any).$.storage.dmgnums)).toBe(0);
  await sys.getByRole('radiogroup', { name: 'Control scheme' }).getByRole('radio', { name: 'Keyboard' }).click();
  expect(await page.evaluate(() => (window as any).$.storage.controls)).toBe('keyboard');
  await expect(sys.getByText('Keys move and aim, hold F to fire')).toBeVisible();
  await sys.getByRole('radiogroup', { name: 'Sound level' }).getByRole('radio', { name: 'Low' }).click();
  expect(await page.evaluate(() => (window as any).$.soundLevel)).toBe(0.5);
});
