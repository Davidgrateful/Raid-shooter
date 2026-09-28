import { test, expect, type Page, type Route } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';
import { tokensPerUsd, tokenPrice, toRaw, receiptPaysToken, TRANSFER_TOPIC } from '../src/lib/tokenpay';
import { OFFICIAL_TOKEN_ADDRESS } from '../src/lib/token';

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

async function armory(page: Page, tokenOn: boolean) {
  const items = [
    { id: 'pilot_solstice', title: 'SOLSTICE PILOT', kind: 'character', priceUsd: 1, priceEth: '0.00033', ...(tokenOn ? { priceToken: 8_450_000 } : {}) },
    { id: 'trail_ember', title: 'EMBER ENGINE TRAIL', kind: 'trail', priceUsd: 0.3, priceEth: '0.0001', ...(tokenOn ? { priceToken: 2_535_000 } : {}) },
  ];
  await page.route('**/api/market', json({
    enabled: true, treasury: TREASURY, network: 'base',
    token: tokenOn ? { enabled: true, address: OFFICIAL_TOKEN_ADDRESS } : { enabled: false },
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
