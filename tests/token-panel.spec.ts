import { test, expect } from '@playwright/test';
import { boot, VETERAN } from './support/harness';
import { readTokenInfo, shortAddress } from '../src/lib/token';

/*==============================================================================
$RAIDSHOOTER PANEL

The one place players can trust for the contract address is the game itself,
so these pin two things: the panel never shows an address that is not a real
Base contract, and before launch it shows none at all.
==============================================================================*/

const REAL = '0x' + 'a1'.repeat(20);

test.describe('what the panel will accept', () => {
  test('a Base contract address is shown; anything else is treated as unset', () => {
    expect(readTokenInfo({ address: REAL }).address).toBe(REAL);
    expect(readTokenInfo({ address: `  ${REAL}  ` }).address, 'surrounding spaces from a Vercel paste').toBe(REAL);
    // an address from another chain must never appear as "official" here
    expect(readTokenInfo({ address: 'So11111111111111111111111111111111111111112' }).address).toBeNull();
    expect(readTokenInfo({ address: '0x123' }).address).toBeNull();
    expect(readTokenInfo({ address: '' }).address).toBeNull();
  });

  test('the chain defaults to Base', () => {
    expect(readTokenInfo({}).chain).toBe('Base');
    expect(readTokenInfo({ chain: 'Base' }).chain).toBe('Base');
  });

  test('only a plain https buy link survives', () => {
    expect(readTokenInfo({ buyUrl: 'https://app.uniswap.org/swap' }).buyUrl).toBe('https://app.uniswap.org/swap');
    expect(readTokenInfo({ buyUrl: 'http://insecure.example' }).buyUrl).toBeNull();
    expect(readTokenInfo({ buyUrl: 'javascript:alert(1)' }).buyUrl).toBeNull();
    expect(readTokenInfo({ buyUrl: 'not a url' }).buyUrl).toBeNull();
  });

  test('the short form is recognisable, never ambiguous', () => {
    expect(shortAddress(REAL)).toBe('0xa1a1…a1a1');
  });
});

test('before launch the deck announces the token and shows no address', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  const panel = page.locator('.rs-token');
  await expect(panel, 'the token panel is not on the command deck').toBeVisible();
  await expect(panel).toContainText('$RAIDSHOOTER');
  await expect(panel).toContainText(/launching on base/i);
  await expect(panel, 'no warning about fake addresses').toContainText(/only here/i);
  await expect(panel.locator('.rs-token-addr'), 'an address appeared with none configured').toHaveCount(0);
  await expect(panel.locator('.rs-token-buy'), 'a buy link appeared with none configured').toHaveCount(0);
});

test('the token panel sits above the DUELS teaser, not below it', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  const token = await page.locator('.rs-token').boundingBox();
  const duels = await page.locator('.rs-soon').boundingBox();
  expect(token && duels, 'a panel did not render').toBeTruthy();
  expect(token!.y).toBeLessThan(duels!.y);
});
