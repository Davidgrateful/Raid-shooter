import { randomBytes } from 'crypto';
import { isKvConfigured, redisCommand } from '@/lib/kv';

/*
 * A short-lived mutual-exclusion lock. SET NX PX in Redis, a Map otherwise.
 *
 * Used where two requests racing the same read-modify-write would each see the
 * pre-write state and both act on it. Returns an owner token on success, or
 * null if someone else holds the lock; release only frees a lock this caller
 * still owns, so a slow holder whose lock expired cannot free the next one's.
 */
const mem = new Map<string, { owner: string; exp: number }>();

export async function tryLock(name: string, ttlMs = 10_000): Promise<string | null> {
  const owner = randomBytes(8).toString('hex');
  const key = `lock:${name}`;
  if (isKvConfigured()) {
    const r = (await redisCommand(['SET', key, owner, 'NX', 'PX', ttlMs])) as string | null;
    return r === 'OK' ? owner : null;
  }
  const now = Date.now();
  const held = mem.get(key);
  if (held && held.exp > now) return null;
  mem.set(key, { owner, exp: now + ttlMs });
  return owner;
}

export async function unlock(name: string, owner: string): Promise<void> {
  const key = `lock:${name}`;
  if (isKvConfigured()) {
    const cur = (await redisCommand(['GET', key])) as string | null;
    if (cur === owner) await redisCommand(['DEL', key]);
    return;
  }
  if (mem.get(key)?.owner === owner) mem.delete(key);
}
