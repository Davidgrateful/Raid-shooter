import { test, expect, type Page, type Route } from '@playwright/test';
import { boot, goToState, VETERAN } from './support/harness';
import { holderTiers, tierFor, balanceOfCall, wholeTokens, readBalance } from '../src/lib/holder';
import { OFFICIAL_TOKEN_ADDRESS, compactTokens } from '../src/lib/token';

/*==============================================================================
$RAIDSHOOTER HOLDER PERKS

A wallet's tier comes from its on-chain balance; the perks are a board badge
and a hangar trail, both cosmetic. These pin the tier maths, the chain read,
what the deck tells a guest / a holder / a non-holder, and that the badge and
trail only appear for a holder.
==============================================================================*/

const TIERS = [
  { id: 'holder', label: 'Holder', min: 1_000_000 },
  { id: 'commander', label: 'Commander', min: 50_000_000 },
  { id: 'admiral', label: 'Admiral', min: 500_000_000 },
];
const json = (body: unknown) => (r: Route) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('tier maths and the chain read', () => {
  test('default tiers, and a valid override', () => {
    expect(holderTiers(undefined)).toEqual(TIERS);
    expect(holderTiers('10,20,30').map((t) => t.min)).toEqual([10, 20, 30]);
  });

  test('a malformed override falls back to the defaults instead of breaking', () => {
    for (const bad of ['', '5', '30,20,10', '1,2,x', '0,1,2', '-1,2,3', '1,2,3,4']) {
      expect(holderTiers(bad).map((t) => t.min), bad).toEqual([1_000_000, 50_000_000, 500_000_000]);
    }
  });

  test('tier boundaries are inclusive and cumulative', () => {
    expect(tierFor(0, TIERS as never)).toBeNull();
    expect(tierFor(999_999, TIERS as never)).toBeNull();
    expect(tierFor(1_000_000, TIERS as never)).toBe('holder');
    expect(tierFor(49_999_999, TIERS as never)).toBe('holder');
    expect(tierFor(50_000_000, TIERS as never)).toBe('commander');
    expect(tierFor(500_000_000, TIERS as never)).toBe('admiral');
    expect(tierFor(90_000_000_000, TIERS as never)).toBe('admiral');
  });

  test('balanceOf calldata and 18-decimal decoding', () => {
    const who = '0x' + 'AB'.repeat(20);
    expect(balanceOfCall(who)).toBe('0x70a08231' + '0'.repeat(24) + 'ab'.repeat(20));
    expect(wholeTokens('0x')).toBe(0);
    expect(wholeTokens('0x' + (BigInt(12_400_000) * BigInt(10) ** BigInt(18)).toString(16))).toBe(12_400_000);
    // fractions floor - 0.9 of a token is not a token
    expect(wholeTokens('0x' + (BigInt(9) * BigInt(10) ** BigInt(17)).toString(16))).toBe(0);
    expect(() => wholeTokens('nonsense')).toThrow();
  });

  test('the read asks the OFFICIAL contract, for the given wallet', async () => {
    let sent: { params: [{ to: string; data: string }, string] } | null = null;
    const fake = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      const raw = BigInt(75_000_000) * BigInt(10) ** BigInt(18);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x' + raw.toString(16) }));
    }) as unknown as typeof fetch;
    const who = '0x' + '12'.repeat(20);
    expect(await readBalance(who, fake)).toBe(75_000_000);
    expect(sent!.params[0].to).toBe(OFFICIAL_TOKEN_ADDRESS);
    expect(sent!.params[0].data).toBe(balanceOfCall(who));
  });

  test('an RPC error is an error, never a zero balance', async () => {
    const fake = (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000 } }))) as unknown as typeof fetch;
    await expect(readBalance('0x' + '12'.repeat(20), fake)).rejects.toThrow();
  });

  test('compact token amounts', () => {
    expect(compactTokens(1_000_000)).toBe('1M');
    expect(compactTokens(12_400_000)).toBe('12.4M');
    expect(compactTokens(500_000_000)).toBe('500M');
    expect(compactTokens(250_000)).toBe('250K');
    expect(compactTokens(2_500_000_000)).toBe('2.5B');
    expect(compactTokens(42)).toBe('42');
  });
});

test('a guest gets the tier ladder only - no balance is read without a signed-in wallet', async ({ request }) => {
  const res = await request.get('/api/token/holder');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.signedIn).toBe(false);
  expect(body.tiers).toEqual(TIERS);
  expect(body).not.toHaveProperty('balance');
});

async function deckWithHolder(page: Page, holder: unknown) {
  await page.route('**/api/token/holder*', json(holder));
  await boot(page, { profile: VETERAN });
  return page.locator('.rs-token .rs-hold');
}

test.describe('the deck explains the perks', () => {
  test('a guest sees the ladder and a way to sign in', async ({ page }) => {
    const hold = await deckWithHolder(page, { signedIn: false, tiers: TIERS });
    await expect(hold).toBeVisible();
    await expect(hold.locator('.rs-hold-ladder li')).toHaveCount(3);
    await expect(hold.locator('.rs-hold-ladder')).toContainText('1M+');
    await expect(hold.locator('.rs-hold-ladder')).toContainText('500M+');
    await expect(hold.locator('.rs-hold-ladder li[data-on="1"]')).toHaveCount(0);
    await expect(hold.locator('.rs-hold-signin')).toBeVisible();
    await hold.locator('.rs-hold-how summary').click();
    await expect(hold.locator('.rs-hold-how')).toContainText(/never changes a run, a score or a rank/i);
  });

  test('a Commander sees their balance and their tier lit', async ({ page }) => {
    const hold = await deckWithHolder(page, { signedIn: true, tiers: TIERS, checked: true, balance: 72_300_000, tier: 'commander' });
    await expect(hold.locator('.rs-hold-status')).toContainText('72.3M');
    await expect(hold.locator('.rs-hold-status')).toContainText('Commander');
    await expect(hold.locator('.rs-hold-ladder li[data-on="1"]')).toHaveCount(1);
    await expect(hold.locator('.rs-hold-ladder li[data-on="1"]')).toContainText('Commander');
  });

  test('a small holder is told exactly what unlocks it', async ({ page }) => {
    const hold = await deckWithHolder(page, { signedIn: true, tiers: TIERS, checked: true, balance: 250_000, tier: null });
    await expect(hold.locator('.rs-hold-status')).toContainText('250K');
    await expect(hold.locator('.rs-hold-status')).toContainText('Hold 1M+ to unlock');
    await expect(hold.locator('.rs-hold-ladder li[data-on="1"]')).toHaveCount(0);
  });

  test('when Base cannot be read, the panel says so instead of showing zero', async ({ page }) => {
    const hold = await deckWithHolder(page, { signedIn: true, tiers: TIERS, checked: false, balance: null, tier: null });
    await expect(hold.locator('.rs-hold-status')).toContainText(/couldn.t reach base/i);
    await expect(hold.locator('.rs-hold-status')).not.toContainText('You hold 0');
  });
});

test('the board shows the $ badge for holders only, by tier', async ({ page }) => {
  const row = (address: string, name: string, score: number, holder?: string) =>
    ({ address, name, score, level: 3, kills: 10, combo: 1, pilot: 'ONYIX', time: 60, at: 1, verified: true, ...(holder ? { holder } : {}) });
  await boot(page, {
    profile: VETERAN,
    board: {
      entries: [
        row('0x' + '11'.repeat(20), 'ADMIRALA', 9000, 'admiral'),
        row('0x' + '22'.repeat(20), 'COMMANDB', 8000, 'commander'),
        row('0x' + '33'.repeat(20), 'HOLDERC', 7000, 'holder'),
        row('0x' + '44'.repeat(20), 'PLAINDD', 6000),
        row('0x' + '55'.repeat(20), 'FORGEDEE', 5000, 'emperor'),
      ],
      total: 5,
      persistent: true,
    },
  });
  await goToState(page, 'board');
  const chips = page.locator('.rs-holder-chip');
  await expect(chips).toHaveCount(3);
  await expect(page.locator('.rs-holder-chip[data-tier="admiral"]')).toHaveAttribute('title', '$RAIDSHOOTER Admiral');
  await expect(page.locator('.rs-holder-chip[data-tier="commander"]')).toHaveCount(1);
  await expect(page.locator('.rs-holder-chip[data-tier="holder"]')).toHaveCount(1);
});

// Phones show the hangar's systems and loadout as tabs; wider screens show both.
async function openLoadout(page: Page) {
  const tab = page.getByRole('tab', { name: 'Loadout' });
  if (await tab.isVisible().catch(() => false)) await tab.click();
}

test.describe('the HOLDER trail', () => {
  test('is locked and marked for holders when the wallet holds nothing', async ({ page }) => {
    await boot(page, { profile: VETERAN, serverProfile: { items: [], consumables: {}, holder: null } });
    expect(await page.evaluate(() => (window as any).$.ownsItem('trail_holder'))).toBe(false);
    await goToState(page, 'hangar');
    await openLoadout(page);
    const slot = page.locator('.rs-rack[data-kind="trail"] .rs-slot', { hasText: 'HOLDER' });
    await expect(slot).toBeVisible();
    await expect(slot).toHaveAttribute('data-locked', '1');
    await expect(slot.locator('.rs-slot-tag')).toHaveText('Holders');
  });

  test('unlocks for a holder, and is dropped again once they no longer hold', async ({ page }) => {
    let holder: string | null = 'holder';
    await page.route('**/api/profile*', (r) => json({ items: [], consumables: {}, holder })(r));
    await boot(page, { profile: VETERAN, serverProfile: null });
    await page.waitForFunction(() => (window as any).$.ownsItem('trail_holder') === true);
    await goToState(page, 'hangar');
    await openLoadout(page);
    const slot = page.locator('.rs-rack[data-kind="trail"] .rs-slot', { hasText: 'HOLDER' });
    await expect(slot).toHaveAttribute('data-locked', '0');
    await slot.click();
    expect(await page.evaluate(() => (window as any).$.equippedTrail()?.id)).toBe('trail_holder');

    // sold below the first tier: the next profile read takes the trail away
    holder = null;
    await page.evaluate(() => (window as any).$.fetchProfile());
    await page.waitForFunction(() => (window as any).$.ownsItem('trail_holder') === false);
    expect(await page.evaluate(() => (window as any).$.equippedTrail())).toBeNull();
  });
});
