import { NextResponse } from 'next/server';
import { getWeeklyTop, getWeeklyCount, weekKey, weekResetsAt } from '@/lib/weekly';

// Public: this week's ladder (resets Monday 00:00 UTC). Same row shape as the
// main board so every leaderboard renders through one component.
export async function GET() {
  const [entries, total] = await Promise.all([
    getWeeklyTop(250).catch(() => []),
    getWeeklyCount().catch(() => 0),
  ]);
  return NextResponse.json({ entries, total, week: weekKey(), resetsAt: weekResetsAt() });
}
