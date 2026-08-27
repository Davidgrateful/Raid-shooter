import { test, expect, type APIRequestContext } from '@playwright/test';
import { runSignature, claimRunOnce } from '../src/lib/leaderboard';

/*==============================================================================
COMPETITIVE INTEGRITY

The all-time, weekly and cup boards are all CUMULATIVE (ZINCRBY), and a score
submission carried no identity the server issued - no run id, no nonce. The
only guard was a 20s per-identity cooldown, which paces a replay rather than
preventing one.

Measured before the fix, re-sending ONE captured payload unchanged:
    replay 1 -> total 50000
    replay 2 -> total 100000
    replay 3 -> total 150000
...with kills going 420 -> 1260. Because computeWinners ranks off the cup board
and cup prizes include USDC, that converted directly into money.

The fix makes a submission idempotent rather than rejecting repeats, because
the client has a legitimate retry that resends the identical payload by design
(shooterboard.js captures it once so a cooldown 429 can be waited out). These
tests hold both halves of that: a replay must not accumulate, and a run must
still count the first time.

Each test uses its own guest identity so the suite can run in any order and in
parallel projects without one test's board state deciding another's result.
==============================================================================*/

interface Run {
  score: number; level: number; kills: number; combo: number;
  time: number; pilot: string;
}

const RUN: Run = { score: 50_000, level: 12, kills: 420, combo: 30, time: 300, pilot: 'ONYIX' };

/** A distinct identity per test - guest tokens are /^[a-z0-9-]{8,40}$/i. */
function identity(tag: string): string {
  return `ci-${tag}-${Date.now().toString(36)}`.slice(0, 40).toLowerCase();
}

async function submit(
  request: APIRequestContext,
  guestToken: string,
  run: Run,
  extra: Record<string, unknown> = {},
) {
  const res = await request.post('/api/leaderboard', {
    data: { ...run, name: 'INTEGRITY', guestToken, ...extra },
  });
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { status: res.status(), body };
}

/*
 * The submit cooldown is 20s per identity and is checked BEFORE the
 * idempotency guard, so a back-to-back replay never reaches the thing under
 * test - it just gets a 429. That is what makes a naive HTTP replay test
 * useless, and it is also why the exploit needed 20s pacing to work at all.
 * The guard's contract is therefore pinned as a unit, and ONE end-to-end test
 * pays the real wall-clock cost to prove the route wires it up.
 */
test.describe('score submission integrity', () => {
  test('the run signature separates real runs and catches identical ones', () => {
    expect(runSignature(RUN)).toBe(runSignature({ ...RUN }));
    expect(runSignature(RUN)).not.toBe(runSignature({ ...RUN, score: RUN.score + 1 }));
    expect(runSignature(RUN)).not.toBe(runSignature({ ...RUN, kills: RUN.kills + 1 }));
    expect(runSignature(RUN)).not.toBe(runSignature({ ...RUN, time: RUN.time + 1 }));
    expect(runSignature(RUN)).not.toBe(runSignature({ ...RUN, level: RUN.level + 1 }));
    expect(runSignature(RUN)).not.toBe(runSignature({ ...RUN, pilot: 'NOVA' }));
  });

  test('a run can only be claimed once, and only for the identity that ran it', async () => {
    const sig = runSignature(RUN);
    const a = identity('claim-a');
    const b = identity('claim-b');

    expect(await claimRunOnce(a, sig), 'the first claim of a run was refused').toBe(true);
    expect(await claimRunOnce(a, sig), 'the same run was claimed twice').toBe(false);
    expect(await claimRunOnce(a, sig), 'a third claim of the same run succeeded').toBe(false);

    // Signatures are namespaced per identity: two players CAN legitimately post
    // identical-looking runs, and one must not lock the other out.
    expect(await claimRunOnce(b, sig), "one player's run blocked another's").toBe(true);

    // A different run from the same player is a different claim.
    expect(await claimRunOnce(a, runSignature({ ...RUN, score: RUN.score + 1 })), 'a distinct run was refused').toBe(true);
  });

  test('replaying a captured run does not accumulate, but a new run still does', async ({ request }) => {
    /*
     * The end-to-end proof, and the only test here that spends real time: the
     * cooldown has to elapse between submissions or the route answers 429
     * before the guard is reached. Two waits, ~21s each.
     */
    test.setTimeout(120_000);
    const who = identity('e2e');
    const wait = () => new Promise((r) => setTimeout(r, 21_000));

    const first = await submit(request, who, RUN);
    test.skip(first.status === 429, 'cooldown collision; cannot exercise the rule');
    expect(first.body.ok, 'the first submission was not accepted').toBe(true);
    expect(first.body.total).toBe(RUN.score);

    await wait();
    const replay = await submit(request, who, RUN);
    expect(replay.body.duplicate, 'a replayed run was not recognised as a duplicate').toBe(true);
    expect(replay.body.total, 'a replayed run added to the cumulative total').toBe(RUN.score);

    await wait();
    const distinct = await submit(request, who, { ...RUN, score: 61_000, kills: 500, time: 340 });
    expect(distinct.body.duplicate, 'a distinct run was mistaken for a replay').toBeUndefined();
    expect(distinct.body.total, 'a distinct run did not accumulate').toBe(RUN.score + 61_000);
  });
});

test.describe('assisted policy', () => {
  /*
   * The audited policy: a loadout - drone, field kit, or both - is a legitimate
   * part of a run. Assisted runs RANK; the flag exists so the operator can see
   * what a top run was flying before paying a prize. These tests hold that
   * policy explicitly so a future change to it has to be deliberate.
   */
  const cases: Array<{ name: string; extra: Record<string, unknown> }> = [
    { name: 'a clean run', extra: {} },
    { name: 'a consumable-assisted run', extra: { assisted: true } },
    { name: 'a drone run', extra: { cosmetics: { droneId: 'drone_voltmite' } } },
    {
      name: 'a drone + consumable run',
      extra: { assisted: true, cosmetics: { droneId: 'drone_needlefinch' } },
    },
  ];

  for (const c of cases) {
    test(`${c.name} still ranks`, async ({ request }) => {
      const res = await submit(request, identity('policy'), RUN, c.extra);
      test.skip(res.status === 429, 'cooldown from another test');

      expect(res.body.ok, `${c.name} was rejected`).toBe(true);
      expect(res.body.total, `${c.name} did not score`).toBe(RUN.score);
      expect(res.body.rank, `${c.name} was not given a rank`).toBeGreaterThan(0);
    });
  }
});
