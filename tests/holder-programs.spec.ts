import { test, expect, type Page, type Route } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';
import { stripUnearnedCosmetics, tierAtLeast } from '../src/lib/holder';
import { cleanSeason, rowAmount, createPayoutBatch, type WinnerRow } from '../src/lib/rewards';
import { buildDisperse, buildCsv, raidshooterPayoutToken, payoutTokenFor } from '../src/lib/payout';
import { checkPollInput, startPoll, castVote, results, myVote } from '../src/lib/poll';
import { OFFICIAL_TOKEN_ADDRESS } from '../src/lib/token';

/*==============================================================================
$RAIDSHOOTER ROADMAP PHASES 3-4

  tier cosmetics   COMMANDER finish (Commander+), ADMIRAL trail (Admiral)
  DUELS            the early-access list (holders first is now DUELS' own
                   gate - see tests/duels-api.spec.ts)
  cup prizes       tiers can pay $RAIDSHOOTER, in a batch of its own
  Pilot vote       one vote each; holder votes counted on their own
==============================================================================*/

const json = (body: unknown) => (r: Route) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const ADMIN = process.env.ADMIN_STATS_TOKEN || 'test-admin-token-0123456789';
const asAdmin = { Authorization: `Bearer ${ADMIN}` };
const COMMANDER_FINISH = 'hsl(345, 85%, 72%)';

/*--- tier cosmetics ------------------------------------------------------------*/
test.describe('tier cosmetics on the board', () => {
  test('tiers stack', () => {
    expect(tierAtLeast('admiral', 'holder')).toBe(true);
    expect(tierAtLeast('commander', 'admiral')).toBe(false);
    expect(tierAtLeast(null, 'holder')).toBe(false);
  });

  test('each holder cosmetic needs its tier; everything else passes through', () => {
    const all = { pilotId: 'nova', trailHue: 240, shipColor: COMMANDER_FINISH };
    expect(stripUnearnedCosmetics(all, 'admiral')).toEqual(all);
    expect(stripUnearnedCosmetics(all, 'commander')).toEqual({ pilotId: 'nova', shipColor: COMMANDER_FINISH });
    expect(stripUnearnedCosmetics(all, 'holder')).toEqual({ pilotId: 'nova' });
    expect(stripUnearnedCosmetics(all, null)).toEqual({ pilotId: 'nova' });
    expect(stripUnearnedCosmetics({ trailHue: 130 }, 'holder')).toEqual({ trailHue: 130 });
    expect(stripUnearnedCosmetics({ trailHue: 130 }, null)).toBeUndefined();
    // bought cosmetics are not the holder check's business
    expect(stripUnearnedCosmetics({ trailHue: 25, shipColor: 'hsl(45, 100%, 60%)' }, null)).toEqual({ trailHue: 25, shipColor: 'hsl(45, 100%, 60%)' });
  });
});

test.describe('tier cosmetics in the game', () => {
  const owns = (page: Page) => page.evaluate(() => {
    const $ = (window as any).$;
    return ['trail_holder', 'color_commander', 'trail_admiral'].map((id) => $.ownsItem(id));
  });

  for (const [tier, expected] of [
    [null, [false, false, false]],
    ['holder', [true, false, false]],
    ['commander', [true, true, false]],
    ['admiral', [true, true, true]],
  ] as const) {
    test(`a ${tier ?? 'non'}-holder owns exactly their tier's cosmetics`, async ({ page }) => {
      await boot(page, { profile: VETERAN, serverProfile: { items: [], consumables: {}, holder: tier } });
      await page.waitForFunction(() => (window as any).$.profile.fetched === 1);
      expect(await owns(page)).toEqual(expected);
    });
  }

  test('locked holder items say which tier unlocks them', async ({ page }) => {
    await boot(page, { profile: VETERAN, serverProfile: { items: [], consumables: {}, holder: null } });
    await goToState(page, 'hangar');
    const tab = page.getByRole('tab', { name: 'Loadout' });
    if (await tab.isVisible().catch(() => false)) await tab.click();
    await expect(page.locator('.rs-rack[data-kind="color"] .rs-slot', { hasText: 'COMMANDER' }).locator('.rs-slot-tag')).toHaveText('Commander+');
    await expect(page.locator('.rs-rack[data-kind="trail"] .rs-slot', { hasText: 'ADMIRAL' }).locator('.rs-slot-tag')).toHaveText('Admiral');
  });

  test('a bought skin stays equipped across a reload (it used to reset to WHITE)', async ({ page }) => {
    // 6 base colors, then owned premium finishes in catalogue order: GOLD is 6
    await boot(page, { profile: { ...VETERAN, ship: 6 }, serverProfile: { items: ['color_gold'], consumables: {}, holder: null } });
    await page.waitForFunction(() => (window as any).$.profile.fetched === 1);
    const title = await page.evaluate(() => {
      const $ = (window as any).$;
      return $.definitions.shipColors[$.storage.ship || 0].title;
    });
    expect(title).toBe('GOLD');
  });

  test('a Commander who sells loses the finish, and the ship falls back to a base color', async ({ page }) => {
    let tier: string | null = 'commander';
    await page.route('**/api/profile*', (r) => json({ items: [], consumables: {}, holder: tier })(r));
    await boot(page, { profile: VETERAN, serverProfile: null });
    await page.waitForFunction(() => (window as any).$.ownsItem('color_commander') === true);
    // equip the COMMANDER finish
    await page.evaluate(() => {
      const $ = (window as any).$;
      $.applyOwnedItems();
      $.storage.ship = $.definitions.shipColors.findIndex((c: any) => c.id === 'color_commander');
    });
    tier = 'holder';
    await page.evaluate(() => (window as any).$.fetchProfile());
    await page.waitForFunction(() => (window as any).$.ownsItem('color_commander') === false);
    const after = await page.evaluate(() => {
      const $ = (window as any).$;
      return { title: $.definitions.shipColors[$.storage.ship || 0].title, listed: $.definitions.shipColors.some((c: any) => c.id === 'color_commander') };
    });
    expect(after.listed).toBe(false);
    expect(after.title).toBe('WHITE');
  });
});

/*--- DUELS early access ----------------------------------------------------------*/
test('DUELS early access: a guest cannot join, and the list is admin-only', async ({ request }) => {
  const g = await (await request.get('/api/duels/early-access')).json();
  expect(g).toEqual({ signedIn: false, minHold: 1_000_000 });
  expect((await request.post('/api/duels/early-access')).status()).toBe(401);
  expect([401, 403]).toContain((await request.get('/api/admin/early-access')).status());
  const list = await (await request.get('/api/admin/early-access', { headers: asAdmin })).json();
  expect(Array.isArray(list.rows)).toBe(true);
});

/*--- $RAIDSHOOTER cup prizes ------------------------------------------------------*/
test.describe('$RAIDSHOOTER cup prizes', () => {
  test('a prize tier keeps a whole-token amount; junk is dropped', () => {
    const s = cleanSeason({ name: 'T', prizes: [
      { fromRank: 1, toRank: 1, usd: 50, tokens: 5_000_000 },
      { fromRank: 2, toRank: 3, tokens: 1_000_000 },
      { fromRank: 4, toRank: 4, tokens: -5 },
      { fromRank: 5, toRank: 5, tokens: 1.5 },
    ] });
    expect(s.prizes).toHaveLength(2);
    expect(s.prizes[0]).toMatchObject({ usd: 50, tokens: 5_000_000 });
    expect(s.prizes[1]).toMatchObject({ tokens: 1_000_000 });
    expect(s.prizes[1].usd).toBeUndefined();
  });

  test('USDC and $RAIDSHOOTER go into separate batches, each paying only its own amount', async () => {
    const season = cleanSeason({ name: 'Split' });
    const rows: WinnerRow[] = [
      { rank: 1, address: '0x' + '11'.repeat(20), score: 9, verified: true, usd: 50, tokens: 5_000_000 },
      { rank: 2, address: '0x' + '22'.repeat(20), score: 8, verified: true, tokens: 1_000_000 },
      { rank: 3, address: 'guest:abc', score: 7, verified: false, tokens: 1_000_000 },
    ];
    const usdc = await createPayoutBatch(season, rows, 'USDC', 'base', 'usdc');
    const rs = await createPayoutBatch(season, rows, '$RAIDSHOOTER', 'base', 'raidshooter');
    expect(usdc!.rows.map((r) => r.rank)).toEqual([1]);
    expect(usdc!.totalUsd).toBe(50);
    // the guest has no wallet to pay
    expect(rs!.rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rs!.totalTokens).toBe(6_000_000);
    expect(rowAmount(rows[0], 'raidshooter')).toBe(5_000_000);
    expect(rowAmount(rows[0], undefined)).toBe(50);
    // nothing to pay in a currency = no batch
    expect(await createPayoutBatch(season, [rows[1]], 'USDC', 'base', 'usdc')).toBeNull();
  });

  test('a $RAIDSHOOTER batch exports against the official contract, in 18 decimals', () => {
    const token = payoutTokenFor({ currency: 'raidshooter' });
    expect(token).toEqual(raidshooterPayoutToken());
    expect(token.address).toBe(OFFICIAL_TOKEN_ADDRESS);
    const d = buildDisperse([{ address: '0x' + '11'.repeat(20), amount: 5_000_000 }], token);
    expect(d.token).toBe(OFFICIAL_TOKEN_ADDRESS);
    expect(d.amounts).toEqual(['5000000' + '0'.repeat(18)]);
    expect(buildCsv([{ address: '0x' + '11'.repeat(20), amount: 5_000_000 }])).toBe(`address,amount\n0x${'11'.repeat(20)},5000000`);
    // an old batch without a currency is still USDC
    expect(payoutTokenFor({}).decimals).toBe(6);
  });

  test('the deck cup card shows a token prize when there is no dollar prize', async ({ page }) => {
    await page.route('**/api/season', json({ season: {
      id: 'c', live: true, name: 'TOKEN CUP', prize1Usd: 0, poolUsd: 0, prize1Tokens: 5_000_000, poolTokens: 7_000_000,
      endsAt: Date.now() + 86_400_000, sponsorName: null, requiredPilotId: null,
      prizes: [{ fromRank: 1, toRank: 1, itemId: null, usd: 0, tokens: 5_000_000 }],
    } }));
    await boot(page, { profile: VETERAN });
    await expect(page.locator('.rs-cup-prize').first()).toHaveText('5M $RS');
  });
});

/*--- Pilot vote ---------------------------------------------------------------*/
test.describe('Pilot vote', () => {
  test('the question and options are validated', () => {
    expect(checkPollInput({ question: 'What next?', options: ['DUELS', 'More skins'] })).toBeNull();
    expect(checkPollInput({ question: 'Hi', options: ['a', 'b'] })).toMatch(/question/);
    expect(checkPollInput({ question: 'What next?', options: ['only one'] })).toMatch(/2 to 5/);
    expect(checkPollInput({ question: 'What next?', options: ['a', 'b', 'c', 'd', 'e', 'f'] })).toMatch(/2 to 5/);
    expect(checkPollInput({ question: 'What next?', options: ['Same', 'same'] })).toMatch(/different/);
  });

  test('one vote each, and holder votes are counted on their own', async () => {
    const poll = await startPoll('What next?', ['DUELS', 'Skins']);
    expect(await castVote(poll, '0xholder', 0, 'admiral')).toBe(true);
    expect(await castVote(poll, '0xholder', 1, 'admiral'), 'a second vote').toBe(false);
    expect(await castVote(poll, 'guest:a', 1, null)).toBe(true);
    expect(await castVote(poll, 'guest:b', 1, null)).toBe(true);
    expect(await myVote(poll, '0xholder')).toBe(0);
    expect(await results(poll)).toEqual({ total: 3, counts: [1, 2], holderTotal: 1, holderCounts: [1, 0] });
  });

  test.describe.serial('end to end', () => {
    const guest = 'pollguest-0123456789';
    test('an admin starts it, a player votes once, the admin closes and removes it', async ({ request }) => {
      expect([401, 403]).toContain((await request.post('/api/admin/poll', { data: { action: 'start', question: 'x?', options: ['a', 'b'] } })).status());
      expect((await request.post('/api/admin/poll', { headers: asAdmin, data: { action: 'start', question: 'Hi', options: ['a'] } })).status()).toBe(400);

      const start = await (await request.post('/api/admin/poll', { headers: asAdmin, data: { action: 'start', question: 'What should the token unlock next?', options: ['DUELS', 'More skins', 'Token cups'] } })).json();
      const id = start.poll.id;

      // before voting there are no results to lean on
      const before = await (await request.get(`/api/poll?guestToken=${guest}`)).json();
      expect(before.poll.question).toBe('What should the token unlock next?');
      expect(before.results).toBeNull();

      const v1 = await (await request.post('/api/poll', { data: { pollId: id, option: 2, guestToken: guest } })).json();
      expect(v1).toMatchObject({ ok: true, counted: true, myVote: 2 });
      expect(v1.results.counts).toEqual([0, 0, 1]);
      const v2 = await (await request.post('/api/poll', { data: { pollId: id, option: 0, guestToken: guest } })).json();
      expect(v2).toMatchObject({ counted: false, myVote: 2 });
      expect(v2.results.total).toBe(1);

      expect((await request.post('/api/poll', { data: { pollId: id, option: 9, guestToken: guest } })).status()).toBe(400);

      await request.post('/api/admin/poll', { headers: asAdmin, data: { action: 'close' } });
      expect((await request.post('/api/poll', { data: { pollId: id, option: 0, guestToken: 'other-guest-000' } })).status()).toBe(409);

      await request.post('/api/admin/poll', { headers: asAdmin, data: { action: 'clear' } });
      expect((await (await request.get('/api/poll')).json()).poll).toBeNull();
    });
  });

  test('on the deck: vote, then see the results and the holder line', async ({ page }) => {
    await page.route('**/api/poll*', (r) => r.request().method() === 'POST'
      ? json({ ok: true, counted: true, myVote: 1, results: { total: 10, counts: [4, 6], holderTotal: 4, holderCounts: [3, 1] } })(r)
      : json({ poll: { id: 'p1', question: 'What next?', options: ['DUELS', 'More skins'], active: true }, myVote: null, results: null })(r));
    await boot(page, { profile: VETERAN });
    const panel = page.locator('.rs-poll');
    await expect(panel).toContainText('What next?');
    await panel.getByRole('button', { name: 'More skins' }).click();
    await expect(panel.locator('.rs-poll-res li[data-mine="1"]')).toContainText('More skins');
    await expect(panel.locator('.rs-poll-res li[data-mine="1"]')).toContainText('60%');
    await expect(panel.locator('.rs-poll-fine')).toContainText('$RAIDSHOOTER holders (4): DUELS 75%, More skins 25%');
  });
});
