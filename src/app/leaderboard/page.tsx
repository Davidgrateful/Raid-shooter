import Link from 'next/link';
import { BoardBackdrop } from '@/components/BoardBackdrop';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { LiveBoard, type Entry, type SeasonSummary } from './LiveBoard';

// Public web Shooterboard: server-rendered so a link posted in Telegram or
// Discord unfurls into a real page with fresh standings, then hydrates into a
// LIVE board (LiveBoard re-fetches on an interval). Styled to match the
// in-game arcade look: scanlines, tier colors, podium for the top three.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shooterboard — Raid Shooter live rankings',
  description: 'Live pilot standings on the Raid Shooter Shooterboard. Every score earned, never bought.',
};

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
  const season: SeasonSummary | null = seasonRes?.season
    ? {
        name: seasonRes.season.name,
        prize1Usd: seasonRes.season.prize1Usd || 0,
        poolUsd: seasonRes.season.poolUsd || 0,
        endsAt: seasonRes.season.endsAt || null,
        sponsorName: seasonRes.season.sponsorName || null,
      }
    : null;

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      {/* game-matched backdrop: deep space + soft glow + scanlines */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1000px 500px at 80% -10%, rgba(51,230,255,0.07), transparent 60%),' +
            'radial-gradient(800px 400px at 10% 110%, rgba(255,215,94,0.05), transparent 55%), #06070c',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px)' }}
      />
      {/* ambient blurred ships firing at enemies */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10"><BoardBackdrop /></div>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-300">Raid Shooter · Live rankings</div>
            <h1
              className="mt-1 text-4xl font-black tracking-tight sm:text-5xl"
              style={{ textShadow: '0 0 30px rgba(51,230,255,0.25)' }}
            >
              SHOOTER<span className="text-cyan-300">BOARD</span>
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-cyan-300"
          >
            Play free →
          </Link>
        </div>

        <LiveBoard initialEntries={entries} initialTotal={total} season={season} persistent={persistent} />

        <p className="mt-8 text-center text-xs text-white/30">
          Cosmetics never affect score. <Link href="/terms" className="underline hover:text-white/60">Tournament rules</Link>
        </p>
      </div>
    </main>
  );
}
