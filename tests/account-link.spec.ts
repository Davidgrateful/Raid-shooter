import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { SiweMessage } from 'siwe';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { linkStatement } from '../src/lib/linkMessage';

/*==============================================================================
LINKED SIGN-INS

Players with an account on one wallet asked to also sign in with Google or
email - an embedded wallet, so a different address and, until now, a
separate empty account (and the reverse). /api/account/link attaches a second
sign-in to an account. These drive it end to end with real signatures from
throwaway keys:

  - linking needs the account's session AND a fresh signature from the new
    address naming that account; a replay, a wrong statement or a signature
    from elsewhere is refused
  - afterwards signing in with the new address opens the original account,
    and what the new address already held has merged in
  - a sign-in linked to one account cannot be linked to another, nor can an
    account be folded into its own link
  - removing a link makes that address its own account again
  - admin rights never come through a linked sign-in

API project: it shares no viewport with anything.
==============================================================================*/

const ADMIN = { Authorization: `Bearer ${process.env.ADMIN_STATS_TOKEN || 'test-admin-token-0123456789'}` };

function key() { return privateKeyToAccount(generatePrivateKey()); }
type Key = ReturnType<typeof key>;

/*
 * One player's browser session. `next start` runs in production mode, where
 * the session cookie is Secure, and an http test client never sends a Secure
 * cookie back - so the cookie is carried by hand. (Players are on https.)
 */
class Player {
  cookie = '';
  constructor(private ctx: APIRequestContext) {}
  private async call(method: string, url: string, opts: { data?: unknown; headers?: Record<string, string> } = {}) {
    const res = await this.ctx.fetch(url, {
      method,
      data: opts.data,
      headers: { ...(opts.headers || {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
    });
    for (const h of res.headersArray()) {
      if (h.name.toLowerCase() !== 'set-cookie') continue;
      const pair = h.value.split(';')[0];
      if (pair.startsWith('raid-shooter-session=')) this.cookie = pair;
    }
    return res;
  }
  get(url: string) { return this.call('GET', url); }
  post(url: string, opts: { data?: unknown; headers?: Record<string, string> } = {}) { return this.call('POST', url, opts); }
  delete(url: string, opts: { data?: unknown } = {}) { return this.call('DELETE', url, opts); }
  dispose() { return this.ctx.dispose(); }
}

async function siwe(ctx: Player, k: Key, statement: string) {
  const { nonce } = await (await ctx.get('/api/siwe/nonce')).json();
  const host = new URL(test.info().project.use.baseURL || 'http://127.0.0.1:3222').host;
  const message = new SiweMessage({
    domain: host, address: k.address, statement, uri: `http://${host}`, version: '1', chainId: 8453, nonce,
  }).prepareMessage();
  return { message, signature: await k.signMessage({ message }) };
}

async function signIn(ctx: Player, k: Key) {
  const body = await siwe(ctx, k, 'Sign in to Raid Shooter');
  const res = await ctx.post('/api/siwe/verify', { data: body });
  expect(res.ok(), await res.text()).toBe(true);
  return res.json();
}

async function fresh() {
  return new Player(await pwRequest.newContext({ baseURL: test.info().project.use.baseURL }));
}

test('a second sign-in links to an account, opens it, and brings its items along', async ({ request }) => {
  const main = key(), social = key(), stranger = key();
  const A = main.address.toLowerCase(), B = social.address.toLowerCase();
  // each address already has something of its own
  expect((await request.post('/api/admin/grant', { headers: ADMIN, data: { address: A, itemId: 'drone_voltmite' } })).ok()).toBe(true);
  expect((await request.post('/api/admin/grant', { headers: ADMIN, data: { address: B, itemId: 'drone_frostsprite' } })).ok()).toBe(true);

  const a = await fresh();
  await signIn(a, main);

  // a signature that names some OTHER account is refused
  const wrong = await siwe(a, social, linkStatement(stranger.address));
  expect((await a.post('/api/account/link', { data: wrong })).status()).toBe(422);
  // a plain sign-in signature cannot be replayed as a link
  const plain = await siwe(a, social, 'Sign in to Raid Shooter');
  expect((await a.post('/api/account/link', { data: plain })).status()).toBe(422);

  // the real thing
  const proof = await siwe(a, social, linkStatement(A));
  const linked = await a.post('/api/account/link', { data: proof });
  expect(linked.ok(), await linked.text()).toBe(true);
  expect((await linked.json()).links).toEqual([B]);
  // ...and only once: the nonce is spent
  expect((await a.post('/api/account/link', { data: proof })).status()).toBe(422);

  // signing in with the social address now opens the main account
  const b = await fresh();
  const who = await signIn(b, social);
  expect(who.address.toLowerCase()).toBe(A);
  expect(who.signer).toBe(B);
  const session = await (await b.get('/api/siwe/session')).json();
  expect(session.address.toLowerCase()).toBe(A);
  expect(session.linked).toBe(true);
  const profile = await (await b.get('/api/profile')).json();
  expect(profile.items).toEqual(expect.arrayContaining(['drone_voltmite', 'drone_frostsprite']));
  // the linked sign-in lists the account, and cannot remove itself
  const list = await (await b.get('/api/account/link')).json();
  expect(list).toMatchObject({ account: A, signer: B, links: [B] });
  expect((await b.delete('/api/account/link', { data: { address: B } })).status()).toBe(409);

  // the social address belongs to A now: nobody else can claim it, and A
  // cannot be folded into it
  const s = await fresh();
  await signIn(s, stranger);
  const steal = await siwe(s, social, linkStatement(stranger.address));
  const stolen = await s.post('/api/account/link', { data: steal });
  expect(stolen.status()).toBe(409);
  expect((await stolen.json()).error).toBe('linked_elsewhere');
  const fold = await siwe(b, main, linkStatement(A));
  expect((await (await b.post('/api/account/link', { data: fold })).json()).error).toBe('same_address');

  // removing it from the main sign-in makes it its own account again
  // (the session that just linked it is now using it, so it cannot remove it)
  expect((await a.delete('/api/account/link', { data: { address: B } })).status()).toBe(409);
  const a2 = await fresh();
  await signIn(a2, main);
  expect((await a2.delete('/api/account/link', { data: { address: B } })).ok()).toBe(true);
  const again = await fresh();
  expect((await signIn(again, social)).address.toLowerCase()).toBe(B);
  // ...an empty one: the items stayed with the account they merged into
  expect((await (await again.get('/api/profile')).json()).items).not.toContain('drone_frostsprite');

  for (const c of [a, a2, b, s, again]) await c.dispose();
});

test('linking needs a session, and admin rights never come through a linked sign-in', async ({ request }) => {
  expect((await request.post('/api/account/link', { data: { message: 'x', signature: '0x00' } })).status()).toBe(401);

  // an admin wallet links a social login to its account
  const adminKey = key(), social = key();
  const A = adminKey.address.toLowerCase();
  const added = await request.post('/api/admin/admins', { headers: ADMIN, data: { address: A, role: 'analyst', label: 'link test' } });
  expect(added.ok(), await added.text()).toBe(true);
  const a = await fresh();
  await signIn(a, adminKey);
  expect((await a.get('/api/admin/me')).status()).toBe(200);
  expect((await a.post('/api/account/link', { data: await siwe(a, social, linkStatement(A)) })).ok()).toBe(true);

  // the social login opens the same ACCOUNT, but not the team console: an
  // admin has to sign in with the admin wallet itself
  const b = await fresh();
  expect((await signIn(b, social)).address.toLowerCase()).toBe(A);
  expect((await b.get('/api/admin/me')).status()).toBe(401);

  await request.delete(`/api/admin/admins?address=${A}`, { headers: ADMIN }).catch(() => {});
  for (const c of [a, b]) await c.dispose();
});
