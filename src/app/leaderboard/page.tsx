import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { TIER_COLORS, tierFromScore, displayName } from '@/lib/tiers';

// Public web leaderboard: the full field (not capped at 50), server-rendered
// so a link posted in Telegram/Discord unfurls into a real page and always
// shows fresh standings. Fetches the same public API the game uses, so it
// shares one source of truth with the in-game board.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboard — Raid Shooter',
  description: 'Live pilot standings on the Raid Shooter Shooterboard.',
};

interface Entry { address: string; name?: string; score: number; kills: number; pilot: string; verified?: boolean }

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function LeaderboardPage() {
  const base = await baseUrl();
  const [boardRes, seasonRes] = await Promise.all([
    fetch(`${base}/api/leaderboard?limit=1000`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    fetch(`${base}/api/season`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
  ]);
  const entries: Entry[] = boardRes?.entries || [];
  const total: number = boardRes?.total ?? entries.length;
  const persistent: boolean = boardRes?.persistent !== false;
  const active = seasonRes?.season || null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">SHOOTERBOARD</h1>
          <p className="mt-1 text-sm text-white/40">{total.toLocaleString()} pilot{total === 1 ? '' : 's'} ranked</p>
        </div>
        <Link href="/" className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400">Play free →</Link>
      </div>

      {active && (
        <Link href="/cup" className="mb-6 block rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 transition-colors hover:border-amber-400/60">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Tournament live</div>
          <div className="mt-0.5 text-lg font-bold">{active.name}</div>
          <div className="text-sm text-white/60">
            {active.prize1Usd > 0 ? `${active.prize1Usd} USDC to the top pilot` : 'Exclusive prizes'} — see the cup →
          </div>
        </Link>
      )}

      {!persistent && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Demo mode — leaderboard storage isn&apos;t configured, so standings are local only.
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/50">
          No pilots ranked yet. <Link href="/" className="text-cyan-300 underline">Be the first.</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-2.5 sm:px-4">#</th>
                <th className="px-3 py-2.5 sm:px-4">Pilot</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Tier</th>
                <th className="px-3 py-2.5 text-right sm:px-4">Score</th>
                <th className="hidden px-4 py-2.5 text-right md:table-cell">Kills</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const rank = i + 1;
                const tier = tierFromScore(e.score);
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                return (
                  <tr key={e.address} className={`border-t border-white/5 ${rank <= 3 ? 'bg-white/[0.03]' : ''}`}>
                    <td className="px-3 py-2.5 font-mono text-white/50 sm:px-4">{medal || rank}</td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <span className="font-semibold">{displayName(e.name, e.address)}</span>
                      {e.verified && <span title="Wallet-verified" className="ml-1.5 text-cyan-300">✓</span>}
                      <span className="ml-2 hidden text-xs text-white/30 sm:inline">{e.pilot}</span>
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <span style={{ color: TIER_COLORS[tier] }} className="text-xs font-bold">{tier}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold sm:px-4">{e.score.toLocaleString()}</td>
                    <td className="hidden px-4 py-2.5 text-right text-white/60 md:table-cell">{e.kills.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-white/30">
        Cosmetics never affect score. <Link href="/terms" className="underline">Rules</Link>
      </p>
    </main>
  );
}
