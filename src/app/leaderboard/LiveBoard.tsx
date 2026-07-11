'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { TIER_COLORS, tierFromScore, displayName } from '@/lib/tiers';
import { PilotIcon, type Cosmetics } from '@/components/PilotIcon';
import { TopChat } from '@/components/TopChat';

// The live half of the public Shooterboard page. Server render provides the
// initial standings (so links unfurl + first paint is instant); this component
// then keeps the board ONLINE - re-fetching every 15s so everyone watching
// sees ranks move without reloading.

export interface Entry {
  address: string;
  name?: string;
  score: number;
  kills: number;
  pilot: string;
  verified?: boolean;
  cosmetics?: Cosmetics;
}

export interface SeasonSummary {
  name: string;
  prize1Usd: number;
  poolUsd: number;
  endsAt: number | null;
  sponsorName: string | null;
}

const REFRESH_MS = 15_000;

function timeLeft(endsAt: number | null): string {
  if (!endsAt) return '';
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'ENDED';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}D ${h}H` : h > 0 ? `${h}H ${m}M` : `${m}M`;
}

function TierChip({ score }: { score: number }) {
  const tier = tierFromScore(score);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-black tracking-widest"
      style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}1a`, border: `1px solid ${TIER_COLORS[tier]}40` }}
    >
      {tier}
    </span>
  );
}

function PodiumCard({ entry, rank }: { entry: Entry; rank: number }) {
  const meta = [
    { label: 'CHAMPION', ring: '#ffd75e', glow: 'rgba(255,215,94,0.14)', size: 'sm:order-2 sm:-mt-4' },
    { label: 'RUNNER UP', ring: '#c9d1e8', glow: 'rgba(201,209,232,0.10)', size: 'sm:order-1' },
    { label: 'THIRD', ring: '#d08a4a', glow: 'rgba(208,138,74,0.10)', size: 'sm:order-3' },
  ][rank - 1];
  return (
    <div
      className={`relative flex-1 rounded-2xl border p-5 text-center ${meta.size}`}
      style={{ borderColor: `${meta.ring}55`, background: `linear-gradient(180deg, ${meta.glow}, rgba(10,12,20,0.6))` }}
    >
      <div className="text-[10px] font-black tracking-[0.3em]" style={{ color: meta.ring }}>{meta.label}</div>
      <div
        className="mx-auto mt-3 flex h-14 w-14 items-center justify-center rounded-full border-2 text-xl font-black"
        style={{ borderColor: meta.ring, color: meta.ring, boxShadow: `0 0 24px ${meta.glow}` }}
      >
        {rank}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <PilotIcon cosmetics={entry.cosmetics} size={20} pilotName={entry.pilot} />
        <span className="truncate text-lg font-extrabold tracking-wide">
          {displayName(entry.name, entry.address)}
          {entry.verified && <span title="Wallet-verified" className="ml-1 text-cyan-300">✓</span>}
        </span>
      </div>
      <div className="mt-1 font-mono text-2xl font-black tabular-nums" style={{ color: meta.ring }}>
        {entry.score.toLocaleString()}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-white/40">
        <TierChip score={entry.score} />
        <span>{entry.pilot}</span>
        <span>·</span>
        <span>{entry.kills.toLocaleString()} kills</span>
      </div>
    </div>
  );
}

export function LiveBoard({
  initialEntries,
  initialTotal,
  season,
  persistent,
}: {
  initialEntries: Entry[];
  initialTotal: number;
  season: SeasonSummary | null;
  persistent: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch('/api/leaderboard?limit=1000')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.entries)) {
          setEntries(d.entries);
          setTotal(typeof d.total === 'number' ? d.total : d.entries.length);
          setUpdatedAt(Date.now());
        }
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <>
      {/* status strip - auto-refreshes on its own, no manual action needed */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2 text-[11px] text-white/40">
        <span suppressHydrationWarning>Updated {new Date(updatedAt).toLocaleTimeString()}</span>
      </div>

      {/* live cup strip */}
      {season && (
        <Link
          href="/cup"
          className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/[0.08] to-transparent p-4 transition-colors hover:border-amber-400/60"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">⚡ Cup live{season.sponsorName ? ` · with ${season.sponsorName}` : ''}</div>
            <div className="mt-0.5 text-xl font-extrabold tracking-wide">{season.name}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-black text-amber-300">
              {season.prize1Usd > 0 ? `${season.prize1Usd} USDC` : season.poolUsd > 0 ? `${season.poolUsd} USDC POOL` : 'PRIZES'}
            </div>
            {season.endsAt && <div className="font-mono text-xs text-cyan-300">ENDS IN {timeLeft(season.endsAt)}</div>}
          </div>
        </Link>
      )}

      {!persistent && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Demo mode — leaderboard storage isn&apos;t configured, so standings are local only.
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          No pilots ranked yet. <Link href="/" className="text-cyan-300 underline">Be the first.</Link>
        </div>
      ) : (
        <>
          {/* podium */}
          {podium.length === 3 && (
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
              {podium.map((e, i) => (
                <PodiumCard key={e.address} entry={e} rank={i + 1} />
              ))}
            </div>
          )}

          {/* the field */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 sm:grid-cols-[3.5rem_1fr_6rem_7rem_5rem]">
              <span>Rank</span>
              <span>Pilot</span>
              <span className="hidden sm:block">Tier</span>
              <span className="text-right">Score</span>
              <span className="hidden text-right sm:block">Kills</span>
            </div>
            {(podium.length === 3 ? rest : entries).map((e, i) => {
              const rank = (podium.length === 3 ? 4 : 1) + i;
              return (
                <div
                  key={e.address}
                  className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-t border-white/[0.04] px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.03] sm:grid-cols-[3.5rem_1fr_6rem_7rem_5rem]"
                >
                  <span className="font-mono text-white/40 tabular-nums">{String(rank).padStart(2, '0')}</span>
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold tracking-wide">
                    <PilotIcon cosmetics={e.cosmetics} size={18} pilotName={e.pilot} />
                    <span className="truncate">
                      {displayName(e.name, e.address)}
                      {e.verified && <span title="Wallet-verified" className="ml-1.5 text-cyan-300">✓</span>}
                    </span>
                  </span>
                  <span className="hidden sm:block"><TierChip score={e.score} /></span>
                  <span className="text-right font-mono font-bold tabular-nums" style={{ color: TIER_COLORS[tierFromScore(e.score)] }}>
                    {e.score.toLocaleString()}
                  </span>
                  <span className="hidden text-right font-mono text-white/40 tabular-nums sm:block">{e.kills.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-white/30">{total.toLocaleString()} pilot{total === 1 ? '' : 's'} ranked — every score earned, never bought.</p>

          <TopChat topKeys={entries.slice(0, 20).map((e) => e.address)} />
        </>
      )}
    </>
  );
}
