import { test, expect } from '@playwright/test';
import { trackInterest, getInterest, isInterestFeature } from '../src/lib/stats';

/*==============================================================================
INTEREST TAPS - the feature-demand counter behind the admin dashboard

DUELS shipped, and the deck's "I'd play this" tap went with its teaser panel.
The counter it fed stays: the admin dashboard still reports the taps already
recorded, and the next unbuilt feature can reuse it. These hold the two
properties that make the number worth acting on.
==============================================================================*/

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
