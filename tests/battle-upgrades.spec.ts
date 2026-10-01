import { test, expect, type Page, type Route } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
BATTLE UPGRADES

  art        every pilot flies an airframe, every enemy has fleet art, all six
             bosses are drawn by the new art - none of them throws
  sectors    seven sectors; each hazard runs and draws; entering one warps,
             switches the music theme and repaints the far landmark
  banking    the plane rolls toward the side it slips to
  wrecks     a derelict hull stops bullets, enemy fire and the plane
  dice       cosmetic effects never advance a seeded raid's dice
  pilots     a bought pilot survives a boot that renders before the profile
  3D         the bays go 3D where WebGL runs, fall back where it doesn't, and
             stay off when the player switches 3D graphics off
  DUELS      the deck panel creates and flies a duel; a duel run posts to its
             duel and nowhere else
==============================================================================*/

const json = (body: unknown) => (r: Route) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('the art', () => {
  test('every pilot, enemy and boss draws without throwing', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    const out = await page.evaluate(() => {
      const $ = (window as any).$;
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d')!;
      const fails: string[] = [];
      for (const ch of $.definitions.characters) {
        if (typeof $.planeDraws[ch.id] !== 'function') fails.push(`no airframe for ${ch.id}`);
        try { ctx.save(); ctx.translate(128, 128); ch.draw(ctx, 12, 'hsl(190, 100%, 60%)', 10); ctx.restore(); } catch (e) { fails.push(`${ch.id}: ${e}`); }
        try { ctx.save(); ctx.translate(128, 128); $.drawBanked(ctx, ch.draw, 12, '#fff', 10, 0.8); ctx.restore(); } catch (e) { fails.push(`banked ${ch.id}: ${e}`); }
      }
      const shapes = ['shuttle', 'slant', 'chevron', 'block', 'tumbler', 'comet', 'wasp', 'sliver', 'heavy', 'bloom', 'dartlet', 'star', 'turret', 'crescent', 'hive', 'fort', 'shard', 'phantom', 'weaver', 'warden'];
      for (const s of shapes) {
        try { ctx.save(); ctx.translate(128, 128); $.enemyShapes[s](ctx, 20, 'hsla(0,100%,50%,0.1)', 'hsla(0,100%,50%,1)', 10, { hue: 0, saturation: 100 }); ctx.restore(); } catch (e) { fails.push(`${s}: ${e}`); }
      }
      const bosses = ['ASTEROID KING', 'VOID TYRANT', 'SOLAR WARDEN', 'PLASMA MEDUSA', 'HIVE QUEEN', 'XENO MONARCH'];
      for (const title of bosses) {
        if (!$.bossArt[title]) fails.push(`no boss art for ${title}`);
        for (let phase = 0; phase <= 3; phase++) {
          try { ctx.save(); ctx.translate(128, 128); $.enemyShapes.boss(ctx, 90, 'x', 'y', 30, { variant: { title }, hue: 30, saturation: 50, phase, x: 0, y: 0, vx: 1, vy: 0 }); ctx.restore(); } catch (e) { fails.push(`${title} phase ${phase}: ${e}`); }
        }
      }
      return fails;
    });
    expect(out).toEqual([]);
  });

  test('a live boss is drawn by the boss art, not the plain orb', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await startRun(page, 600);
    const shape = await page.evaluate(() => { const $ = (window as any).$; $.spawnBoss(); return $.boss.shape; });
    expect(shape).toBe('boss');
  });
});

test.describe('the sectors', () => {
  test('seven sectors, and every hazard runs and draws for a while without throwing', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await startRun(page, 500);
    const result = await page.evaluate(() => {
      const $ = (window as any).$;
      const errors: string[] = [];
      for (let k = 0; k < $.definitions.sectors.length; k++) {
        $.level.current = k * 5;
        $.updateSector();
        for (let f = 0; f < 240; f++) {
          try { $.updateHazards(); $.renderHazards(); } catch (e) { errors.push(`${$.sector.title}: ${e}`); break; }
        }
      }
      return { count: $.definitions.sectors.length, hazards: $.definitions.sectors.map((s: any) => s.hazard), errors };
    });
    expect(result.errors).toEqual([]);
    expect(result.count).toBe(7);
    expect(result.hazards.slice(4)).toEqual(['ion', 'wrecks', 'pulsar']);
  });

  test('entering a sector warps, switches the music theme and queues the landmark', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await startRun(page, 500);
    const r = await page.evaluate(() => {
      const $ = (window as any).$;
      $.level.current = 20; // ION NEBULA
      $.updateSector();
      return { title: $.sector.title, warp: $.warpFx.t > 0, theme: $.music.pendingTheme >= 0 ? $.music.pendingTheme : $.music.theme, dirty: $.sectorBackdropDirty };
    });
    expect(r).toEqual({ title: 'ION NEBULA', warp: true, theme: 4, dirty: 1 });
    // the backdrop swaps once the warp reaches its flash, out of sight
    await page.waitForFunction(() => (window as any).$.backdropSector === 'ion', null, { timeout: 5000 });
  });

  test('a wreck stops bullets and enemy fire, and the plane slides off it', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await startRun(page, 500);
    const r = await page.evaluate(() => {
      const $ = (window as any).$;
      $.level.current = 25; $.updateSector(); // WRECK FIELD
      $.updateHazards();
      const w = $.wrecks[0];
      w.vx = w.vy = w.vr = 0;
      $.bullets.length = 0;
      $.bullets.push({ x: w.x, y: w.y });
      const bolt = { isBolt: 1, radius: 6, x: w.x, y: w.y };
      $.enemies.push(bolt);
      $.hero.x = w.x; $.hero.y = w.y;
      $.updateWrecks();
      const local = (x: number, y: number) => { const dx = x - w.x, dy = y - w.y, c = Math.cos(-w.rot), s = Math.sin(-w.rot); return { x: dx * c - dy * s, y: dx * s + dy * c }; };
      const p = local($.hero.x, $.hero.y);
      return { bullets: $.bullets.length, boltGone: $.enemies.indexOf(bolt) === -1, heroOut: Math.abs(p.x) >= w.hw || Math.abs(p.y) >= w.hh };
    });
    expect(r).toEqual({ bullets: 0, boltGone: true, heroOut: true });
  });
});

test('the plane banks toward the side it slips to, and the hitbox does not change', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  await startRun(page, 500);
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    const h = $.hero;
    const radius = h.radius;
    const slip = (vy: number) => {
      h.bank = 0; h.direction = 0; h.lastBankDir = 0;
      for (let i = 0; i < 30; i++) { h.vx = 0; h.vy = vy; $.dt = 1; $.heroBank(h); }
      return h.bank;
    };
    return { right: slip(5), left: slip(-5), radius: h.radius === radius };
  });
  expect(r.right).toBeGreaterThan(0.3);
  expect(r.left).toBeLessThan(-0.3);
  expect(r.radius).toBe(true);
});

test('cosmetic effects never advance a seeded raid\'s dice', async ({ page }) => {
  /*
   * During a Daily Run or a duel, Math.random IS the seeded generator. Every
   * roll an explosion or a spark takes from it shifts every wave after it, so
   * two pilots on one seed drift onto different raids. Effects must roll
   * $.fxRandom instead. The proof: the seeded sequence after a burst of
   * effects is exactly the sequence without them.
   */
  await boot(page, { profile: VETERAN });
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    const sequence = (withEffects: boolean) => {
      $.beginSeededRng(12345);
      if (withEffects) {
        for (let i = 0; i < 20; i++) {
          new $.Explosion({ x: 0, y: 0, radius: 30, hue: 10, saturation: 100 });
          new $.ParticleEmitter({ x: 0, y: 0, count: 6, spawnRange: 10, friction: 0.9, minSpeed: 1, maxSpeed: 4, minDirection: 0, maxDirection: 6, hue: 10 });
          new $.TextPop({ x: 0, y: 0, value: 5, hue: 10, saturation: 100 });
        }
      }
      const out = [Math.random(), Math.random(), Math.random()];
      $.endSeededRng();
      return out;
    };
    return { plain: sequence(false), effects: sequence(true) };
  });
  expect(r.effects).toEqual(r.plain);
});

test('a bought pilot survives a boot that draws the deck before the profile arrives', async ({ page }) => {
  /*
   * Every bought pilot looks locked until /api/profile answers, and the deck
   * asks for the current pilot as soon as it renders. That used to reset the
   * saved selection to ONYIX for good - on any slow network, the purchase was
   * silently un-equipped. The profile is held back here to force that order.
   */
  await page.route('**/api/profile*', async (r) => {
    await new Promise((res) => setTimeout(res, 3500));
    await json({ items: ['pilot_nova'], consumables: {} })(r);
  });
  await boot(page, { profile: { ...VETERAN, character: 1 }, serverProfile: null });
  await page.waitForFunction(() => (window as any).$.profile.fetched === 1, null, { timeout: 15000 });
  const pilot = await page.evaluate(() => (window as any).$.currentCharacter().id);
  expect(pilot).toBe('nova');
});

test.describe('the 3D bays', () => {
  async function bayState(page: Page) {
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-bay3d]');
      return el && el.getAttribute('data-bay3d') !== 'loading';
    }, null, { timeout: 20000 });
    return page.evaluate(() => document.querySelector('[data-bay3d]')!.getAttribute('data-bay3d'));
  }

  test('the hangar bay goes 3D where WebGL runs, and keeps the flat bay where it does not', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    await page.evaluate(() => (window as any).$.setState('hangar'));
    const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
    const st = await bayState(page);
    if (webgl) {
      expect(st).toBe('ready');
      await expect(page.locator('[data-bay3d="ready"] canvas')).toBeVisible();
      expect(await page.evaluate(() => typeof (window as any).__THREE__)).toBe('string');
    } else {
      expect(st).toBe('off');
      await expect(page.locator('[data-bay3d="off"] canvas')).toBeVisible();
    }
  });

  test('3D graphics off: the flat bays, and the 3D code is never downloaded', async ({ page }) => {
    await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
    await page.evaluate(() => (window as any).$.setState('hangar'));
    expect(await bayState(page)).toBe('off');
    await page.waitForTimeout(2500);
    // three.js stamps window.__THREE__ the moment its module runs
    expect(await page.evaluate(() => (window as any).__THREE__), 'the 3D code loaded with 3D switched off').toBeUndefined();
  });
});

test.describe('DUELS on the deck', () => {
  const view = (over: Record<string, unknown> = {}) => ({
    id: 'K7Q2MX', state: 'open', expiresAt: Date.now() + 47 * 3600_000, creator: { name: 'ONYX', verified: false },
    entries: [], role: 'creator', canFly: true, seed: 424242, ...over,
  });

  test('a holder creates a duel, gets the link, and flies the seeded raid', async ({ page }) => {
    await page.route('**/api/duels?*', json({ access: 'holders', signedIn: true, canCreate: true, reason: null, minHold: 1_000_000, mine: [] }));
    await page.route('**/api/duels', (r) => (r.request().method() === 'POST' ? json({ ok: true, duel: view() })(r) : json({ access: 'holders', signedIn: true, canCreate: true, reason: null, minHold: 1_000_000, mine: [] })(r)));
    await boot(page, { profile: VETERAN });
    const panel = page.locator('.rs-panel', { has: page.locator('h2', { hasText: /^Duels$/ }) });
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole('button', { name: 'New duel' }).click();
    await expect(panel.locator('.rs-duel-code')).toHaveText('K7Q2MX');
    await expect(panel.getByRole('button', { name: /Copy link|raidshooter|127\.0\.0\.1/ })).toBeVisible();
    await panel.getByRole('button', { name: 'Fly it' }).click();
    await page.waitForFunction(() => (window as any).$.state === 'play', null, { timeout: 10000 });
    const r = await page.evaluate(() => { const $ = (window as any).$; return { duel: $.duelActive, id: $.duel && $.duel.id, seeded: Math.random !== $.__realRandom }; });
    expect(r).toEqual({ duel: 1, id: 'K7Q2MX', seeded: true });
  });

  test('a guest is told holders create first, and that anyone can accept from a link', async ({ page }) => {
    await page.route('**/api/duels?*', json({ access: 'holders', signedIn: false, canCreate: false, reason: 'sign_in', minHold: 1_000_000, mine: [] }));
    await page.route('**/api/duels', json({ access: 'holders', signedIn: false, canCreate: false, reason: 'sign_in', minHold: 1_000_000, mine: [] }));
    await boot(page, { profile: VETERAN });
    const panel = page.locator('.rs-panel', { has: page.locator('h2', { hasText: /^Duels$/ }) });
    await expect(panel).toContainText('Holders create duels first');
    await expect(panel).toContainText('1M+ $RAIDSHOOTER');
    await expect(panel).toContainText('Anyone can accept a duel from a link');
    await expect(panel.getByRole('button', { name: 'New duel' })).toHaveCount(0);
  });

  test('a duel run posts to its duel only, and the debrief says so', async ({ page }) => {
    const posts: string[] = [];
    await page.route('**/api/duels/K7Q2MX', (r) => {
      if (r.request().method() === 'POST') posts.push('duel');
      return json({ ok: true, settled: false, duel: view({ canFly: false, seed: undefined, entries: [{ name: 'ONYX', verified: false, score: 1234, pilot: 'ONYIX', level: 1, kills: 3, time: 5, mine: true, creator: true }] }) })(r);
    });
    await page.route('**/api/leaderboard', (r) => { if (r.request().method() === 'POST') posts.push('board'); return r.continue(); });
    await boot(page, { profile: VETERAN });
    await page.evaluate(() => (window as any).$.startDuelRun({ id: 'K7Q2MX', seed: 424242 }));
    await page.waitForTimeout(800);
    await page.evaluate(() => { const $ = (window as any).$; $.score = 1234; $.hero.life = 0; });
    await page.waitForFunction(() => (window as any).$.state === 'gameover', null, { timeout: 20000 });
    await expect(page.locator('.rs-ao-duel')).toContainText('YOUR RUN IS IN');
    await expect(page.locator('.rs-ao-duel').getByRole('button', { name: 'Copy duel link' })).toBeVisible();
    expect(posts).toEqual(['duel']);
    const after = await page.evaluate(() => { const $ = (window as any).$; return { active: $.duelActive, seeded: Math.random !== $.__realRandom, best: $.storage.score }; });
    expect(after).toEqual({ active: 0, seeded: false, best: VETERAN.score });
  });
});
