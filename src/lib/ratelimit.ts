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

/*
 * The client IP every IP-keyed limiter is keyed on.
 *
 * This used to take the FIRST entry of x-forwarded-for. That header is a list
 * each hop appends to, and its first entry is whatever the original request
 * claimed - so a caller that sets its own x-forwarded-for chooses its own
 * limiter key, and a limiter keyed on a value the caller chooses limits
 * nothing. Measured against `next start`, where no proxy rewrites the header:
 * 30 renames with a rotating header against a 20/min ceiling, 30 accepted.
 *
 * Vercel's edge sets x-vercel-forwarded-for and x-real-ip itself from the
 * connection it actually received, so those come first. x-forwarded-for is
 * the last resort, and its LAST entry is used rather than its first: the last
 * hop is the one nearest this server, the only one a remote caller cannot
 * write. Local dev and tests have no edge in front of them and fall through
 * to it, which is fine - there is nothing to spoof past there.
 */
export function clientIp(req: Request): string {
  const platform = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-real-ip');
  if (platform) return platform.split(',')[0].trim();
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return 'unknown';
}
