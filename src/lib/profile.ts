// Wallet-keyed player profiles: owned market items. Redis when
// configured, in-memory for dev, mirroring the leaderboard storage.

export interface PlayerProfile {
  items: string[];
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

const emptyProfile = (): PlayerProfile => ({ items: [] });

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

export async function grantItem(address: string, itemId: string): Promise<PlayerProfile> {
  const profile = await getProfile(address);
  if (!profile.items.includes(itemId)) {
    profile.items.push(itemId);
  }
  if (kvUrl && kvToken) {
    await redis(['HSET', PROFILES_KEY, address, JSON.stringify(profile)]);
  } else {
    memoryProfiles.set(address, profile);
  }
  return profile;
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
