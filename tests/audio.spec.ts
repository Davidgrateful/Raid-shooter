import { test, expect } from '@playwright/test';
import { boot, startRun } from './support/harness';

/*==============================================================================
AUDIO

Two properties matter and neither is audible in a screenshot: the mix
hierarchy (gameplay feedback must sit above music at EVERY volume setting) and
voice management (rapid fire must not stack unbounded audio sources). Both had
real defects during this project, so both are pinned here.
==============================================================================*/

test('the mix hierarchy holds at every volume level', async ({ page }) => {
  await boot(page, { profile: { mute: 0, soundLevel: 1, music: 1, seen: 1, guideseen: 1, autofire: 1, controls: 'hybrid' } });
  await page.mouse.click(20, 20);          // gesture unlock for autoplay rules
  await startRun(page, 2500);

  const mix = await page.evaluate(() => {
    const $ = (window as any).$;
    return [1, 0.5, 0].map((level) => {
      $.setSoundLevel(level);
      return {
        level,
        sfx: $.audio.gain ? $.audio.gain.gain.value : null,
        music: $.music.master ? $.music.master.gain.value : null,
      };
    });
  });

  const full = mix.find((m: any) => m.level === 1)!;
  const low = mix.find((m: any) => m.level === 0.5)!;
  const mute = mix.find((m: any) => m.level === 0)!;

  // Effects always louder than music, by the SAME ratio at full and low - the
  // bug this replaces let music stay put while effects halved.
  expect(full.sfx / full.music).toBeCloseTo(low.sfx / low.music, 1);
  expect(full.sfx).toBeGreaterThan(full.music);
  expect(mute.sfx).toBe(0);
  expect(mute.music).toBe(0);
});

test('rapid fire cannot stack unbounded audio sources', async ({ page }) => {
  await boot(page, { profile: { mute: 0, soundLevel: 1, music: 0, seen: 1, guideseen: 1, autofire: 1, controls: 'hybrid' } });
  await page.mouse.click(20, 20);
  await startRun(page, 2000);

  const result = await page.evaluate(() => {
    const $ = (window as any).$;
    if (!$.audio.ctx) return null;
    let sources = 0;
    const orig = $.audio.ctx.createBufferSource.bind($.audio.ctx);
    $.audio.ctx.createBufferSource = function () { sources++; return orig(); };
    const t0 = Date.now();
    let calls = 0;
    while (Date.now() - t0 < 500) { $.audio.play('hit'); calls++; }
    $.audio.ctx.createBufferSource = orig;
    return { calls, sources };
  });

  expect(result).not.toBeNull();
  expect(result!.calls).toBeGreaterThan(1000);   // we really did hammer it
  // 45ms throttle over 500ms => ~11-12. Anything near `calls` means no throttle.
  expect(result!.sources).toBeLessThan(20);
});
