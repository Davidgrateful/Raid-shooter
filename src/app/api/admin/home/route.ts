import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { getTrackingStats } from '@/lib/stats';
import { getFlagged } from '@/lib/leaderboard';
import { listPayouts, getActiveSeason } from '@/lib/rewards';
import { listFeedback } from '@/lib/feedback';
import { hasScope } from '@/lib/roles';

// Mission Control: health at a glance + a "needs attention" queue, tailored
// to what the caller's role is allowed to act on. This is the home screen -
// it answers "is the game healthy, and what needs me right now?"
export async function GET(req: NextRequest) {
  const r = await adminAuth(req, 'stats.view');
  if (!r.ok) return r.res;
  const role = r.identity.role;

  const [tracking, flagged, payouts, season, feedback] = await Promise.all([
    getTrackingStats(14).catch(() => null),
    getFlagged().catch(() => []),
    listPayouts().catch(() => []),
    getActiveSeason().catch(() => null),
    listFeedback(50).catch(() => []),
  ]);

  // health tiles with a "vs previous" delta from the daily series
  const daily = tracking?.daily || [];
  const today = daily[daily.length - 1];
  const yday = daily[daily.length - 2];
  const delta = (a?: number, b?: number) => (a != null && b != null ? a - b : null);

  const health = tracking
    ? {
        activeToday: tracking.activeToday,
        active7Days: tracking.active7Days,
        runsToday: tracking.runsToday,
        playersDelta: delta(today?.players, yday?.players),
        runsDelta: delta(today?.runs, yday?.runs),
        uniqueAllTime: tracking.uniquePlayersAllTime,
        daily: daily.map((d) => ({ date: d.date, players: d.players, runs: d.runs })),
      }
    : null;

  // needs-attention items, filtered to what this role can act on
  const items: { type: string; count: number; label: string; scope: string; cta: string }[] = [];
  if (hasScope(role, 'flagged.review') && flagged.length) {
    items.push({ type: 'flagged', count: flagged.length, label: 'flagged run(s) to review before payouts', scope: 'flagged.review', cta: 'Leaderboard' });
  }
  const pendingPayouts = payouts.filter((p) => p.status === 'pending' || p.status === 'exported');
  if (hasScope(role, 'payouts.send') && pendingPayouts.length) {
    items.push({ type: 'payout', count: pendingPayouts.length, label: 'payout batch(es) awaiting send', scope: 'payouts.send', cta: 'Rewards' });
  }
  if (hasScope(role, 'content.manage') && feedback.length) {
    items.push({ type: 'feedback', count: feedback.length, label: 'player message(s) in the inbox', scope: 'content.manage', cta: 'Content' });
  }
  if (hasScope(role, 'rewards.view') && season && season.endsAt && season.endsAt - Date.now() < 2 * 86400000) {
    const hrs = Math.max(0, Math.round((season.endsAt - Date.now()) / 3600000));
    items.push({ type: 'cup', count: 1, label: `"${season.name}" ends in ~${hrs}h — settle it`, scope: 'rewards.view', cta: 'Rewards' });
  }

  return NextResponse.json({ health, needs: items, activeSeason: season ? { name: season.name, endsAt: season.endsAt || null } : null });
}
