// Wallet-keyed player profiles: owned market items. Redis when
// configured, in-memory for dev, mirroring the leaderboard storage.

export interface PlayerProfile {
  items: string[];
  consumables: Record<string, number>;
}

const PROFILES_KEY = 'shooterboard:profiles';
const USED_TX_KEY = 'shooterboard:usedtx';

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(kvUrl!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kvToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status}`);
  }
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

const memoryProfiles = new Map<string, PlayerProfile>();
const memoryUsedTx = new Set<string>();

const emptyProfile = (): PlayerProfile => ({ items: [], consumables: {} });

export async function getProfile(address: string): Promise<PlayerProfile> {
  if (kvUrl && kvToken) {
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
  if (kvUrl && kvToken) {
    await redis(['HSET', PROFILES_KEY, address, JSON.stringify(profile)]);
  } else {
    memoryProfiles.set(address, profile);
  }
}

// kind/stack let consumables stack as counts instead of one-time unlocks
export async function grantItem(
  address: string,
  item: { id: string; kind: string; stack?: number }
): Promise<PlayerProfile> {
  const profile = await getProfile(address);
  if (item.kind === 'consumable') {
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

// each payment transaction may only ever grant one item
export async function claimTx(txHash: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const added = (await redis(['SADD', USED_TX_KEY, txHash])) as number;
    return added === 1;
  }
  if (memoryUsedTx.has(txHash)) {
    return false;
  }
  memoryUsedTx.add(txHash);
  return true;
}
