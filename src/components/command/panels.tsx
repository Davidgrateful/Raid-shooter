'use client';

import type { ReactNode } from 'react';
import type { PlayerSnapshot, ShipDef } from './engine';
import { IconBolt, IconChevron, IconFlame, IconGift, IconTarget } from './icons';

/*==============================================================================
Command centre panels

Each panel exists to answer exactly one of the questions the player arrives
with. Nothing here is filler:

  PilotIdentity  -> who am I, what am I flying, how am I progressing
  DeployCta      -> what should I press
  MissionPanel   -> what should I do today, and what does it pay
  RewardPanel    -> what can I collect right now
  RankPanel      -> where do I stand
  CupPanel       -> what is at stake right now
==============================================================================*/

/*------------------------------------------------------------------------------
Shared chrome
------------------------------------------------------------------------------*/
export function Panel({
  title,
  accent = 'var(--rs-cyan)',
  action,
  children,
  className = '',
}: {
  title: string;
  accent?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rs-panel rs-cut p-3 ${className}`}>
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-0.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <h2 className="rs-label" style={{ color: accent }}>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Meter({ value, tone = 'xp', className = '' }: { value: number; tone?: 'xp' | 'gold' | 'green'; className?: string }) {
  return (
    <div className={`rs-meter rs-meter-${tone} ${className}`}>
      <div className="rs-meter-fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/*------------------------------------------------------------------------------
Ship readout

The hull's real definition numbers, turned into three comparable meters so
switching pilots in the hangar has a visible consequence on the main screen.
Higher is always better on every bar - the raw multipliers invert for
damage-taken and dash-cooldown, which would otherwise read backwards.
------------------------------------------------------------------------------*/
function statsFor(ship: ShipDef | null) {
  if (!ship) return null;
  const clamp = (n: number) => Math.max(0.08, Math.min(1, n));
  return {
    hull: clamp((1.5 - (ship.damageTakenMult ?? 1)) / 0.9),
    thrust: clamp(((ship.speedMult ?? 1) - 0.65) / 0.7),
    dash: clamp((1.45 - (ship.dashCooldownMult ?? 1)) / 0.8),
  };
}

export function PilotIdentity({
  player,
  compact = false,
  onRename,
}: {
  player: PlayerSnapshot;
  compact?: boolean;
  onRename?: () => void;
}) {
  const stats = statsFor(player.ship);
  const xpRatio = player.level >= player.maxLevel ? 1 : player.xpInto / player.xpSpan;
  const maxed = player.level >= player.maxLevel;

  return (
    <div className="w-full">
      {/* Call sign + tier: the player's name is the loudest thing after
          DEPLOY, and it is editable right here. A new pilot lands on this
          screen reading UNNAMED PILOT - that should be an invitation, not a
          label they have to go hunting through SYSTEM to change. */}
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
        <h1
          className={`rs-display text-[clamp(18px,3.6vw,30px)] leading-none text-white ${
            onRename ? 'group cursor-pointer transition-colors hover:text-[color:var(--rs-cyan)]' : ''
          }`}
          style={{ textShadow: '0 0 28px rgba(53,232,255,0.35)' }}
          onClick={onRename}
          role={onRename ? 'button' : undefined}
          tabIndex={onRename ? 0 : undefined}
          onKeyDown={onRename ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRename(); } } : undefined}
          title={onRename ? 'Change call sign' : undefined}
        >
          {player.callSign}
          {onRename && (
            <span className="ml-2 align-middle text-[11px] font-semibold tracking-normal text-white/20 transition-colors group-hover:text-[color:var(--rs-cyan)]">
              ✎
            </span>
          )}
        </h1>
        <span className="rs-badge" style={{ color: player.tierColor, background: `${player.tierColor}1a` }}>
          {player.tierName}
        </span>
      </div>

      {/* the hull, named and rated */}
      <div className="mt-1.5 flex items-center justify-center gap-2 text-[11px] tracking-[0.18em] text-white/45">
        <span className="inline-block h-1.5 w-1.5 rotate-45" style={{ background: player.shipColor, boxShadow: `0 0 8px ${player.shipColor}` }} />
        <span className="font-bold uppercase" style={{ color: player.shipColor }}>{player.ship?.title || 'NO HULL'}</span>
        {player.ship?.ability && (
          <>
            <span className="text-white/20">/</span>
            <span className="uppercase text-[color:var(--rs-purple)]">{player.ship.ability.title}</span>
          </>
        )}
      </div>

      {/* level + XP: progression, always visible, never shouting */}
      <div className="mx-auto mt-3 w-full max-w-sm">
        <div className="mb-1 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.2em]">
          <span className="text-[color:var(--rs-cyan)]">
            LVL <span className="rs-num text-sm">{player.level}</span>
            <span className="text-white/25">/{player.maxLevel}</span>
          </span>
          <span className="rs-num text-[10px] text-white/35">
            {maxed ? 'MAX RANK' : `${player.xpInto.toLocaleString()} / ${player.xpSpan.toLocaleString()} XP`}
          </span>
        </div>
        <Meter value={xpRatio} tone={maxed ? 'gold' : 'xp'} />
      </div>

      {/* hull telemetry - hidden on the shortest screens, where the CTA wins */}
      {stats && !compact && (
        <div className="mx-auto mt-3 grid w-full max-w-sm grid-cols-3 gap-3">
          {([
            ['HULL', stats.hull, 'var(--rs-green)'],
            ['THRUST', stats.thrust, 'var(--rs-cyan)'],
            ['DASH', stats.dash, 'var(--rs-purple)'],
          ] as const).map(([label, value, tone]) => (
            <div key={label}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="rs-label">{label}</span>
                <span className="rs-num text-[10px]" style={{ color: tone }}>{Math.round(value * 100)}%</span>
              </div>
              <div className="rs-meter">
                <div className="rs-meter-fill" style={{ width: `${value * 100}%`, background: tone, boxShadow: `0 0 10px -2px ${tone}` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*------------------------------------------------------------------------------
Primary CTA
------------------------------------------------------------------------------*/
export function DeployCta({ onDeploy, sub }: { onDeploy: () => void; sub: string }) {
  return (
    <button className="rs-cta group" onClick={onDeploy} aria-label="Deploy">
      <span className="rs-cta-face rs-cut">
        <span className="rs-cta-bracket" style={{ top: 8, left: 8, borderRight: 0, borderBottom: 0 }} />
        <span className="rs-cta-bracket" style={{ bottom: 8, right: 8, borderLeft: 0, borderTop: 0 }} />
        <span className="rs-cta-label">DEPLOY</span>
      </span>
      <span className="mt-1.5 block text-center text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">{sub}</span>
    </button>
  );
}

/*------------------------------------------------------------------------------
Daily mission
------------------------------------------------------------------------------*/
export function MissionPanel({
  text,
  done,
  xp,
  streak,
  onOpen,
}: {
  text: string;
  done: boolean;
  xp: number;
  streak: number;
  onOpen: () => void;
}) {
  return (
    <Panel
      title="Daily ops"
      accent={done ? 'var(--rs-green)' : 'var(--rs-cyan)'}
      action={
        streak >= 2 ? (
          <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.14em] text-[color:var(--rs-gold)]">
            <span className="inline-block h-3 w-3"><IconFlame /></span>
            {streak}D
          </span>
        ) : null
      }
    >
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-start gap-2.5">
          <span className={`mt-0.5 inline-block h-4 w-4 shrink-0 ${done ? 'text-[color:var(--rs-green)]' : 'text-[color:var(--rs-cyan)]'}`}>
            <IconTarget />
          </span>
          <p className={`text-[13px] font-semibold leading-snug ${done ? 'text-white/45 line-through decoration-white/25' : 'text-white/90'}`}>
            {text}
          </p>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className={`rs-badge ${done ? 'rs-rarity-common' : 'rs-rarity-rare'}`}>
            {done ? 'Complete' : 'Active'}
          </span>
          <span className="rs-num text-[11px] text-[color:var(--rs-gold)]">+{xp.toLocaleString()} XP</span>
        </div>
      </button>
    </Panel>
  );
}

/*------------------------------------------------------------------------------
Reward drop

A claim is a drop, not a notification. Rarity colour, a lit card, the item
named as an item - and the wallet requirement demoted to fine print underneath
rather than being the headline.
------------------------------------------------------------------------------*/
export function RewardPanel({
  kind,
  title,
  itemTitle,
  claimable,
  busy,
  message,
  note,
  onClaim,
}: {
  kind: 'weekly' | 'streak';
  title: string;
  itemTitle: string;
  claimable: boolean;
  busy: boolean;
  message: string;
  note?: string;
  onClaim: () => void;
}) {
  const gold = kind === 'weekly';
  const accent = gold ? 'var(--rs-gold)' : 'var(--rs-purple)';
  return (
    <div
      className={`rs-reward rs-cut p-3 ${claimable ? 'rs-reward-ready' : ''}`}
      style={{ ['--rs-reward-glow' as string]: gold ? 'rgba(255,207,77,0.2)' : 'rgba(185,140,255,0.2)' }}
    >
      <div className="relative flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border"
          style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}
        >
          <span className="block h-6 w-6">{gold ? <IconGift /> : <IconFlame />}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="rs-label" style={{ color: accent }}>{title}</div>
          <div className="mt-1 truncate text-[13px] font-bold uppercase tracking-wide text-white">{itemTitle}</div>
          <div className="mt-1.5">
            <span className={`rs-badge ${gold ? 'rs-rarity-legendary' : 'rs-rarity-epic'}`}>{gold ? 'Legendary' : 'Epic'}</span>
          </div>
        </div>
      </div>

      {claimable ? (
        <button onClick={onClaim} disabled={busy} className={`rs-btn ${gold ? 'rs-btn-gold' : ''} mt-3 w-full`}>
          {busy ? 'Claiming…' : 'Claim drop'}
        </button>
      ) : (
        <p className="relative mt-3 text-[11px] leading-relaxed text-white/40">{note}</p>
      )}
      {message && (
        <p className="relative mt-2 text-[11px] font-semibold text-[color:var(--rs-green)]">{message}</p>
      )}
    </div>
  );
}

/*------------------------------------------------------------------------------
Reward unlocked

A cosmetic the player WON - a cup prize, not a purchase. It is the rarest thing
that can appear on this screen, so it gets the loudest card: gold, lit, and
sitting above everything else in the ops lane until it is acknowledged.
------------------------------------------------------------------------------*/
export function RewardWonPanel({ title, onEquip }: { title: string; onEquip: () => void }) {
  return (
    <div
      className="rs-reward rs-reward-ready rs-cut rs-rise p-3"
      style={{ ['--rs-reward-glow' as string]: 'rgba(255,207,77,0.3)', borderColor: 'rgba(255,207,77,0.6)' }}
    >
      <div className="relative flex items-center gap-2">
        <span className="rs-live-dot h-1.5 w-1.5 rounded-full bg-[color:var(--rs-gold)]" />
        <span className="rs-label text-[color:var(--rs-gold)]">Reward unlocked</span>
      </div>
      <p className="relative mt-2 text-sm font-bold uppercase leading-snug text-white">You won {title}</p>
      <p className="relative mt-1 text-[11px] text-white/45">Earned on the board — it can&apos;t be bought.</p>
      <button onClick={onEquip} className="rs-btn rs-btn-gold mt-3 w-full">Equip it</button>
    </div>
  );
}

/*------------------------------------------------------------------------------
Standing
------------------------------------------------------------------------------*/
export function RankPanel({
  player,
  rank,
  onOpen,
}: {
  player: PlayerSnapshot;
  rank: { rank: number; total: number; score: number } | null;
  onOpen: () => void;
}) {
  const toNext = player.toNextTier;
  const progress = toNext && toNext.min > 0 ? Math.min(1, player.best / toNext.min) : 1;

  return (
    <Panel
      title="Standing"
      accent={player.tierColor}
      action={
        <button onClick={onOpen} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 hover:text-white">
          Board <span className="inline-block h-3 w-3"><IconChevron /></span>
        </button>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="rs-label">Rank</div>
          <div className="rs-num text-2xl leading-none text-white">
            {rank ? <>#{rank.rank}</> : <span className="text-white/30">—</span>}
          </div>
          {rank && <div className="mt-1 text-[10px] tracking-wider text-white/30">of {rank.total.toLocaleString()}</div>}
        </div>
        <div className="text-right">
          <div className="rs-label">Best</div>
          <div className="rs-num text-xl leading-none" style={{ color: player.tierColor }}>
            {player.best.toLocaleString()}
          </div>
        </div>
      </div>

      {toNext ? (
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-[10px] tracking-wider">
            <span className="text-white/30">NEXT</span>
            <span className="font-bold" style={{ color: player.tierColor }}>{toNext.name}</span>
          </div>
          <div className="rs-meter">
            <div className="rs-meter-fill" style={{ width: `${progress * 100}%`, background: player.tierColor, boxShadow: `0 0 10px -2px ${player.tierColor}` }} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-white/30">Top tier reached — hold the line.</p>
      )}

      {!rank && (
        <p className="mt-3 text-[11px] leading-relaxed text-white/35">
          Unranked. Finish a raid to claim a position.
        </p>
      )}
    </Panel>
  );
}

/*------------------------------------------------------------------------------
Live cup - stakes, not a crypto banner
------------------------------------------------------------------------------*/
export function CupPanel({
  name,
  prize,
  ends,
  sponsor,
  onOpen,
}: {
  name: string;
  prize: number | null;
  ends: string;
  sponsor: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="rs-panel rs-cut relative w-full overflow-hidden p-3 text-left transition-colors hover:border-[color:var(--rs-gold)]"
      style={{ borderColor: 'rgba(255,207,77,0.32)' }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(255,207,77,0.2), transparent 70%)' }}
      />
      <div className="relative flex items-center gap-2">
        <span className="rs-live-dot h-1.5 w-1.5 rounded-full bg-[color:var(--rs-red)]" />
        <span className="rs-label text-[color:var(--rs-gold)]">Live event</span>
      </div>
      <div className="relative mt-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-bold uppercase tracking-wide text-white">{name}</span>
        {prize ? <span className="rs-num shrink-0 text-sm text-[color:var(--rs-gold)]">${prize.toLocaleString()}</span> : null}
      </div>
      <div className="relative mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
        <span className="inline-block h-3 w-3 text-[color:var(--rs-gold)]"><IconBolt /></span>
        {ends ? <span>Ends in {ends}</span> : <span>Running now</span>}
        {sponsor && <span className="truncate text-white/25">· {sponsor}</span>}
      </div>
    </button>
  );
}
