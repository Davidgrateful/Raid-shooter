// Linked sign-ins: one account, several ways in.
//
// An account used to BE the wallet address it signed in with. Email and
// social logins (Reown's embedded wallets) are a different, smart-account
// address, so a player who had been playing on MetaMask and then tried "Sign
// in with Google" landed in a fresh, empty account - and the reverse.
//
// A linked sign-in is a second address that resolves to the first. The
// account keeps its original address everywhere it is already stored
// (profile, board, streak, duels, payouts); signing in with a linked address
// simply opens that account. Linking needs BOTH: a live session for the
// account and a fresh signature from the address being linked (see
// /api/account/link), so nobody can attach an address they do not control,
// or attach theirs to somebody else's account.
//
// Flat by construction: an account cannot itself be a linked address, and an
// address that already has links of its own cannot be linked into another.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const ALIAS_KEY = 'acct:alias'; // hash: linked address -> account address
const linksKey = (account: string) => `acct:links:${account}`; // set of linked addresses

/** How many extra sign-ins one account may carry. */
export const MAX_LINKS = 3;

const memoryAlias = new Map<string, string>();
const memoryLinks = new Map<string, Set<string>>();

const norm = (a: string) => a.trim().toLowerCase();
export const isEvmAddress = (a: string) => /^0x[0-9a-f]{40}$/.test(norm(a));

/** The account an address signs in to: its own, or the one it is linked to. */
export async function resolveAccount(address: string): Promise<string> {
  const a = norm(address);
  if (isKvConfigured()) {
    const primary = (await redisCommand(['HGET', ALIAS_KEY, a])) as string | null;
    return primary || a;
  }
  return memoryAlias.get(a) || a;
}

/** The addresses linked to an account (not including the account itself). */
export async function getLinks(account: string): Promise<string[]> {
  const a = norm(account);
  if (isKvConfigured()) {
    const list = (await redisCommand(['SMEMBERS', linksKey(a)])) as string[] | null;
    return (list || []).map(norm).sort();
  }
  return [...(memoryLinks.get(a) || [])].sort();
}

/** Every address that may act for an account: the account and its links. */
export async function accountAddresses(account: string): Promise<string[]> {
  return [norm(account), ...(await getLinks(account))];
}

export type LinkRefusal =
  | 'same_address'
  | 'linked_elsewhere'
  | 'account_is_linked'
  | 'has_own_links'
  | 'too_many';

/**
 * Attach `address` to `account`. Returns null on success (including when it
 * was already linked to this account), or why it was refused.
 */
export async function linkAddress(account: string, address: string): Promise<LinkRefusal | null> {
  const acct = norm(account);
  const addr = norm(address);
  if (acct === addr) return 'same_address';
  // the account must be a real account, not somebody's linked sign-in
  if ((await resolveAccount(acct)) !== acct) return 'account_is_linked';
  const current = await resolveAccount(addr);
  if (current === acct) return null; // already linked here
  if (current !== addr) return 'linked_elsewhere';
  if ((await getLinks(addr)).length > 0) return 'has_own_links';
  const links = await getLinks(acct);
  if (links.length >= MAX_LINKS) return 'too_many';

  if (isKvConfigured()) {
    // HSETNX: two racing links of one address cannot both win
    const set = (await redisCommand(['HSETNX', ALIAS_KEY, addr, acct])) as number;
    if (set !== 1) return (await resolveAccount(addr)) === acct ? null : 'linked_elsewhere';
    await redisCommand(['SADD', linksKey(acct), addr]);
    return null;
  }
  memoryAlias.set(addr, acct);
  if (!memoryLinks.has(acct)) memoryLinks.set(acct, new Set());
  memoryLinks.get(acct)!.add(addr);
  return null;
}

/** Detach a linked address. It becomes an ordinary, empty account again. */
export async function unlinkAddress(account: string, address: string): Promise<boolean> {
  const acct = norm(account);
  const addr = norm(address);
  if ((await resolveAccount(addr)) !== acct || addr === acct) return false;
  if (isKvConfigured()) {
    await redisCommand(['HDEL', ALIAS_KEY, addr]);
    await redisCommand(['SREM', linksKey(acct), addr]);
    return true;
  }
  memoryAlias.delete(addr);
  memoryLinks.get(acct)?.delete(addr);
  return true;
}
