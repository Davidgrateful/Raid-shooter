import type { Page, Route } from '@playwright/test';

/*==============================================================================
SHARED HARNESS

Every test below drives the REAL game the way a player does: boot the engine,
get past the splash, then read what the engine and the DOM actually say. These
helpers exist because all five of the original verification scripts repeated
the same three chores - seed a profile, wait for the engine, dismiss whatever
modal was in the way - and getting any of them subtly wrong is how a test ends
up passing against a broken build.

Nothing here stubs the game. The engine is real; only the network is faked, and
only where a test needs a specific server answer.
==============================================================================*/

/** A returning player with a history, so screens have real values to show. */
export const VETERAN = {
  mute: 1, autofire: 1, score: 41250, pilotname: 'ONYX', ship: 1, character: 0,
  trail: 'trail_ion', drone: 'drone_voltmite', pilotxp: { onyix: 4200 },
  controls: 'hybrid', music: 0, difficulty: 'extreme', seen: 1, guideseen: 1,
  rounds: 63, kills: 4820, level: 7, combo: 22, bullets: 31000, powerups: 190,
  time: 19800,
};

/** No history at all - the first-session state. */
export const NEWCOMER = {
  mute: 1, autofire: 1, controls: 'hybrid', music: 0, seen: 1, guideseen: 1,
};

export interface BootOptions {
  profile?: Record<string, unknown>;
  /**
   * Server ownership payload. Defaults to owning nothing. Pass `null` when the
   * test registers its own /api/profile route - Playwright matches the most
   * recently registered handler first, so a route added here would silently
   * win over the test's and hand back the wrong state.
   */
  serverProfile?: unknown;
  /** Leaderboard payload, or 'down' to make it fail. */
  board?: unknown | 'down';
  /** Skip waiting for the menu (for tests that watch the splash itself). */
  raw?: boolean;
}

const json = (body: unknown) => (r: Route) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const down = (r: Route) =>
  r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' });

/**
 * Boot the game and leave the page sitting on the command deck with every
 * interstitial dismissed. Returns once `$.state === 'menu'`.
 */
export async function boot(page: Page, opts: BootOptions = {}) {
  const profile = opts.profile ?? VETERAN;

  // The starter-bundle modal is paced by localStorage; mark it as already
  // shown today so it cannot appear mid-test and swallow a click.
  await page.addInitScript(() => {
    localStorage.setItem('starterBundlePace', JSON.stringify({
      day: new Date().toISOString().slice(0, 10),
      showsToday: 99, needPlays: 99, playsSinceShown: 0,
    }));
  });
  await page.addInitScript((p) => localStorage.setItem('radiusraid', JSON.stringify(p)), profile);

  if (opts.serverProfile !== null) {
    await page.route('**/api/profile*', json(opts.serverProfile ?? { items: [], consumables: {} }));
  }
  if (opts.board !== undefined) {
    await page.route('**/api/leaderboard*', opts.board === 'down' ? down : json(opts.board));
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).$, null, { timeout: 30000 });
  if (opts.raw) return;

  await page.waitForFunction(() => (window as any).$.state === 'menu', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
}

/** Close any stacked modal scrims that would otherwise intercept clicks. */
export async function dismissOverlays(page: Page) {
  for (let i = 0; i < 4; i++) {
    const scrim = page.locator('div[data-game-ui].bg-black\\/70').first();
    if (!(await scrim.isVisible().catch(() => false))) break;
    await scrim.click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(400);
  }
}

/** Drive the engine to a state, the way the game's own navigation does. */
export async function goToState(page: Page, state: string, settle = 2000) {
  await page.evaluate((s) => (window as any).$.setState(s), state);
  await page.waitForTimeout(settle);
}

/** Start a live run. */
export async function startRun(page: Page, settle = 2000) {
  await page.evaluate(() => { const $ = (window as any).$; $.reset(); $.setState('play'); $.autofire = 1; });
  await page.waitForTimeout(settle);
}

/** Read anything off the engine. */
export async function engine<T>(page: Page, fn: (e: any) => T): Promise<T> {
  return page.evaluate(fn as any, undefined as any) as Promise<T>;
}

/** The page must never scroll sideways - at any viewport, in any state. */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return { doc: d.scrollWidth, win: window.innerWidth, overflows: d.scrollWidth > window.innerWidth + 1 };
  });
}
