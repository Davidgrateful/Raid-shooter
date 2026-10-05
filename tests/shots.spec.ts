import { test, expect } from '@playwright/test';
import { boot, startRun, VETERAN } from './support/harness';

/*==============================================================================
PILOT SHOT TRAITS

Every pilot's bullet type does one small thing of its own in a fight
(public/game/bullet.js $.shotTraits): heavy round, tracer, knockback, seeker,
stagger, weave, twin fangs, pierce, wide beam, glitch hit, splash, ember spark,
ricochet. These check each does what the hangar says, and that none of them
rolls a seeded raid's dice.

Desktop project only (it sets up its own runs).
==============================================================================*/

test('every pilot has a shot trait of its own, shown in the hangar', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    const kinds = $.definitions.characters.map((c: any) => c.bulletStyle && c.bulletStyle.kind);
    const titles = kinds.map((k: string) => $.shotTraits[k] && $.shotTraits[k].title);
    // the bitmap font's charset, in case a trait is ever drawn in-game
    const ok = Object.values($.shotTraits).every((t: any) => /^[ $+,./0-9:@A-Z]+$/.test(t.title + t.text));
    return { missing: kinds.filter((k: string) => !$.shotTraits[k]), distinct: new Set(titles).size, n: kinds.length, ok };
  });
  expect(r.missing).toEqual([]);
  expect(r.distinct).toBe(r.n);
  expect(r.ok).toBe(true);
  await page.evaluate(() => (window as any).$.setState('hangar'));
  await expect(page.getByText('Shot', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('HEAVY ROUND')).toBeVisible();
});

test('each shot trait does what it says, and rolls no raid dice', async ({ page }) => {
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
  await startRun(page, 500);
  const r = await page.evaluate(() => {
    const $ = (window as any).$;
    $.dt = 1;
    $.beginSeededRng(2024);
    const seeded = Math.random;
    let draws = 0;
    Math.random = () => { draws++; return seeded(); };
    const realEnemies = $.enemies.slice();
    const out: Record<string, unknown> = {};
    const shot = (kind: string, extra: Record<string, unknown> = {}) => ({ x: 500, y: 500, speed: 10, direction: 0, damage: 1, size: 15, lineWidth: 2, kind, range: 540, pierceCap: 1, ...extra });
    // stand-in enemies that record the damage they take
    const fake = (x: number, y: number, extra: Record<string, unknown> = {}) => {
      const e: any = { x, y, vx: 0, vy: 0, radius: 12, taken: 0, ...extra };
      e.receiveDamage = (i: number, a: number) => { e.taken += a; if (e.dieOnHit) $.enemies.splice($.enemies.indexOf(e), 1); };
      return e;
    };
    try {
      // HEAVY ROUND: the 5th trigger pull hits 50 PCT harder
      const h = { shotNo: 4 };
      const d4 = $.shotSpec(shot('bolt'), h)[0].damage;
      h.shotNo = 5;
      const d5 = $.shotSpec(shot('bolt'), h)[0].damage;
      out.bolt = [d4, d5];
      // LONG TRACER: 15 PCT faster and farther
      const t = $.shotSpec(shot('tracer'), {})[0];
      out.tracer = [Math.round(t.speed * 100) / 100, Math.round(t.range)];
      // PIERCE: through one more enemy than it would otherwise
      const l = $.shotSpec(shot('lance'), {})[0];
      const l2 = $.shotSpec(shot('lance', { piercing: 1, pierceCap: 3 }), {})[0];
      out.lance = [l.piercing, l.pierceCap, l2.pierceCap];
      // TWIN FANGS: two parallel shots at 60 PCT
      const tw = $.shotSpec(shot('twin'), {});
      out.twin = [tw.length, tw[0].damage, tw[1].damage, Math.round(Math.abs(tw[0].y - tw[1].y))];
      // SEEKER: a dart turns toward an enemy just off its line
      $.enemies.length = 0;
      $.enemies.push(fake(600, 560));
      const dart: any = shot('dart');
      for (let f = 0; f < 10; f++) $.shotSteer(dart);
      out.dart = dart.direction > 0.2 && dart.direction < 0.6;
      // WEAVE: a glyph swings either side of its line
      const g: any = shot('glyph');
      let lo = 0, hi = 0;
      for (let f = 0; f < 40; f++) { $.shotSteer(g); lo = Math.min(lo, g.direction); hi = Math.max(hi, g.direction); }
      out.glyph = lo < -0.25 && hi > 0.25;
      // RICOCHET: off the edge once, then gone
      const n: any = shot('neon', { x: $.ww + 3, y: 300, direction: 0 });
      const first = $.shotBounce(n);
      n.x = $.ww + 3;
      out.neon = [first, Math.round(Math.cos(n.direction)), $.shotBounce(n), $.shotBounce(shot('bolt', { x: -5 }))];
      // WIDE BEAM: reaches 5px further; others none
      out.reach = [$.shotReach(shot('beam')), $.shotReach(shot('bolt'))];
      // GLITCH HIT: every 4th hit doubles
      $.hero.glitchHits = 0;
      out.glitch = [1, 2, 3, 4, 5, 6, 7, 8].map(() => $.shotDamage(shot('glitch'), 1));
      // KNOCKBACK and STAGGER: on ordinary enemies, never bosses
      const s1 = fake(500, 500), s2 = fake(500, 500, { isBoss: 1 });
      $.shotAfterHit(shot('slug'), s1, 500, 500, 1); $.shotAfterHit(shot('slug'), s2, 500, 500, 1);
      const p1 = fake(500, 500), p2 = fake(500, 500, { isBoss: 1 });
      $.shotAfterHit(shot('pulse'), p1, 500, 500, 1); $.shotAfterHit(shot('pulse'), p2, 500, 500, 1);
      out.slug = [Math.round(s1.vx * 10) / 10, s2.vx];
      out.pulse = [p1.stagger, p2.stagger || 0];
      // SPLASH: 25 PCT to enemies near the impact, not the one hit, not far ones
      $.enemies.length = 0;
      const hit = fake(500, 500), near = fake(530, 500), far = fake(700, 500);
      $.enemies.push(hit, near, far);
      $.shotAfterHit(shot('plasma'), hit, 500, 500, 2);
      out.plasma = [hit.taken, near.taken, far.taken];
      // EMBER SPARK: only a kill sparks, 35 PCT onto the nearest other enemy
      $.enemies.length = 0;
      const victim = fake(500, 500), next = fake(550, 500), away = fake(900, 500);
      $.enemies.push(next, away);
      $.shotAfterHit(shot('ember'), victim, 500, 500, 2);
      const alive = fake(500, 500); $.enemies.push(alive);
      const before = next.taken;
      $.shotAfterHit(shot('ember'), alive, 500, 500, 2);
      out.ember = [Math.round(next.taken * 100) / 100, away.taken, next.taken === before ? 'no spark while alive' : 'sparked'];
    } finally {
      $.enemies.length = 0;
      realEnemies.forEach((e: unknown) => $.enemies.push(e));
      Math.random = seeded;
      $.endSeededRng();
    }
    out.draws = draws;
    return out;
  });
  expect(r.bolt).toEqual([1, 1.5]);
  expect(r.tracer).toEqual([11.5, 621]);
  expect(r.lance).toEqual([1, 1, 4]);
  expect(r.twin).toEqual([2, 0.6, 0.6, 8]);
  expect(r.dart).toBe(true);
  expect(r.glyph).toBe(true);
  expect(r.neon).toEqual([true, -1, false, false]);
  expect(r.reach).toEqual([5, 0]);
  expect(r.glitch).toEqual([1, 1, 1, 2, 1, 1, 1, 2]);
  expect(r.slug).toEqual([2.2, 0]);
  expect(r.pulse).toEqual([10, 0]);
  expect(r.plasma).toEqual([0, 0.5, 0]);
  expect(r.ember).toEqual([0.7, 0, 'no spark while alive']);
  expect(r.draws).toBe(0);
});

test('every pilot fires its own shots in a real raid without an error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page, { profile: { ...VETERAN, gfx3d: 0 } });
  await startRun(page, 800);
  const fired = await page.evaluate(async () => {
    const $ = (window as any).$;
    const seen: Record<string, number> = {};
    for (const c of $.definitions.characters) {
      $.hero.character = c;
      $.recomputeUpgrades();
      $.hero.life = 1;
      const kind = c.bulletStyle.kind;
      const t0 = Date.now();
      while (Date.now() - t0 < 700) {
        await new Promise((res) => setTimeout(res, 50));
        $.hero.life = 1;
        seen[kind] = Math.max(seen[kind] || 0, $.bullets.filter((b: any) => b.kind === kind).length);
      }
    }
    return seen;
  });
  expect(Object.keys(fired).length).toBe(13);
  for (const [k, n] of Object.entries(fired)) expect(n, k).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
