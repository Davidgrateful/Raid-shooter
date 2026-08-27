import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/*==============================================================================
Raid Shooter test configuration

The suite drives a REAL production build - `next start`, not `next dev` - so
what CI exercises is what ships. Playwright boots the server itself and reuses
a running one locally, so `npx playwright test` works from a cold checkout.

The viewport list is not decorative: phone landscape is the mode most players
actually hold the game in, and narrow landscape (667x375) is the smallest
supported screen. Several real bugs found during this project - the hangar bay
growing past 10,000px, the nav rail collapsing to unlabelled glyphs, HUD
elements landing on the score - only appeared at those sizes.
==============================================================================*/

const PORT = Number(process.env.PORT ?? 3222);

/*
 * Some environments (including this project's cloud sandbox) ship a Chromium
 * that belongs to a different Playwright build than the one in package.json.
 * Downloading a second copy is wasteful and sometimes blocked, so if a browser
 * is already provided we point straight at it. CI, which installs its own via
 * `playwright install --with-deps`, leaves this unset and uses the default.
 */
const PROVIDED_CHROME = process.env.RS_CHROME_PATH || '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PROVIDED_CHROME) ? { executablePath: PROVIDED_CHROME } : {};

export default defineConfig({
  testDir: './tests',
  // Gameplay tests wait on real runs: a level takes tens of seconds.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,       // one engine, one server, deterministic order
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    /*
     * hud-matrix.spec.ts sweeps its own five viewport/loadout combinations by
     * opening contexts directly, so running it under a viewport project would
     * just run the same five twice. It gets a project of its own, and the two
     * viewport projects ignore it.
     */
    {
      name: 'desktop',
      testIgnore: /hud-matrix\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: 'phone-landscape',
      testIgnore: /hud-matrix\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 844, height: 390 },
        isMobile: false,        // Chromium desktop build cannot do isMobile
        hasTouch: true,
        deviceScaleFactor: 2,
        launchOptions,
      },
    },
    {
      name: 'hud-matrix',
      testMatch: /hud-matrix\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
