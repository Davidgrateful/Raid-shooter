// Shared Redis REST credential resolution (Vercel KV / Upstash). Several
// storage modules (leaderboard, profiles) need the same lookup - centralized
// here so a fix to the fallback logic can't drift between them again.

// Resolve the Redis REST credentials. Prefer the canonical names, but fall
// back to any prefixed variant (e.g. a Vercel integration that injects
// STORAGE_KV_REST_API_URL) so a custom env prefix doesn't silently disable
// persistence.
function resolveEnv(suffixes: string[]): string | undefined {
  for (const suffix of suffixes) {
    if (process.env[suffix]) {
      return process.env[suffix];
    }
  }
  for (const suffix of suffixes) {
    for (const [name, value] of Object.entries(process.env)) {
      if (value && name.endsWith(suffix)) {
        return value;
      }
    }
  }
  return undefined;
}

export const kvUrl = resolveEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
export const kvToken = resolveEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);

// Whether a shared, persistent Redis backend is configured. Without it,
// callers fall back to per-instance in-memory storage, which on serverless
// means state (scores, purchases) is lost on every cold start/redeploy.
export function isKvConfigured(): boolean {
  return !!(kvUrl && kvToken);
}

export async function redisCommand(command: (string | number)[]): Promise<unknown> {
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
