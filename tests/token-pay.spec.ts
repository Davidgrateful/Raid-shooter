import { test, expect, type Page, type Route } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';
import { tokensPerUsd, tokenPrice, toRaw, receiptPaysToken, TRANSFER_TOPIC, minAcceptable, checkConfigInput, RATE_GRACE_MS, type TokenPayConfig } from '../src/lib/tokenpay';
import { OFFICIAL_TOKEN_ADDRESS } from '../src/lib/token';
import { trackPurchase, getMarketStats, getRecentBuys } from '../src/lib/stats';

/*==============================================================================
PAYING IN $RAIDSHOOTER

The server grants an item for a token payment only when the confirmed receipt
carries a Transfer event from the OFFICIAL contract, from the signed-in wallet,
to the treasury, for at least the quoted price. These pin that check field by
field, the pricing maths, that checkout stays off until the operator sets a
rate, and that the Armory hands the right payment to the wallet.
==============================================================================*/

const PLAYER = '0x' + 'a1'.repeat(20);
const TREASURY = '0x' + 'd7'.repeat(20);
const pad = (a: string) => '0x' + a.replace(/^0x/, '').padStart(64, '0');
const transfer = (over: Partial<{ address: string; from: string; to: string; amount: bigint; topic: string }> = {}) => ({
  address: over.address ?? OFFICIAL_TOKEN_ADDRESS,
  topics: [over.topic ?? TRANSFER_TOPIC, pad(over.from ?? PLAYER), pad(over.to ?? TREASURY)],
  data: '0x' + (over.amount ?? toRaw(2_535_000)).toString(16).padStart(64, '0'),
});
const pays = (logs: unknown[], status = '0x1', minRaw = toRaw(2_535_000)) =>
  receiptPaysToken({ status, logs } as never, { from: PLAYER, to: TREASURY, minRaw });

test.describe('pricing', () => {
  test('the rate is off until it is a sane positive number', () => {
    expect(tokensPerUsd(undefined)).toBeNull();
    for (const bad of ['', 'abc', '0', '-5', 'Infinity', '1e20']) expect(tokensPerUsd(bad), bad).toBeNull();
    expect(tokensPerUsd('8450000')).toBe(8_450_000);
    expect(tokensPerUsd(' 8450000 ')).toBe(8_450_000);
  });

  test('token price = USD price x rate, rounded UP to a whole token', () => {
    expect(tokenPrice(0.3, 8_450_000)).toBe(2_535_000);
    expect(tokenPrice(0.99, 8_450_000)).toBe(8_365_500);
    expect(tokenPrice(1, 8_450_000)).toBe(8_450_000);
    // never rounds a payment down: 0.3 x 3 = 0.9 -> 1 token
    expect(tokenPrice(0.3, 3)).toBe(1);
    expect(tokenPrice(0.3, null)).toBeNull();
    expect(tokenPrice(0, 8_450_000)).toBeNull();
  });
});

test.describe('the discount and rate changes', () => {
  test('a pay-in-token discount comes off the token price, capped at 50%', () => {
    expect(tokenPrice(1, 8_450_000, 20)).toBe(6_760_000);
    expect(tokenPrice(0.3, 8_450_000, 20)).toBe(2_028_000);
    expect(tokenPrice(1, 8_450_000, 90), 'capped').toBe(4_225_000);
    expect(tokenPrice(1, 8_450_000, -5), 'never a surcharge').toBe(8_450_000);
  });

  const cfg = (over: Partial<TokenPayConfig> = {}): TokenPayConfig =>
    ({ enabled: true, perUsd: 10_000_000, discountPct: 0, source: 'admin', ...over });

  test('right after a rate rise, a payment at the old (lower) price still counts', () => {
    const now = 1_000_000_000;
    const raised = cfg({ updatedAt: now - 60_000, prev: { perUsd: 8_000_000, discountPct: 0 } });
    expect(minAcceptable(1, raised, now)).toBe(8_000_000);
    // ...but only for the grace window
    expect(minAcceptable(1, raised, now - 60_000 + RATE_GRACE_MS + 1)).toBe(10_000_000);
  });

  test('after a rate cut, the new lower price is what counts', () => {
    const now = 1_000_000_000;
    const cut = cfg({ updatedAt: now - 60_000, prev: { perUsd: 12_000_000, discountPct: 0 } });
    expect(minAcceptable(1, cut, now)).toBe(10_000_000);
  });

  test('switched off means no token price at all', () => {
    expect(minAcceptable(1, cfg({ enabled: false }))).toBeNull();
  });

  test('the admin input is validated', () => {
    expect(checkConfigInput({ enabled: true, perUsd: 8_450_000, discountPct: 20 })).toBeNull();
    expect(checkConfigInput({ enabled: false, perUsd: null, discountPct: 0 }), 'off needs no rate').toBeNull();
    expect(checkConfigInput({ enabled: true, perUsd: 0, discountPct: 0 })).toMatch(/rate/);
    expect(checkConfigInput({ enabled: true, perUsd: 'abc', discountPct: 0 })).toMatch(/rate/);
    expect(checkConfigInput({ enabled: true, perUsd: 1, discountPct: 51 })).toMatch(/discount/);
    expect(checkConfigInput({ enabled: true, perUsd: 1, discountPct: 2.5 })).toMatch(/discount/);
    expect(checkConfigInput({ enabled: 'yes', perUsd: 1, discountPct: 0 })).toMatch(/enabled/);
  });
});

test.describe('the receipt check', () => {
  test('a transfer of the full price from the player to the treasury is accepted', () => {
    expect(pays([transfer()])).toBe(true);
    expect(pays([transfer({ amount: toRaw(3_000_000) })]), 'overpaying is fine').toBe(true);
  });

  test('every field is checked', () => {
    expect(pays([transfer()], '0x0'), 'reverted tx').toBe(false);
    expect(pays([transfer({ address: '0x' + '99'.repeat(20) })]), 'a look-alike token').toBe(false);
    expect(pays([transfer({ from: '0x' + '55'.repeat(20) })]), 'someone else paid').toBe(false);
    expect(pays([transfer({ to: '0x' + '66'.repeat(20) })]), 'paid to another address').toBe(false);
    expect(pays([transfer({ amount: toRaw(2_534_999) })]), 'one token short').toBe(false);
    expect(pays([transfer({ topic: '0x' + '0'.repeat(64) })]), 'not a Transfer event').toBe(false);
    expect(pays([]), 'no logs').toBe(false);
    expect(receiptPaysToken(null, { from: PLAYER, to: TREASURY, minRaw: BigInt(1) }), 'no receipt').toBe(false);
  });

  test('split transfers in one tx add up; malformed data does not', () => {
    const half = toRaw(2_535_000) / BigInt(2);
    expect(pays([transfer({ amount: half }), transfer({ amount: toRaw(2_535_000) - half })])).toBe(true);
    expect(pays([{ ...transfer(), data: 'nonsense' }])).toBe(false);
  });

  test('addresses match regardless of checksum case', () => {
    const upper = { ...transfer(), address: OFFICIAL_TOKEN_ADDRESS.toUpperCase().replace('0X', '0x') };
    expect(pays([upper])).toBe(true);
  });
});

test('token checkout is off by default, and a token claim is refused without a wallet', async ({ request }) => {
  const market = await (await request.get('/api/market')).json();
  expect(market.token).toEqual({ enabled: false });
  expect(market.items.some((i: { priceToken?: number }) => i.priceToken !== undefined)).toBe(false);
  const res = await request.post('/api/market/verify', {
    data: { itemId: 'trail_ember', txHash: '0x' + '1'.repeat(64), currency: 'token' },
  });
  expect([401, 503]).toContain(res.status());
});

/*--- the Armory --------------------------------------------------------------*/
const json = (body: unknown) => (r: Route) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function armory(page: Page, tokenOn: boolean, opts: { discountPct?: number; balance?: number } = {}) {
  if (opts.balance !== undefined) {
    await page.route('**/api/token/holder*', json({ signedIn: true, tiers: [], checked: true, balance: opts.balance, tier: null }));
  }
  const items = [
    { id: 'pilot_solstice', title: 'SOLSTICE PILOT', kind: 'character', priceUsd: 1, priceEth: '0.00033', ...(tokenOn ? { priceToken: 8_450_000 } : {}) },
    { id: 'trail_ember', title: 'EMBER ENGINE TRAIL', kind: 'trail', priceUsd: 0.3, priceEth: '0.0001', ...(tokenOn ? { priceToken: 2_535_000 } : {}) },
  ];
  await page.route('**/api/market', json({
    enabled: true, treasury: TREASURY, network: 'base',
    token: tokenOn ? { enabled: true, address: OFFICIAL_TOKEN_ADDRESS, discountPct: opts.discountPct ?? 0 } : { enabled: false },
    items,
  }));
  await page.route('**/api/siwe/session*', json({ authenticated: true, address: PLAYER }));
  await boot(page, { profile: VETERAN });
  // record what the Armory hands the wallet bridge, and keep it from going on
  await page.evaluate(() => {
    (window as any).__buys = [];
    window.addEventListener('raidshooter:buy', (e) => {
      (window as any).__buys.push((e as CustomEvent).detail);
      e.stopImmediatePropagation();
    }, { capture: true });
  });
  await goToState(page, 'market', 2500);
  await page.locator('.rs-am-slot', { hasText: 'SOLSTICE' }).first().click();
}

test('the Armory offers $RAIDSHOOTER checkout and sends the quoted token payment', async ({ page }) => {
  await armory(page, true);
  const pay = page.locator('.rs-am-token-pay');
  await expect(pay).toBeVisible();
  await expect(pay).toContainText('8.45M');
  await expect(pay).toHaveAttribute('title', '8,450,000 $RAIDSHOOTER');
  await pay.click();
  const buys = await page.evaluate(() => (window as any).__buys);
  expect(buys).toHaveLength(1);
  expect(buys[0]).toMatchObject({
    itemId: 'pilot_solstice', currency: 'token', priceToken: '8450000',
    tokenAddress: OFFICIAL_TOKEN_ADDRESS, treasury: TREASURY, network: 'base',
  });
});

test('with token checkout off, the Armory shows only the ETH buy', async ({ page }) => {
  await armory(page, false);
  await expect(page.locator('.rs-am-cta')).toBeVisible();
  await expect(page.locator('.rs-am-token-pay')).toHaveCount(0);
});

test('the discount shows on the pay button', async ({ page }) => {
  await armory(page, true, { discountPct: 20 });
  await expect(page.locator('.rs-am-token-pay .rs-am-token-off')).toHaveText('-20%');
});

test('a player short of tokens is told so, with a way to get them', async ({ page }) => {
  await armory(page, true, { balance: 250_000 });
  const bal = page.locator('.rs-am-token-bal');
  await expect(bal).toContainText('You have 250K $RAIDSHOOTER');
  await expect(bal).toContainText('not enough');
  await expect(bal).toHaveAttribute('data-short', '1');
  const get = bal.getByRole('link', { name: 'Get $RAIDSHOOTER' });
  await expect(get).toHaveAttribute('href', new RegExp(`outputCurrency=${OFFICIAL_TOKEN_ADDRESS}`));
  await expect(get).toHaveAttribute('rel', /noopener/);
});

test('a player with enough tokens just sees their balance', async ({ page }) => {
  await armory(page, true, { balance: 90_000_000 });
  const bal = page.locator('.rs-am-token-bal');
  await expect(bal).toContainText('You have 90M $RAIDSHOOTER');
  await expect(bal).toHaveAttribute('data-short', '0');
  await expect(bal.getByRole('link')).toHaveCount(0);
});

/*--- the admin Token tab's API ---------------------------------------------*/
const ADMIN = process.env.ADMIN_STATS_TOKEN || 'test-admin-token-0123456789';
const asAdmin = { Authorization: `Bearer ${ADMIN}` };

test.describe.serial('admin: token checkout controls', () => {
  test('are closed to anyone without admin rights', async ({ request }) => {
    expect([401, 403]).toContain((await request.get('/api/admin/tokenpay')).status());
    const res = await request.post('/api/admin/tokenpay', { data: { enabled: true, perUsd: 1, discountPct: 0 } });
    expect([401, 403]).toContain(res.status());
  });

  test('refuse a bad rate, save a good one, and say why it is not live yet', async ({ request }) => {
    const bad = await request.post('/api/admin/tokenpay', { headers: asAdmin, data: { enabled: true, perUsd: 0, discountPct: 0 } });
    expect(bad.status()).toBe(400);

    const ok = await request.post('/api/admin/tokenpay', { headers: asAdmin, data: { enabled: true, perUsd: 8_450_000, discountPct: 20 } });
    expect(ok.status()).toBe(200);
    const v = await ok.json();
    expect(v.config).toMatchObject({ enabled: true, perUsd: 8_450_000, discountPct: 20, source: 'admin' });
    // the test server has no treasury: saved, but honestly not live, and it says why
    expect(v.live).toBe(false);
    expect(v.blockers.join(' ')).toMatch(/treasury/i);
    // the preview uses the saved rate and discount: a $0.30 item at 20% off
    const cheapest = v.samples[0];
    expect(cheapest.priceToken).toBe(tokenPrice(cheapest.priceUsd, 8_450_000, 20));

    // nothing reaches players while it is not live
    expect((await (await request.get('/api/market')).json()).token).toEqual({ enabled: false });

    // and the change is on the record
    const log = await (await request.get('/api/admin/audit', { headers: asAdmin })).json();
    const rows = (log.entries || log.audit || log) as { action: string; detail?: string }[];
    expect(rows.some((r) => r.action === 'tokenpay.update' && /8,450,000/.test(r.detail || ''))).toBe(true);
  });

  test('switch back off', async ({ request }) => {
    const off = await request.post('/api/admin/tokenpay', { headers: asAdmin, data: { enabled: false, perUsd: 8_450_000, discountPct: 20 } });
    expect(off.status()).toBe(200);
    expect((await off.json()).config.enabled).toBe(false);
  });
});

test('a token purchase is recorded as one: tokens received, and its value at the operator rate', async () => {
  const before = await getMarketStats(1);
  await trackPurchase('wallet:0xabc', { id: 'pilot_solstice', priceUsd: 1 }, { currency: 'token', tokens: 6_760_000, discountPct: 20 });
  await trackPurchase('wallet:0xdef', { id: 'trail_ember', priceUsd: 0.3 });
  const after = await getMarketStats(1);
  expect(after.tokenPurchasesAllTime - before.tokenPurchasesAllTime).toBe(1);
  expect(after.tokensReceivedAllTime - before.tokensReceivedAllTime).toBe(6_760_000);
  expect(after.purchasesAllTime - before.purchasesAllTime).toBe(2);
  // $1 list at 20% off counts as $0.80; the ETH buy at its list price
  expect(Math.round((after.revenueUsdAllTime - before.revenueUsdAllTime) * 100)).toBe(110);
  const [eth, tok] = await getRecentBuys(2);
  expect(eth).toMatchObject({ itemId: 'trail_ember', priceUsd: 0.3 });
  expect(eth.currency).toBeUndefined();
  expect(tok).toMatchObject({ itemId: 'pilot_solstice', currency: 'token', tokens: 6_760_000, priceUsd: 0.8 });
});
