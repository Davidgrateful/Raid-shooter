import { test, expect } from '@playwright/test';
import { dayWithinWindow } from '../src/lib/dailyrun';

/*==============================================================================
DAILY RUN INTEGRITY

Daily Run is the only board in the game where skill beats hours: one seeded
attempt per identity per day, ZADD rather than ZINCRBY, and a second submit is
refused rather than allowed to overwrite (dailyrun.ts submitDaily).

That rule rested entirely on the day key, which the CLIENT supplies - correctly,
because it has to match the seed the player was given - and which was only
format-checked. Every distinct well-formed string is a separate board with its
own hasPlayedDaily() check, so `day: "2030-1-1"`, `"2030-1-2"`, ... bought
unlimited attempts and let one player pre-occupy rank 1 on every future daily
board before anyone else arrived.

WHY THE GUARD IS TESTED AS A FUNCTION AND NOT OVER HTTP.
/api/dailyrun rate-limits at 10 requests per 60s per IP, and that check runs
BEFORE the day is validated. A suite that exercised the boundary over HTTP
would therefore start returning 429 partway through and fail for a reason that
has nothing to do with the thing under test - which is exactly the kind of
dice-rolling test this project removed from economy.spec.ts. dayWithinWindow
takes an injectable `now`, so every boundary can be pinned exactly instead.
One HTTP test below proves the guard is actually wired into the route, which
is the part a unit test cannot show.
==============================================================================*/

/** A fixed instant to measure against: 2026-08-27 12:00 UTC. */
const NOW = Date.UTC(2026, 7, 27, 12, 0, 0);

test.describe('daily run day guard', () => {
  test('a run cannot be dated to a day the player is not living in', () => {
    // The original exploit: an unlimited supply of fresh, empty boards.
    expect(dayWithinWindow('2030-1-1', NOW), 'a 2030 date was accepted').toBe(false);
    // The same hole pointed backwards - it would rewrite a settled board.
    expect(dayWithinWindow('2020-1-1', NOW), 'a 2020 date was accepted').toBe(false);
    // And the near miss that a sloppy guard would let through.
    expect(dayWithinWindow('2026-8-29', NOW), 'two days ahead was accepted').toBe(false);
    expect(dayWithinWindow('2026-8-25', NOW), 'two days behind was accepted').toBe(false);
  });

  test('every timezone on earth can still post today', () => {
    // Local dates span UTC-12..UTC+14, so a client is at most one calendar day
    // either side of the server's UTC date. All three must be accepted, or the
    // guard punishes honest players at the edges of the world.
    expect(dayWithinWindow('2026-8-26', NOW), 'yesterday was rejected').toBe(true);
    expect(dayWithinWindow('2026-8-27', NOW), 'today was rejected').toBe(true);
    expect(dayWithinWindow('2026-8-28', NOW), 'tomorrow was rejected').toBe(true);
  });

  test('the boundary holds across month and year ends', () => {
    // A window built on raw date arithmetic tends to break here, and these are
    // real days players will be online for.
    const newYearEve = Date.UTC(2026, 11, 31, 23, 30, 0);
    expect(dayWithinWindow('2027-1-1', newYearEve), 'new year was rejected').toBe(true);
    expect(dayWithinWindow('2026-12-30', newYearEve)).toBe(true);
    expect(dayWithinWindow('2027-1-2', newYearEve), 'two days into the new year was accepted').toBe(false);

    // Leap day: 2028 has a 29th of February, 2026 does not.
    const leap = Date.UTC(2028, 1, 29, 6, 0, 0);
    expect(dayWithinWindow('2028-2-29', leap), 'a real leap day was rejected').toBe(true);
    expect(dayWithinWindow('2026-2-29', Date.UTC(2026, 1, 28, 6, 0, 0)), 'a fake leap day was accepted').toBe(false);
  });

  test('a string that is not a real date is refused', () => {
    // These pass /^\d{4}-\d{1,2}-\d{1,2}$/ - the route's only previous check -
    // but Date.UTC silently rolls them forward into the next month.
    expect(dayWithinWindow('2026-2-31', Date.UTC(2026, 1, 28)), '31 February was accepted').toBe(false);
    expect(dayWithinWindow('2026-13-1', NOW), 'month 13 was accepted').toBe(false);
    expect(dayWithinWindow('2026-8-0', NOW), 'day 0 was accepted').toBe(false);
    // and outright malformed input
    expect(dayWithinWindow('', NOW)).toBe(false);
    expect(dayWithinWindow('not-a-date', NOW)).toBe(false);
  });

  /*
   * The unit tests above prove the rule; this proves the route enforces it.
   * It spends a single request so it cannot itself trip the rate limit, and
   * tolerates a 429 left over from another test rather than failing on it.
   */
  test('the route rejects an out-of-range day', async ({ request }) => {
    const res = await request.post('/api/dailyrun', {
      data: { day: '2030-1-1', score: 4242, pilot: 'ONYIX', name: 'TESTPILOT' },
    });
    test.skip(res.status() === 429, 'rate limited - the guard could not be reached');

    expect(res.status(), 'a run dated 2030 was not rejected by the route').toBe(400);
    expect((await res.json()).error).toBe('day_out_of_range');
  });
});
