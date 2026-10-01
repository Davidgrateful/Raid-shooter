import { test, expect, type APIRequestContext } from '@playwright/test';
import { roleOf, duelState, viewOf, type Duel } from '../src/lib/duels';

/*==============================================================================
DUELS - the server's rules

  - who may create is the operator's switch (holders / all / off); anyone
    with the link may accept
  - one run each: the creator's seat and one challenger's; a third pilot, a
    second attempt, or a run after it settled is refused
  - a duel run carries a run ticket like every run, and a claimed run time the
    ticket could not have lived through is refused
  - the seed is only shown to someone who may still fly it, and the other
    pilot hears about the result in their inbox

Runs in the `api` project only: its limiters are keyed on the shared test IP.
==============================================================================*/

const ADMIN = process.env.ADMIN_STATS_TOKEN || 'test-admin-token-0123456789';
const asAdmin = { Authorization: `Bearer ${ADMIN}` };
const guest = (tag: string) => `duel-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function setAccess(request: APIRequestContext, access: string) {
  const r = await request.post('/api/admin/duels', { headers: asAdmin, data: { access } });
  expect(r.status(), await r.text()).toBe(200);
}

async function ticket(request: APIRequestContext, g: string): Promise<string | undefined> {
  const r = await request.post('/api/run/start', { data: { guestToken: g } });
  test.skip(r.status() === 429, 'run tickets rate limited by another test');
  return (await r.json()).ticket || undefined;
}

const run = (g: string, name: string, score: number, t?: string, time = 0) => ({
  guestToken: g, name, score, pilot: 'NOVA', level: 4, kills: 120, time, runTicket: t,
});

test.describe('who may create a duel', () => {
  test.afterEach(async ({ request }) => { await setAccess(request, 'holders'); });

  test('holders first by default: a guest is told to sign in, and the admin switch is protected', async ({ request }) => {
    await setAccess(request, 'holders');
    const deck = await (await request.get(`/api/duels?g=${guest('a')}`)).json();
    expect(deck).toMatchObject({ access: 'holders', canCreate: false, reason: 'sign_in' });
    const made = await request.post('/api/duels', { data: { guestToken: guest('a'), name: 'GUEST ONE' } });
    test.skip(made.status() === 429, 'duel creation rate limited');
    expect(made.status()).toBe(401);
    expect([401, 403]).toContain((await request.post('/api/admin/duels', { data: { access: 'all' } })).status());
    expect((await request.post('/api/admin/duels', { headers: asAdmin, data: { access: 'everyone!' } })).status()).toBe(400);
  });

  test('off stops new duels', async ({ request }) => {
    await setAccess(request, 'off');
    const made = await request.post('/api/duels', { data: { guestToken: guest('b'), name: 'GUEST TWO' } });
    test.skip(made.status() === 429, 'duel creation rate limited');
    expect(made.status()).toBe(403);
    expect((await made.json()).error).toBe('off');
  });
});

test.describe('a duel, start to finish', () => {
  test.afterEach(async ({ request }) => { await setAccess(request, 'holders'); });

  test('two pilots, one run each, a verdict, and nobody else gets a seat', async ({ request }) => {
    await setAccess(request, 'all');
    const host = guest('host');
    const rival = guest('rival');
    const third = guest('third');

    const made = await request.post('/api/duels', { data: { guestToken: host, name: 'HOST' } });
    test.skip(made.status() === 429, 'duel creation rate limited');
    expect(made.status(), await made.text()).toBe(200);
    const { duel } = await made.json();
    expect(duel.id).toMatch(/^[A-Z2-9]{6}$/);
    expect(duel).toMatchObject({ state: 'open', role: 'creator', canFly: true });
    expect(typeof duel.seed).toBe('number');

    // the rival sees the challenge and may fly it; a junk code is a 404
    const seen = (await (await request.get(`/api/duels/${duel.id}?g=${rival}`)).json()).duel;
    expect(seen).toMatchObject({ creator: { name: 'HOST' }, role: null, canFly: true, seed: duel.seed });
    expect((await request.get('/api/duels/ZZZZZZ')).status()).toBe(404);
    expect((await request.get('/api/duels/not-a-code')).status()).toBe(404);

    // a run claiming more time than its ticket has lived is refused
    const fresh = await ticket(request, host);
    if (fresh) {
      const liar = await request.post(`/api/duels/${duel.id}`, { data: run(host, 'HOST', 99_000, fresh, 3600) });
      expect(liar.status()).toBe(400);
      expect((await liar.json()).error).toBe('run_time_mismatch');
    }

    // the host flies first
    const hostRun = await request.post(`/api/duels/${duel.id}`, { data: run(host, 'HOST', 18_420, await ticket(request, host)) });
    expect(hostRun.status(), await hostRun.text()).toBe(200);
    expect((await hostRun.json()).settled).toBe(false);
    // ...and cannot fly it twice
    const again = await request.post(`/api/duels/${duel.id}`, { data: run(host, 'HOST', 30_000, await ticket(request, host)) });
    expect(again.status()).toBe(409);
    expect((await again.json()).error).toBe('already_flown');

    // the rival's run settles it, and each side sees its own verdict
    const rivalRun = await request.post(`/api/duels/${duel.id}`, { data: run(rival, 'RIVAL', 15_980, await ticket(request, rival)) });
    expect(rivalRun.status(), await rivalRun.text()).toBe(200);
    const settled = await rivalRun.json();
    expect(settled.settled).toBe(true);
    expect(settled.duel).toMatchObject({ state: 'settled', outcome: 'lost', canFly: false });
    expect(settled.duel.seed, 'the seed was shown to someone who can no longer fly it').toBeUndefined();
    const hostView = (await (await request.get(`/api/duels/${duel.id}?g=${host}`)).json()).duel;
    expect(hostView).toMatchObject({ state: 'settled', outcome: 'won', role: 'creator' });

    // a third pilot gets no seat
    const late = await request.post(`/api/duels/${duel.id}`, { data: run(third, 'LATE', 50_000, await ticket(request, third)) });
    expect(late.status()).toBe(409);
    expect((await late.json()).error).toBe('settled');

    // the host hears about it in their inbox, with a link back to the duel
    const inbox = await (await request.get(`/api/inbox?guestToken=${host}`)).json();
    const note = (inbox.messages || []).find((m: { title: string }) => m.title.includes(duel.id));
    expect(note, 'the creator was not told the result').toBeTruthy();
    expect(note.body).toContain('You won by 2,440');
    expect(note.meta?.url).toBe(`/duel/${duel.id}`);

    // and the deck lists it for both of them
    const deck = await (await request.get(`/api/duels?g=${host}`)).json();
    expect(deck.mine.some((d: { id: string }) => d.id === duel.id)).toBe(true);
  });

  test('the duel link page names the challenger and the score to beat', async ({ request, page }) => {
    await setAccess(request, 'all');
    const host = guest('page');
    const made = await request.post('/api/duels', { data: { guestToken: host, name: 'ACE RAID' } });
    test.skip(made.status() === 429, 'duel creation rate limited');
    const { duel } = await made.json();
    await request.post(`/api/duels/${duel.id}`, { data: run(host, 'ACE RAID', 21_300, await ticket(request, host)) });
    await page.goto(`/duel/${duel.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ACE RAID challenges you to beat 21,300');
    await expect(page.getByRole('link', { name: /Fly this raid/ })).toHaveAttribute('href', `/?duel=${duel.id}`);
    expect(await page.title()).toContain('beat 21,300');
  });
});

test.describe('seats, without a server', () => {
  const base = (): Duel => ({
    id: 'ABCDEF', seed: 7, createdAt: 0, expiresAt: Date.now() + 1000_000,
    creator: { key: 'host', name: 'HOST', verified: false }, entries: [],
  });
  const entry = (key: string, score: number) => ({ key, name: key.toUpperCase(), verified: false, score, pilot: 'NOVA', level: 1, kills: 0, time: 0, at: 0 });

  test('the creator always keeps a seat; a stranger can only take the other one', () => {
    const d = base();
    d.entries.push(entry('stranger', 10));
    expect(roleOf(d, 'host').canFly, 'the creator lost their own seat').toBe(true);
    expect(roleOf(d, 'other').canFly, 'a second stranger got a seat').toBe(false);
    d.entries.push(entry('host', 20));
    expect(duelState(d)).toBe('settled');
    expect(viewOf(d, 'host').outcome).toBe('won');
    expect(viewOf(d, 'stranger').outcome).toBe('lost');
  });

  test('an expired duel takes no runs, and keys never reach a viewer', () => {
    const d = { ...base(), expiresAt: Date.now() - 1 };
    expect(duelState(d)).toBe('expired');
    expect(roleOf(d, 'host').canFly).toBe(false);
    const v = viewOf({ ...base(), entries: [entry('host', 5)] }, 'x');
    expect(JSON.stringify(v)).not.toContain('"key"');
    expect(v.seed, 'a viewer who may fly it should get the seed').toBe(7);
  });
});
