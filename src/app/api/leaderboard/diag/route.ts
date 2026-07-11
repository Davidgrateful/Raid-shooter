import { NextResponse } from 'next/server';
import { isPersistent } from '@/lib/leaderboard';
import { turnstileEnabled } from '@/lib/turnstile';

// Diagnostic for leaderboard storage + bot-protection config. Reports ONLY
// env var *names* that look like Redis REST credentials, and booleans for
// Turnstile - never values, never secrets. Safe to remove once persistence
// and bot protection are confirmed.
export async function GET() {
  const candidates = Object.keys(process.env)
    .filter((name) => /(REST_API_(URL|TOKEN)|REDIS_REST_(URL|TOKEN))$/.test(name))
    .sort();
  return NextResponse.json({
    persistent: isPersistent(),
    redisEnvNames: candidates,
    // server-side gate: verifies submissions (TURNSTILE_SECRET_KEY)
    turnstileServerEnabled: turnstileEnabled(),
    // client-side widget: renders the challenge (NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    turnstileClientEnabled: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  });
}
