import { test, expect } from '@playwright/test';
import { boot, VETERAN } from './support/harness';
import { readTokenInfo, shortAddress, isBaseAddress, OFFICIAL_TOKEN_ADDRESS } from '../src/lib/token';

/*==============================================================================
$RAIDSHOOTER PANEL

The one place players can trust for the contract address is the game itself,
so these pin it: the deck shows exactly the verified Base contract, copies it
in full, and nothing configurable can put a different address there.
==============================================================================*/

const OFFICIAL = '0x0af55bfd094090f787a82666ac6496f66e95cba3';

test.describe('what the panel will show', () => {
  test('the address is the verified Base contract, and nothing overrides it', () => {
    expect(OFFICIAL_TOKEN_ADDRESS).toBe(OFFICIAL);
    expect(isBaseAddress(OFFICIAL_TOKEN_ADDRESS)).toBe(true);
    expect(readTokenInfo({}).address).toBe(OFFICIAL);
    // an env var or stray argument must not be able to swap the "official" address
    expect(readTokenInfo({ address: '0x' + 'a1'.repeat(20) } as never).address).toBe(OFFICIAL);
    expect(readTokenInfo({}).explorerUrl).toBe(`https://basescan.org/token/${OFFICIAL}`);
  });

  test('address validation rejects non-Base formats', () => {
    expect(isBaseAddress('So11111111111111111111111111111111111111112')).toBe(false);
    expect(isBaseAddress('0x123')).toBe(false);
    expect(isBaseAddress('')).toBe(false);
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
    expect(shortAddress(OFFICIAL)).toBe('0x0af5…cba3');
  });
});

test('the deck shows the live token and copies the FULL official address', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page, { profile: VETERAN });
  const panel = page.locator('.rs-token');
  await expect(panel, 'the token panel is not on the command deck').toBeVisible();
  await expect(panel).toContainText('$RAIDSHOOTER');
  await expect(panel).toContainText(/live on base/i);
  await expect(panel.locator('.rs-token-addr')).toHaveText('0x0af5…cba3');
  await panel.locator('.rs-token-copy').click();
  await expect(panel.locator('.rs-token-copy')).toHaveText(/copied/i);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(OFFICIAL);
  const scan = panel.locator('.rs-token-scan');
  await expect(scan).toHaveAttribute('href', `https://basescan.org/token/${OFFICIAL}`);
  await expect(scan).toHaveAttribute('rel', /noopener/);
  await expect(panel, 'no warning about fake addresses').toContainText(/never dm you/i);
});

test('the token panel sits above the DUELS panel, not below it', async ({ page }) => {
  await boot(page, { profile: VETERAN });
  const duelsPanel = page.locator('.rs-panel', { has: page.locator('h2', { hasText: /^Duels$/ }) });
  await expect(duelsPanel).toBeVisible();
  const token = await page.locator('.rs-token').boundingBox();
  const duels = await duelsPanel.boundingBox();
  expect(token && duels, 'a panel did not render').toBeTruthy();
  expect(token!.y).toBeLessThan(duels!.y);
});
