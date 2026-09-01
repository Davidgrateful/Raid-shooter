// Wallet-keyed player profiles: owned market items. Redis when
// configured, in-memory for dev, mirroring the leaderboard storage.

import { isKvConfigured, redisCommand } from '@/lib/kv';

export interface PlayerProfile {
  items: string[];
  consumables: Record<string, number>;
  /*
   * Pilot XP, per pilot id. This lived ONLY in localStorage['radiusraid']
   * (storage.js), which made it the single thing the game presents as "your
   * progression" that did not survive a cleared browser or a new device -
   * while purchases and board rank, which the player did not earn by playing,
   * did. Someone at level 10 on their laptop opened the game on their phone
   * and was level 1.
   */
  pilotxp?: Record<string, number>;
}

const PROFILES_KEY = 'shooterboard:profiles';
const USED_TX_KEY = 'shooterboard:usedtx';

const redis = redisCommand;

const memoryProfiles = new Map<string, PlayerProfile>();
const memoryUsedTx = new Set<string>();

const emptyProfile = (): PlayerProfile => ({ items: [], consumables: {}, pilotxp: {} });

export async function getProfile(address: string): Promise<PlayerProfile> {
  if (isKvConfigured()) {
    const raw = (await redis(['HGET', PROFILES_KEY, address])) as string | null;
    if (!raw) {
      return emptyProfile();
    }
    try {
      return { ...emptyProfile(), ...(JSON.parse(raw) as PlayerProfile) };
    } catch {
      return emptyProfile();
    }
  }
  return memoryProfiles.get(address) || emptyProfile();
}

async function saveProfile(address: string, profile: PlayerProfile): Promise<void> {
  if (isKvConfigured()) {
    await redis(['HSET', PROFILES_KEY, address, JSON.stringify(profile)]);
  } else {
    memoryProfiles.set(address, profile);
  }
}

// kind/stack let consumables stack as counts instead of one-time unlocks.
// A 'bundle' item is never itself owned - one payment fans out to grant
// every id in bundleItems, so ownership checks elsewhere (market grid,
// hangar) only ever see the real items, not the bundle wrapper.
export async function grantItem(
  address: string,
  item: { id: string; kind: string; stack?: number; bundleItems?: string[] }
): Promise<PlayerProfile> {
  const profile = await getProfile(address);
  if (item.kind === 'bundle' && item.bundleItems) {
    for (const id of item.bundleItems) {
      if (!profile.items.includes(id)) {
        profile.items.push(id);
      }
    }
  } else if (item.kind === 'consumable') {
    profile.consumables[item.id] = (profile.consumables[item.id] || 0) + (item.stack || 1);
  } else if (!profile.items.includes(item.id)) {
    profile.items.push(item.id);
  }
  await saveProfile(address, profile);
  return profile;
}

// returns false if the player has none left
export async function spendConsumable(address: string, itemId: string): Promise<boolean> {
  const profile = await getProfile(address);
  const have = profile.consumables[itemId] || 0;
  if (have <= 0) {
    return false;
  }
  profile.consumables[itemId] = have - 1;
  await saveProfile(address, profile);
  return true;
}

// Carries a guest's owned items/consumables over to the wallet they just
// connected, mirroring mergeGuestIntoWallet in leaderboard.ts - without
// this, everything a guest earned (streak-reward consumables; any items on
// a future guest-ownable path) is silently orphaned under the old guest key
// the moment they connect a wallet, forever invisible to them. Union items,
// sum consumables, keep whichever exists; best-effort, never blocks sign-in.
export async function mergeGuestProfileIntoWallet(guestKey: string, walletKey: string): Promise<void> {
  const guestProfile = await getProfile(guestKey);
  if (guestProfile.items.length === 0 && Object.keys(guestProfile.consumables).length === 0) {
    return; // nothing to merge
  }
  const walletProfile = await getProfile(walletKey);
  for (const id of guestProfile.items) {
    if (!walletProfile.items.includes(id)) {
      walletProfile.items.push(id);
    }
  }
  for (const [id, count] of Object.entries(guestProfile.consumables)) {
    walletProfile.consumables[id] = (walletProfile.consumables[id] || 0) + count;
  }
  await saveProfile(walletKey, walletProfile);
  await saveProfile(guestKey, emptyProfile());
}

// each payment transaction may only ever grant one item
export async function claimTx(txHash: string): Promise<boolean> {
  if (isKvConfigured()) {
    const added = (await redis(['SADD', USED_TX_KEY, txHash])) as number;
    return added === 1;
  }
  if (memoryUsedTx.has(txHash)) {
    return false;
  }
  memoryUsedTx.add(txHash);
  return true;
}

/*
 * Merge a client's local pilot XP into the stored profile, taking the HIGHER
 * value per pilot.
 *
 * Max-merge rather than overwrite, because both directions are real: a device
 * that has been offline may hold XP the server has never seen, and a fresh
 * device holds zeroes that must never erase a real total. Taking the max means
 * neither can destroy the other, and the operation is idempotent - the same
 * sync repeated changes nothing.
 *
 * XP only ever goes up in this game (gainPilotXp adds; nothing spends it), so
 * max-merge cannot lose a legitimate decrease - there is no such thing.
 */
export async function mergePilotXp(
  address: string,
  incoming: Record<string, number>,
): Promise<Record<string, number>> {
  const profile = await getProfile(address);
  const merged: Record<string, number> = { ...(profile.pilotxp || {}) };
  let changed = false;

  for (const [id, raw] of Object.entries(incoming || {})) {
    // ignore anything that is not a sane number: a forged payload should not
    // be able to write NaN or Infinity into a profile
    if (!/^[a-z0-9_]{1,32}$/i.test(id)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) continue;
    const capped = Math.min(Math.floor(value), 10_000_000);
    if (capped > (merged[id] || 0)) {
      merged[id] = capped;
      changed = true;
    }
  }

  if (changed) {
    await saveProfile(address, { ...profile, pilotxp: merged });
  }
  return merged;
}
