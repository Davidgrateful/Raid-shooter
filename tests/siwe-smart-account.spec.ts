import { test, expect } from '@playwright/test';
import { SiweMessage } from 'siwe';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { toCoinbaseSmartAccount } from 'viem/account-abstraction';
import { verifySiwe } from '../src/lib/siwe-verify';

/*==============================================================================
SIGN-IN WITH A SMART-ACCOUNT WALLET

The bug: email / social login connected, but sign-in never completed. Those
logins give the player a smart-account wallet, whose signature is ERC-6492
(not deployed yet) or ERC-1271 (deployed) - and the server only ever checked
plain EOA signatures. These reproduce it with a real Coinbase smart account
on Base mainnet (the same kind of wallet), then prove the fix accepts it -
and still refuses what it must.
==============================================================================*/

const message = (address: string, over: Partial<{ chainId: number; expirationTime: string }> = {}) =>
  new SiweMessage({
    domain: 'raidshooter.xyz',
    address,
    statement: 'Sign in to Raid Shooter',
    uri: 'https://raidshooter.xyz',
    version: '1',
    chainId: over.chainId ?? 8453,
    nonce: 'abcdefgh12345678',
    ...(over.expirationTime ? { expirationTime: over.expirationTime } : {}),
  }).prepareMessage();

const baseClient = createPublicClient({ chain: base, transport: http(undefined, { timeout: 10_000 }) });
async function chainReachable(): Promise<boolean> {
  try { return (await baseClient.getChainId()) === 8453; } catch { return false; }
}

test('a plain wallet still signs in, with no network needed', async () => {
  const eoa = privateKeyToAccount(generatePrivateKey());
  const msg = message(eoa.address);
  const sig = await eoa.signMessage({ message: msg });
  const r = await verifySiwe(msg, sig, { client: () => { throw new Error('must not touch the chain'); } });
  expect(r.ok && r.via).toBe('eoa');
});

test.describe('a smart-account wallet (as email / social login creates)', () => {
  test.beforeEach(async () => {
    test.skip(!(await chainReachable()), 'Base mainnet RPC unreachable from this runner');
  });

  test('the OLD check refused it - the bug, reproduced', async () => {
    const account = await toCoinbaseSmartAccount({ client: baseClient, owners: [privateKeyToAccount(generatePrivateKey())], version: '1.1' });
    const msg = message(account.address);
    const sig = await account.signMessage({ message: msg });
    await expect(new SiweMessage(msg).verify({ signature: sig })).rejects.toBeTruthy();
  });

  test('the new check accepts it, verified by the chain', async () => {
    const account = await toCoinbaseSmartAccount({ client: baseClient, owners: [privateKeyToAccount(generatePrivateKey())], version: '1.1' });
    const msg = message(account.address);
    const sig = await account.signMessage({ message: msg });
    const r = await verifySiwe(msg, sig);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(r.ok && r.via).toBe('contract');
    expect(r.ok && r.fields.address.toLowerCase()).toBe(account.address.toLowerCase());
  });

  test("one smart account cannot sign in as another", async () => {
    const mine = await toCoinbaseSmartAccount({ client: baseClient, owners: [privateKeyToAccount(generatePrivateKey())], version: '1.1' });
    const theirs = await toCoinbaseSmartAccount({ client: baseClient, owners: [privateKeyToAccount(generatePrivateKey())], version: '1.1' });
    const msg = message(theirs.address);
    const sig = await mine.signMessage({ message: msg });
    const r = await verifySiwe(msg, sig);
    expect(r.ok).toBe(false);
  });
});

test.describe('the fallback keeps every other rule', () => {
  const always = () => ({ verifyMessage: async () => true });
  const someone = '0x' + '12'.repeat(20);

  test('an expired message is refused even if the chain would accept the signature', async () => {
    const msg = message(someone, { expirationTime: new Date(Date.now() - 60_000).toISOString() });
    expect(await verifySiwe(msg, '0x1234', { client: always })).toEqual({ ok: false, reason: 'expired' });
  });

  test('only Base and Base Sepolia are asked', async () => {
    const msg = message(someone, { chainId: 1 });
    expect(await verifySiwe(msg, '0x1234')).toEqual({ ok: false, reason: 'unsupported_chain' });
  });

  test('a chain that says no is a no; a chain that is down is not a yes', async () => {
    const msg = message(someone);
    expect(await verifySiwe(msg, '0x1234', { client: () => ({ verifyMessage: async () => false }) })).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifySiwe(msg, '0x1234', { client: () => ({ verifyMessage: async () => { throw new Error('rpc down'); } }) })).toEqual({ ok: false, reason: 'chain_unavailable' });
    expect(await verifySiwe('not a siwe message', '0x1234', { client: always })).toEqual({ ok: false, reason: 'malformed_message' });
  });
});
