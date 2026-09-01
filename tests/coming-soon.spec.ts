import { test, expect, type Page } from '@playwright/test';
import { boot, VETERAN } from './support/harness';
import { trackInterest, getInterest, isInterestFeature } from '../src/lib/stats';

/*==============================================================================
COMING SOON — DUELS

DUELS is announced on the command deck and is NOT built. That combination has
two well-known failure modes, and these tests hold the panel away from both:

  1. A DEAD CONTROL THAT LOOKS LIVE. If the panel reads like the other cards,
     someone presses it expecting a match and gets nothing. The panel must say
     it is unbuilt, and it must not offer a route into a duel.

  2. A TEASER THAT OVERCLAIMS. A date we cannot keep, or a "notify me" with
     nowhere to send. The one interaction is a counted tap, and the panel says
     exactly that and nothing more.

The tap is the whole point of shipping this early: it turns "should we build
multiplayer" from an argument into a number. So the count has to be honest -
one player is one player, however many times they press it.
==============================================================================*/

const panel = (page: Page) => page.locator('.rs-soon');
const button = (page: Page) => page.locator('.rs-soon-btn');

test.describe('the panel is honest about not being built', () => {
  test('it is on the deck, and it says coming soon', async ({ page }) => {
    await boot(page, { profile: VETERAN });

    await expect(panel(page), 'the duels panel is not on the command deck').toBeVisible();
    const text = (await panel(page).innerText()).toLowerCase();
    expect(text, 'the panel does not name the feature').toContain('duels');
    expect(text, 'nothing marks this as unbuilt').toContain('coming soon');
    expect(text, 'the blurb does not admit the feature is unbuilt').toContain('not built yet');
  });

  test('it promises no date and no notification', async ({ page }) => {
    await boot(page, { profile: VETERAN });
    const text = (await panel(page).innerText()).toLowerCase();

    // A date we cannot keep is worse than no date.
    expect(text, 'the panel commits to a timeframe').not.toMatch(/\b(soon as|next (week|month)|q[1-4]|launch(es|ing) )/);
    // There is no mailer behind this, so it must not imply one.
    expect(text, 'the panel implies a notification it cannot send').not.toMatch(/notify|email|we.ll let you know|remind/);
  });

  test('it offers no way to start a duel', async ({ page }) => {
    await boot(page, { profile: VETERAN });

    // Exactly one control, and it is the interest tap - not a play button.
    const controls = panel(page).locator('button, a');
    await expect(controls, 'an unbuilt feature exposed more than the interest tap').toHaveCount(1);
    expect((await button(page).innerText()).toLowerCase()).toContain("i'd play this");

    // And pressing it must not navigate anywhere.
    const before = await page.evaluate(() => (window as any).$.state);
    await page.route('**/api/track', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await button(page).click();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).$.state), 'the deck navigated away').toBe(before);
  });

  test('it sits below everything the player can actually use', async ({ page }) => {
    /*
     * Ordering is a promise too. A "coming soon" card above the mission, the
     * rewards and the rank card sells the thing that does not exist over the
     * things the player came here to do. The check is positional rather than
     * by index, so re-ordering the cards above it cannot silently pass.
     */
    await boot(page, { profile: VETERAN });

    const sections = page.locator('.rs-cc-ops section');
    const count = await sections.count();
    expect(count, 'the ops column is empty').toBeGreaterThan(1);

    const soon = await panel(page).boundingBox();
    expect(soon, 'the panel did not render').not.toBeNull();

    for (let i = 0; i < count; i++) {
      const el = sections.nth(i);
      if ((await el.getAttribute('class'))?.includes('rs-soon')) continue;
      const box = await el.boundingBox();
      const label = (await el.locator('.rs-label').first().innerText().catch(() => '')) || `panel ${i}`;
      expect(box).not.toBeNull();
      expect(soon!.y, `the unbuilt feature was placed above "${label}"`).toBeGreaterThan(box!.y);
    }

    // Specifically: above Standing is the ordering that would be tempting and
    // is wrong - the player's own rank is the reason they came back.
    const standing = page.locator('.rs-cc-ops section', { has: page.locator('.rs-label', { hasText: /^Standing$/ }) });
    await expect(standing, 'the Standing panel is not on the deck').toHaveCount(1);
    const st = await standing.boundingBox();
    expect(soon!.y, 'the unbuilt feature outranked the player\'s own standing').toBeGreaterThan(st!.y);
  });
});

test.describe('the interest tap', () => {
  test('records one tap, with the feature named, and acknowledges it', async ({ page }) => {
    const posts: Array<Record<string, unknown>> = [];
    await page.route('**/api/track', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body?.event === 'interest') posts.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await boot(page, { profile: VETERAN });
    await button(page).click();
    await expect(button(page), 'the tap was not acknowledged').toHaveText(/noted/i);

    expect(posts, 'the tap did not reach the server exactly once').toHaveLength(1);
    expect(posts[0].feature, 'the tap did not name the feature').toBe('duels');

    // The write half of "the deck stops asking" - the read half is below.
    const remembered = await page.evaluate(() => localStorage.getItem('rs-interest-duels'));
    expect(remembered, 'the tap was not remembered on this device').toBe('1');

    // Pressing again must not double-count the same player's enthusiasm.
    await expect(button(page)).toBeDisabled();
    await button(page).click({ force: true });
    await page.waitForTimeout(400);
    expect(posts, 'the same player was counted twice').toHaveLength(1);
  });

  test('a remembered tap stops the deck asking again', async ({ page }) => {
    /*
     * The read half of the round trip. It seeds the flag the previous test
     * proved gets written, rather than booting the engine twice in one test -
     * a second full boot is slow enough under a parallel run to time out for
     * reasons that have nothing to do with what is being checked.
     */
    const posts: string[] = [];
    await page.route('**/api/track', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body?.event === 'interest') posts.push('post');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('rs-interest-duels', '1'); } catch { /* private mode */ }
    });

    await boot(page, { profile: VETERAN });

    await expect(button(page), 'the deck asked a player who had already answered').toHaveText(/noted/i);
    await expect(button(page)).toBeDisabled();
    expect(posts, 'a remembered tap was re-sent on load').toEqual([]);
  });

  test('a failed tap is shown, not swallowed, and can be retried', async ({ page }) => {
    /*
     * The same rule the reward panels were fixed to follow: a dropped request
     * must never be indistinguishable from success. On a control the player
     * pressed a half-second ago, silence reads as a broken button.
     */
    let fail = true;
    let hits = 0;
    await page.route('**/api/track', (route) => {
      hits++;
      route.fulfill(
        fail
          ? { status: 503, contentType: 'application/json', body: '{"ok":false}' }
          : { status: 200, contentType: 'application/json', body: '{"ok":true}' },
      );
    });

    await boot(page, { profile: VETERAN });
    await button(page).click();
    await expect(panel(page), 'a failed tap looked exactly like a successful one').toContainText(/could not record/i);
    await expect(button(page), 'a failed tap left no way to retry').toBeEnabled();

    fail = false;
    await button(page).click();
    await expect(button(page), 'the retry did not take').toHaveText(/noted/i);
    expect(hits).toBe(2);
  });
});

test.describe('the count is worth acting on', () => {
  const who = () => `guest:soon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  test('one player is one player, however many times they tap', async () => {
    const before = (await getInterest()).find((f) => f.feature === 'duels');
    const basePlayers = before?.players ?? 0;
    const baseTaps = before?.taps ?? 0;

    const a = who();
    await trackInterest(a, 'duels');
    await trackInterest(a, 'duels');
    await trackInterest(a, 'duels');
    await trackInterest(who(), 'duels');

    const after = (await getInterest()).find((f) => f.feature === 'duels');
    expect(after, 'the feature vanished from the report').toBeTruthy();
    expect(after!.players - basePlayers, 'repeat taps inflated the unique-player count').toBe(2);
    expect(after!.taps - baseTaps, 'raw taps were not counted').toBe(4);
  });

  test('only allowlisted features can be counted', async ({ request }) => {
    /*
     * The feature name comes off the wire, so without an allowlist a script
     * could mint unbounded keys in Redis - a cost bug dressed as telemetry.
     */
    expect(isInterestFeature('duels')).toBe(true);
    expect(isInterestFeature('anything-else')).toBe(false);
    expect(isInterestFeature('')).toBe(false);
    expect(isInterestFeature(null)).toBe(false);

    const res = await request.post('/api/track', {
      data: { event: 'interest', feature: 'made-up-feature' },
    });
    test.skip(res.status() === 429, 'rate limited by another test - the guard could not be reached');
    expect(res.status(), 'the route accepted an unknown feature name').toBe(400);
  });
});
