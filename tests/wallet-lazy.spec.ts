import { test, expect } from '@playwright/test';
import { boot } from './support/harness';

/*==============================================================================
THE WALLET LOADS ON DEMAND

The wallet SDK (wagmi + AppKit + WalletConnect) was about 2.8 MB of the 4.5 MB
of JavaScript a player downloaded before the command deck drew, and most
players never connect a wallet. It now loads when it is needed
(src/lib/walletStore.ts). The wallet shell puts the SDK's phase on <html> as
data-rs-wallet (idle / loading / ready / failed), which is what these read.
==============================================================================*/

const sdkLoaded = () => document.documentElement.dataset.rsWallet === 'ready';

test('a guest plays without the wallet SDK, and Connect Wallet still opens the wallet modal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(sdkLoaded), 'the wallet SDK loaded for a guest who never asked for it').toBe(false);

  const connect = page.getByRole('button', { name: 'Connect Wallet' }).first();
  await expect(connect).toBeVisible();
  await connect.evaluate((b) => (b as HTMLButtonElement).click());
  await page.waitForFunction(() => !!document.querySelector('w3m-modal'), null, { timeout: 30000 });
  expect(await page.evaluate(sdkLoaded)).toBe(true);
  // the game was not remounted underneath: still on the deck, same engine
  expect(await page.evaluate(() => (window as any).$.state)).toBe('menu');
  expect(errors).toEqual([]);
});

test('a signed-in player shows as signed in at once, and their wallet SDK follows after boot', async ({ page }) => {
  await page.route('**/api/siwe/session', (r) =>
    r.fulfill({ json: { authenticated: true, address: '0x1234567890abcdef1234567890abcdef12345678' } }));
  await boot(page);
  // before the SDK: the session alone says who they are (the chip, not Connect)
  const early = await page.evaluate(() => document.documentElement.dataset.rsWallet);
  if (early !== 'ready') await expect(page.getByText('0x1234…5678').first()).toBeVisible();
  await page.waitForFunction(() => document.documentElement.dataset.rsWallet === 'ready', null, { timeout: 30000 });
});

test('a purchase started before the SDK is here is held and handed over, not dropped', async ({ page }) => {
  await boot(page);
  const outcome = page.evaluate(() => new Promise<string>((resolve) => {
    window.addEventListener('raidshooter:purchase', (e) => resolve(String((e as CustomEvent).detail?.status)), { once: true });
    window.dispatchEvent(new CustomEvent('raidshooter:buy', {
      detail: { itemId: 'test_item', priceEth: '0.001', treasury: '0x000000000000000000000000000000000000dEaD', network: 'baseSepolia' },
    }));
  }));
  // no wallet is connected here, so the purchase cannot complete - but it must
  // reach the purchase bridge and come back with a status, not vanish
  expect(await outcome).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.dataset.rsWallet)).toBe('ready');
});
