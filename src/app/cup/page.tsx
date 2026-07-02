import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { getItem } from '@/lib/market';
import { displayName } from '@/lib/tiers';

// Public tournament page: the link you drop in Telegram when a cup goes live.
// Prize table + live standings + countdown, fetched from the same public APIs
// the game uses so it's always in sync.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tournament — Raid Shooter',
  description: 'The live Raid Shooter cup: prizes, rules, and current standings.',
};

interface Prize { fromRank: number; toRank: number; itemId: string | null; usd: number }
interface Season { name: string; prize1Usd: number; poolUsd: number; endsAt: number | null; sponsorName: string | null; prizes: Prize[] }
interface Entry { address: string; name?: string; score: number; verified?: boolean }

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function prizeLabel(itemId: string | null, usd: number): string {
  const parts: string[] = [];
  if (usd > 0) parts.push(`${usd} USDC`);
  if (itemId) {
    const item = getItem(itemId);
    parts.push(item ? item.title : itemId.replace(/_/g, ' ').toUpperCase());
  }
  return parts.join(' + ') || '—';
}

function countdown(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'ENDED';
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.round(h / 24)} DAYS LEFT`;
  if (h >= 1) return `${h} HOURS LEFT`;
  return `${Math.max(1, Math.round(ms / 60000))} MIN LEFT`;
}

export default async function CupPage() {
  const base = await baseUrl();
  const [seasonRes, boardRes] = await Promise.all([
    fetch(`${base}/api/season`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    fetch(`${base}/api/leaderboard?limit=50`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
  ]);
  const season: Season | null = seasonRes?.season || null;

  if (!season) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 text-center text-white">
        <h1 className="text-2xl font-black">No tournament running right now</h1>
        <p className="mt-2 text-white/50">Follow the community to hear when the next cup drops.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400">Play free →</Link>
          <Link href="/leaderboard" className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Leaderboard</Link>
        </div>
      </main>
    );
  }

  const prizes = season.prizes || [];
  const maxRank = prizes.reduce((m, p) => Math.max(m, p.toRank), 0);
  const standings: Entry[] = (boardRes?.entries || []).slice(0, Math.max(10, maxRank));

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 text-white">
      <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-amber-400/[0.08] to-transparent p-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">Tournament live</div>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">{season.name}</h1>
        {season.sponsorName && <div className="mt-1 text-sm text-white/50">presented by {season.sponsorName}</div>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {season.poolUsd > 0 && (
            <span className="rounded-full bg-amber-400/15 px-4 py-1.5 text-sm font-bold text-amber-300">{season.poolUsd} USDC prize pool</span>
          )}
          {season.endsAt && (
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">{countdown(season.endsAt)}</span>
          )}
        </div>
        <Link href="/" className="mt-5 inline-block rounded-lg bg-cyan-500/90 px-6 py-2.5 text-sm font-bold text-black hover:bg-cyan-400">
          Enter the cup — play free →
        </Link>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-amber-300/80">Prizes</h2>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-white/40">
            <tr><th className="px-4 py-2.5">Rank</th><th className="px-4 py-2.5">Reward</th></tr>
          </thead>
          <tbody>
            {prizes.map((p, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-4 py-2.5 font-bold">{p.fromRank === p.toRank ? `#${p.fromRank}` : `#${p.fromRank}–${p.toRank}`}</td>
                <td className="px-4 py-2.5">{prizeLabel(p.itemId, p.usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-cyan-300/80">Current standings</h2>
      {standings.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/50">No entries yet — the board is wide open.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <tbody>
              {standings.map((e, i) => {
                const rank = i + 1;
                const inPrizes = prizes.some((p) => rank >= p.fromRank && rank <= p.toRank);
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                return (
                  <tr key={e.address} className={`border-t border-white/5 ${inPrizes ? 'bg-amber-400/[0.05]' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-white/50">{medal}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{displayName(e.name, e.address)}</span>
                      {e.verified ? <span className="ml-1.5 text-cyan-300">✓</span> : <span className="ml-2 text-[11px] text-amber-300/70">connect wallet to claim</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold">{e.score.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-white/40">
        A connected wallet is required to receive prizes. No purchase necessary — cosmetics never affect score.{' '}
        <Link href="/terms" className="underline">Full rules</Link>
      </p>
    </main>
  );
}
