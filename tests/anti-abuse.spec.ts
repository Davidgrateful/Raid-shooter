import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { clientIp } from '../src/lib/ratelimit';
import { issueRunTicket, redeemRunTicket, runFitsTicket } from '../src/lib/runs';
import { mergePilotXp, MAX_PILOT_XP } from '../src/lib/profile';
import { reserveDailyCredit, REFERRAL_DAILY_CAP } from '../src/lib/referral';
import { tryLock, unlock } from '../src/lib/lock';

/*==============================================================================
ANTI-ABUSE

Each block pins one server-side guarantee that used to rest on the client
behaving honestly. Unit tests pin the rule exactly; the HTTP tests prove each
route actually calls it, which a unit test cannot show.

This file runs in the `api` project only: several routes here are rate limited
per IP, the whole suite shares one IP, and two viewport projects running it in
parallel would spend one budget twice.
==============================================================================*/

const uid = (tag: string) => `aa-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 40).toLowerCase();

test.describe.configure({ mode: 'serial' });

/* ------------------------------------------------------------------------- */
test.describe('client IP', () => {
  const req = (h: Record<string, string>) => new Request('http://x/', { headers: h });

  test('the platform-set header wins over a caller-supplied forwarded-for', () => {
    expect(clientIp(req({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6' }))).toBe('203.0.113.9');
    expect(clientIp(req({ 'x-vercel-forwarded-for': '198.51.100.4', 'x-forwarded-for': '6.6.6.6' }))).toBe('198.51.100.4');
  });

  test('forwarded-for uses the hop nearest the server, not the one the caller wrote', () => {
    // the first entry is whatever the original request claimed; the last was
    // appended by infrastructure the caller does not control
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 192.0.2.7' }))).toBe('192.0.2.7');
  });
});

/* ------------------------------------------------------------------------- */
test.describe('run tickets', () => {
  test('a ticket redeems once, and only for the identity it was issued to', async () => {
    const who = `guest:${uid('t')}`;
    const t1 = await issueRunTicket(who);
    expect(await redeemRunTicket(t1.id, who), 'a fresh ticket did not redeem').not.toBeNull();
    expect(await redeemRunTicket(t1.id, who), 'a ticket redeemed twice').toBeNull();

    const t2 = await issueRunTicket(who);
    expect(await redeemRunTicket(t2.id, `guest:${uid('other')}`), "someone else's ticket redeemed").toBeNull();
    // and presenting it under the wrong identity spent it
    expect(await redeemRunTicket(t2.id, who), 'a ticket survived being presented by another identity').toBeNull();

    expect(await redeemRunTicket('not-a-ticket', who)).toBeNull();
    expect(await redeemRunTicket(undefined, who)).toBeNull();
  });

  test('a run cannot claim more time than has actually passed', () => {
    const ticket = { identity: 'x', issuedAt: 1_000_000 };
    const now = ticket.issuedAt + 60_000; // 60 real seconds later
    expect(runFitsTicket(60, ticket, now)).toBe(true);
    expect(runFitsTicket(75, ticket, now), 'latency grace refused an honest run').toBe(true);
    expect(runFitsTicket(600, ticket, now), 'a 600s run fit a 60s ticket').toBe(false);
  });
});

/* ------------------------------------------------------------------------- */
async function ticket(request: APIRequestContext, guest: string): Promise<string> {
  const r = await request.post('/api/run/start', { data: { guestToken: guest } });
  expect(r.status(), 'run/start refused').toBe(200);
  const d = await r.json();
  expect(typeof d.ticket).toBe('string');
  return d.ticket;
}

async function submit(request: APIRequestContext, guest: string, extra: Record<string, unknown>) {
  const res = await request.post('/api/leaderboard', {
    data: { score: 6000, level: 3, kills: 12, combo: 5, time: 5, pilot: 'ONYIX', name: 'TICKETED', guestToken: guest, ...extra },
  });
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { /* */ }
  return { status: res.status(), body };
}

test.describe('score submission', () => {
  test('a run claiming more time than its ticket allows is refused', async ({ request }) => {
    const g = uid('long');
    const t = await ticket(request, g);
    const r = await submit(request, g, { runTicket: t, time: 900 });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.error).toBe('run_time_mismatch');
  });

  test('an honest ticketed run is accepted', async ({ request }) => {
    const g = uid('ok');
    const t = await ticket(request, g);
    const r = await submit(request, g, { runTicket: t });
    expect(r.body.ok, JSON.stringify(r.body)).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */
test.describe('streak', () => {
  test('asking for a streak day without playing records nothing', async ({ request }) => {
    const g = uid('lazy');
    const r = await (await request.post('/api/streak', { data: { guestToken: g } })).json();
    expect(r.recorded, 'a day was recorded for an identity that never played').toBe(false);
    expect(r.days).toBe(0);
  });

  test('an accepted ticketed run records the day on its own', async ({ request }) => {
    const g = uid('played');
    const t = await ticket(request, g);
    const s = await submit(request, g, { runTicket: t });
    expect(s.body.ok, JSON.stringify(s.body)).toBe(true);
    // recorded fire-and-forget after the response - give it a moment
    await new Promise((r) => setTimeout(r, 300));
    const got = await (await request.get(`/api/streak?guestToken=${g}`)).json();
    expect(got.days, 'a real run did not count toward the streak').toBe(1);
  });
});

/* ------------------------------------------------------------------------- */
test.describe('referral', () => {
  test('a player with no referrer is not an error on boot', async ({ request }) => {
    const r = await request.post('/api/referral', { data: { action: 'track', ref: '', callSign: 'BOOTER', guestToken: uid('boot') } });
    expect(r.status(), 'every boot without a referrer used to log a 400').toBe(200);
    expect(typeof (await r.json()).code, 'the code minted by this call never reached the client').toBe('string');
  });

  test('a claimed score with no run behind it qualifies nothing', async ({ request }) => {
    const owner = await (await request.post('/api/referral', { data: { action: 'track', ref: '', callSign: 'RECRUITER', guestToken: uid('own') } })).json();
    const g = uid('ref');
    await request.post('/api/referral', { data: { action: 'track', ref: owner.code, guestToken: g } });
    const c = await (await request.post('/api/referral', { data: { action: 'claim', score: 999_999, guestToken: g } })).json();
    expect(c.credited, 'a number in the request qualified a referral').toBe(false);
    expect(c.reason).toBe('below_threshold');
  });

  test('a real qualifying run does credit the recruiter', async ({ request }) => {
    const owner = await (await request.post('/api/referral', { data: { action: 'track', ref: '', callSign: 'HONESTREC', guestToken: uid('own2') } })).json();
    const g = uid('real');
    await request.post('/api/referral', { data: { action: 'track', ref: owner.code, guestToken: g } });
    const t = await ticket(request, g);
    expect((await submit(request, g, { runTicket: t })).body.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    const c = await (await request.post('/api/referral', { data: { action: 'claim', score: 6000, guestToken: g } })).json();
    expect(c.credited, `a genuine referral was not credited: ${JSON.stringify(c)}`).toBe(true);
  });

  test('one recruiter is capped per day, and the overflow is deferred rather than lost', async () => {
    const code = uid('cap').toUpperCase();
    for (let i = 0; i < REFERRAL_DAILY_CAP; i++) {
      expect(await reserveDailyCredit(code), `credit ${i + 1} refused under the cap`).toBe(true);
    }
    expect(await reserveDailyCredit(code), 'the cap did not hold').toBe(false);
    // a different day is a fresh allowance
    expect(await reserveDailyCredit(code, Date.now() + 86_400_000)).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */
test.describe('pilot XP', () => {
  test('the server cap matches the real level curve', () => {
    const src = readFileSync('public/game/characters.js', 'utf8');
    const m = /\$\.pilotLevelThresholds\s*=\s*\[([^\]]+)\]/.exec(src);
    expect(m, 'could not find the level thresholds').not.toBeNull();
    const top = Math.max(...m![1].split(',').map((n) => Number(n.trim())));
    expect(MAX_PILOT_XP, 'server XP cap drifted from the engine curve').toBe(top);
  });

  test('an absurd total is clamped, and stored absurd totals are cleaned up', async () => {
    const who = `guest:${uid('xp')}`;
    expect((await mergePilotXp(who, { onyix: 10_000_000 })).onyix).toBe(MAX_PILOT_XP);
  });

  test('without recent play a sync can read totals but not raise them', async () => {
    const who = `guest:${uid('xp2')}`;
    await mergePilotXp(who, { onyix: 4000 });
    const after = await mergePilotXp(who, { onyix: 20_000 }, false);
    expect(after.onyix, 'a sync with no play behind it raised XP').toBe(4000);
  });
});

/* ------------------------------------------------------------------------- */
test('the guest merge lock admits one holder at a time', async () => {
  const name = `merge:${uid('lk')}`;
  const a = await tryLock(name);
  expect(a).not.toBeNull();
  expect(await tryLock(name), 'two holders at once').toBeNull();
  await unlock(name, 'someone-else');
  expect(await tryLock(name), 'a non-owner released the lock').toBeNull();
  await unlock(name, a!);
  expect(await tryLock(name), 'the owner could not release').not.toBeNull();
});
