import { isKvConfigured, redisCommand } from '@/lib/kv';

// Fixed-window rate limiter. Redis-backed when configured (shared across
// serverless instances), with a per-instance in-memory fallback for dev.
// Returns true when the request is ALLOWED, false when it should be blocked.

const memWindows = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  bucket: string,
  identity: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const key = `rl:${bucket}:${identity}`;
  const windowSec = Math.ceil(windowMs / 1000);

  if (isKvConfigured()) {
    try {
      const count = (await redisCommand(['INCR', key])) as number;
      if (count === 1) {
        await redisCommand(['EXPIRE', key, windowSec]);
      }
      return count <= max;
    } catch {
      // never let a limiter outage hard-fail the request path
      return true;
    }
  }

  const now = Date.now();
  const entry = memWindows.get(key);
  if (!entry || entry.resetAt <= now) {
    memWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

// Best-effort client IP from the proxy headers Vercel sets.
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
