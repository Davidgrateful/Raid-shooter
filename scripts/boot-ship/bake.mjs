// Regenerates public/boot/onyix-turn.webp, the loading screen's ship: a strip
// of 36 frames (220x140 each) of ONYIX turning under the bay lamp, rendered
// from the hangar's own 3D model so the two always match. Run it after
// changing ONYIX in planeSpecs.ts:   node scripts/boot-ship/bake.mjs
// Needs the dev dependencies (Playwright's Chromium) and npx for esbuild.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const work = mkdtempSync(join(tmpdir(), 'boot-ship-'));
const nm = join(root, 'node_modules/three');
execFileSync('npx', ['--yes', 'esbuild@0.28.2', join(here, 'entry.ts'), '--bundle', '--format=iife', `--outfile=${join(work, 'bake.js')}`, '--log-level=warning',
  `--alias:three=${nm}/build/three.module.js`,
  `--alias:three/examples/jsm/environments/RoomEnvironment.js=${nm}/examples/jsm/environments/RoomEnvironment.js`], { stdio: 'inherit' });
writeFileSync(join(work, 'page.html'), '<!doctype html><body><script src="bake.js"></script></body>');
const browser = await chromium.launch({
  executablePath: process.env.RS_CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.goto('file://' + join(work, 'page.html'));
const url = await page.evaluate(() => window.__bake());
await browser.close();
mkdirSync(join(root, 'public/boot'), { recursive: true });
const out = join(root, 'public/boot/onyix-turn.webp');
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote', out, Math.round(Buffer.from(url.split(',')[1], 'base64').length / 1024) + ' KB');
