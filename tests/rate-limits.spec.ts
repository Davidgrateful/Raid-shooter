import { test, expect } from '@playwright/test';

/*==============================================================================
RATE LIMITS ON THE WRITE PATHS

Measured before this change, 40 rapid POSTs each: /api/leaderboard/name took 40
of 40 - fanning out to the main board, the weekly ladder and any live cup on
every one - and /api/consumable/use, /api/siwe/verify and /api/inbox never
refused either. /api/track, which already had a limiter, correctly answered 429
from request 41. Upstash bills per request, so an unbounded write path is a cost
bug before it is a security one.

The AXIS differs per route, and the difference is the substance of the change:

  IP        for renames, sign-in and the inbox. A guest identity is a token the
            CLIENT chooses, so an identity limit is bypassed by minting a new
            one, and the cost being defended is per-host.

  IDENTITY  for consumables. The client applies the effect and fires the
            request without reading the reply (market.js useConsumable,
            drones.js activateXpBoost both end in `.catch(function(){})`), so a
            429 means the heal already happened and the charge was never spent.
            Per-IP, one abusive host behind a carrier NAT would hand every
            honest player sharing it a free consumable.

Ceilings are deliberately far above honest use, and the first half of this file
is the half that keeps them there: a limiter that fires on a real player is
worse than no limiter, because it breaks the game AND reads as a bug.

WHAT IS NOT FLOODED HERE. /api/inbox GET is limited (120/min) but not flood
tested: every other spec's boot() fetches it on menu entry, so driving it to
429 would poison the window for the rest of the suite and fail tests for a
reason unrelated to what they check. The POST half shares its code path and is
flooded below.
==============================================================================*/

/** A distinct guest identity per call - tokens are /^[a-z0-9-]{8,40}$/i. */
function identity(tag: string): string {
  return `rl-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    .slice(0, 40).toLowerCase();
}

async function burst(n: number, send: () => Promise<number>): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(await send());
  return out;
}

/*
 * Serial, and in this order. The IP-keyed limiters are shared by every test in
 * this file because the whole suite runs from one address, so the headroom
 * checks have to run BEFORE the floods that fill those windows. This file also
 * has a project to itself (see playwright.config.ts) so a second viewport
 * project cannot be spending the same budget at the same time.
 */
test.describe.configure({ mode: 'serial' });

test.describe('honest use stays well under every ceiling', () => {
  test('renaming a few times in a session is never refused', async ({ request }) => {
    const who = identity('name-ok');
    const statuses = await burst(3, async () =>
      (await request.post('/api/leaderboard/name', { data: { name: 'PILOTONE', guestToken: who } })).status());
    expect(statuses.filter((s) => s === 429), 'a realistic rename was throttled').toEqual([]);
  });

  test('spending several consumables in a long run is never refused', async ({ request }) => {
    const who = identity('use-ok');
    const statuses = await burst(6, async () =>
      (await request.post('/api/consumable/use', { data: { itemId: 'consumable_health', guestToken: who } })).status());
    expect(statuses.filter((s) => s === 429), 'a realistic run was throttled').toEqual([]);
  });

  test('opening the inbox repeatedly in a session is never refused', async ({ request }) => {
    const who = identity('inbox-ok');
    const statuses = await burst(8, async () =>
      (await request.post('/api/inbox', { data: { guestToken: who } })).status());
    expect(statuses.filter((s) => s === 429), 'realistic inbox use was throttled').toEqual([]);
  });
});

test.describe('the write paths refuse a flood', () => {
  test('renaming is capped', async ({ request }) => {
    const statuses = await burst(30, async () =>
      (await request.post('/api/leaderboard/name', {
        data: { name: 'FLOODTEST', guestToken: identity('name') },
      })).status());

    // A fresh guest token every time: an identity-keyed limiter would be
    // bypassed by exactly this, which is why the rename limit is per host.
    expect(statuses.filter((s) => s === 429).length,
      'a rename flood using a new identity each time was accepted in full').toBeGreaterThan(0);
  });

  test('sign-in verification is capped', async ({ request }) => {
    const statuses = await burst(30, async () =>
      (await request.post('/api/siwe/verify', { data: { message: 'x', signature: '0x00' } })).status());

    expect(statuses.filter((s) => s === 429).length,
      'unlimited sign-in attempts were accepted').toBeGreaterThan(0);
  });

  test('marking the inbox read is capped', async ({ request }) => {
    const statuses = await burst(70, async () =>
      (await request.post('/api/inbox', { data: { guestToken: identity('inbox') } })).status());

    expect(statuses.filter((s) => s === 429).length,
      'unlimited inbox writes were accepted').toBeGreaterThan(0);
  });

  test('spending is capped per identity, and a neighbour is not caught in it', async ({ request }) => {
    /*
     * The axis IS the behaviour. One identity is driven past its ceiling; a
     * second, fresh identity from the SAME host must still be served, because
     * every 429 on this route hands the player a free effect.
     */
    const loud = identity('greedy');
    const statuses = await burst(40, async () =>
      (await request.post('/api/consumable/use', {
        data: { itemId: 'consumable_health', guestToken: loud },
      })).status());
    expect(statuses.filter((s) => s === 429).length,
      'one identity spent without limit').toBeGreaterThan(0);

    const bystander = await request.post('/api/consumable/use', {
      data: { itemId: 'consumable_health', guestToken: identity('bystander') },
    });
    expect(bystander.status(),
      'a second player on the same host was throttled by the first one').not.toBe(429);
  });
});
