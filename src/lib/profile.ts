// Wallet-keyed player profiles: owned market items. Redis when
// configured, in-memory for dev, mirroring the leaderboard storage.

import { isKvConfigured, redisCommand } from '@/lib/kv';

export interface PlayerProfile {
  items: string[];
  consumables: Record<string, number>;
}

const PROFILES_KEY = 'shooterboard:profiles';
const USED_TX_KEY = 'shooterboard:usedtx';

const redis = redisCommand;

const memoryProfiles = new Map<string, PlayerProfile>();
const memoryUsedTx = new Set<string>();

const emptyProfile = (): PlayerProfile => ({ items: [], consumables: {} });

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
