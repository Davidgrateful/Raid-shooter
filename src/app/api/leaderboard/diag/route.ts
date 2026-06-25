import { NextResponse } from 'next/server';
import { isPersistent } from '@/lib/leaderboard';

// Diagnostic for leaderboard storage config. Reports ONLY env var *names*
// that look like Redis REST credentials — never their values — so we can
// tell whether a shared backend is wired up (and under what names) without
// leaking secrets. Safe to remove once persistence is confirmed.
export async function GET() {
  const candidates = Object.keys(process.env)
    .filter((name) => /(REST_API_(URL|TOKEN)|REDIS_REST_(URL|TOKEN))$/.test(name))
    .sort();
  return NextResponse.json({
    persistent: isPersistent(),
    redisEnvNames: candidates,
  });
}
