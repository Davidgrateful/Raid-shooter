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

Every figure on this screen is read from the engine or the server. Where a
value does not exist, the panel says less rather than inventing it — see the
note on the mission's reward ladder below for the one place that mattered.
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

/*------------------------------------------------------------------------------
Pilot identity plate

V2 turns the old centred caption stack into a single instrument: the call sign
and tier on one line, the hull and its ability beneath, then a bracketed XP
track with the level set in its own chip. It reads as a plate bolted to the
hangar rail rather than as text that happens to sit under a picture.
------------------------------------------------------------------------------*/
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
  const maxed = player.level >= player.maxLevel;
  const xpRatio = maxed ? 1 : player.xpInto / player.xpSpan;

  return (
    <div className="rs-ident">
      {/* call sign + tier — the loudest thing on screen after DEPLOY, and
          editable in place: a new pilot lands here reading UNNAMED PILOT, and
          that should be an invitation rather than a label */}
      <div className="rs-ident-name">
        <h1
          className={onRename ? 'rs-ident-callsign rs-ident-editable' : 'rs-ident-callsign'}
          onClick={onRename}
          role={onRename ? 'button' : undefined}
          tabIndex={onRename ? 0 : undefined}
          onKeyDown={onRename ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRename(); } } : undefined}
          title={onRename ? 'Change call sign' : undefined}
        >
          {player.callSign}
          {onRename && <span className="rs-ident-pen" aria-hidden>✎</span>}
        </h1>
        <span className="rs-badge" style={{ color: player.tierColor, background: `${player.tierColor}1a` }}>
          {player.tierName}
        </span>
      </div>

      {/* the hull, named and rated */}
      <div className="rs-ident-hull">
        <span className="rs-ident-swatch" style={{ background: player.shipColor, boxShadow: `0 0 8px ${player.shipColor}` }} />
        <span style={{ color: player.shipColor }}>{player.ship?.title || 'NO HULL'}</span>
        {player.ship?.ability && (
          <>
            <span className="rs-ident-sep">/</span>
            <span style={{ color: 'var(--rs-purple)' }}>{player.ship.ability.title}</span>
          </>
        )}
      </div>

      {/* level + XP: progression, always visible, never shouting */}
      <div className="rs-xp">
        <span className="rs-xp-level">
          <span className="rs-xp-level-cap">LVL</span>
          <span className="rs-num rs-xp-level-num">
            {player.level}<span className="rs-xp-level-max">/{player.maxLevel}</span>
          </span>
        </span>
        <div className="rs-xp-track">
          <div className={`rs-meter ${maxed ? 'rs-meter-gold' : 'rs-meter-xp'}`}>
            <div className="rs-meter-fill" style={{ width: `${xpRatio * 100}%` }} />
          </div>
          <div className="rs-xp-figures">
            <span>Pilot XP</span>
            <span className="rs-num">
              {maxed ? 'MAX RANK' : `${player.xpInto.toLocaleString()} / ${player.xpSpan.toLocaleString()} XP`}
            </span>
          </div>
        </div>
      </div>

      {/* hull telemetry — hidden on the shortest screens, where the CTA wins */}
      {stats && !compact && (
        <div className="rs-telemetry">
          {([
            ['Hull', stats.hull, 'var(--rs-green)'],
            ['Thrust', stats.thrust, 'var(--rs-cyan)'],
            ['Dash', stats.dash, 'var(--rs-purple)'],
          ] as const).map(([name, value, tone]) => (
            <div key={name} className="rs-telemetry-cell">
              <span className="rs-telemetry-label">{name}</span>
              <div className="rs-meter rs-meter-thin">
                <div className="rs-meter-fill" style={{ width: `${value * 100}%`, background: tone, boxShadow: `0 0 8px -2px ${tone}` }} />
              </div>
              <span className="rs-num rs-telemetry-value" style={{ color: tone }}>{Math.round(value * 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*------------------------------------------------------------------------------
Primary CTA

The single most obvious interactive element on the screen. Idle is a charged
face with a slow energy sweep; hover lifts and brightens; press compresses
immediately. The corner brackets are the same reticle motif as the hangar
rings, so the action reads as part of the same machine.
------------------------------------------------------------------------------*/
export function DeployCta({ onDeploy, sub }: { onDeploy: () => void; sub: string }) {
  return (
    <button className="rs-cta" onClick={onDeploy} aria-label="Deploy">
      <span className="rs-cta-face rs-cut">
        <span className="rs-cta-bracket" style={{ top: 8, left: 8, borderRight: 0, borderBottom: 0 }} />
        <span className="rs-cta-bracket" style={{ bottom: 8, right: 8, borderLeft: 0, borderTop: 0 }} />
        <span className="rs-cta-label">DEPLOY</span>
      </span>
      <span className="rs-cta-sub">{sub}</span>
    </button>
  );
}

/*------------------------------------------------------------------------------
Daily mission

The one place a progress bar was tempting and would have been a lie. The
challenge is scored IN ONE RUN — `dailyDone()` is a per-day boolean and no
partial count is kept between runs, so a "12 / 30" bar would be invented data.

What IS real is the reward ladder: `dailyXpFor()` pays 250 on day one, 300 on
day two and 400 from day three, and the streak that walks it is stored. So the
card shows the ladder with the current rung lit — genuine progression, and a
sharper hook than a fake bar, because it tells the player what tomorrow is
worth.
------------------------------------------------------------------------------*/
const XP_LADDER = [250, 300, 400];

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
  // which rung today's payout sits on, derived from the payout itself so the
  // card can never drift from what the engine will actually award
  const rung = Math.max(0, XP_LADDER.indexOf(xp));

  return (
    <section className={`rs-mission rs-cut ${done ? 'is-done' : ''}`}>
      <header className="rs-mission-head">
        <span className="rs-mission-tick" aria-hidden />
        <h2 className="rs-label" style={{ color: done ? 'var(--rs-green)' : 'var(--rs-cyan)' }}>Daily raid</h2>
        {streak >= 2 && (
          <span className="rs-mission-streak">
            <span className="rs-mission-streak-icon"><IconFlame /></span>
            <span className="rs-num">{streak}</span>D
          </span>
        )}
      </header>

      <button onClick={onOpen} className="rs-mission-body">
        <span className={`rs-mission-icon ${done ? 'is-done' : ''}`}>
          <IconTarget />
        </span>
        <span className="rs-mission-text">{text}</span>
      </button>

      {/* The reward ladder — real, and it says what tomorrow is worth. Without
          a caption "250 / 300 / 400" is three numbers with no meaning, so the
          rung count is stated plainly above it. */}
      <div className="rs-ladder-head">
        <span>Streak reward</span>
        <span className="rs-num">Day {Math.min(rung + 1, XP_LADDER.length)} of {XP_LADDER.length}</span>
      </div>
      <div className="rs-ladder" aria-label={`Streak reward ladder, currently paying ${xp} XP per completion`}>
        {XP_LADDER.map((amount, i) => (
          <div
            key={amount}
            className="rs-ladder-rung"
            data-state={i < rung ? 'passed' : i === rung ? 'current' : 'ahead'}
          >
            <span className="rs-ladder-bar" />
            <span className="rs-num rs-ladder-amount">{amount}</span>
          </div>
        ))}
      </div>

      <footer className="rs-mission-foot">
        <span className={`rs-badge ${done ? 'rs-rarity-common' : 'rs-rarity-rare'}`}>
          {done ? 'Complete' : 'Active'}
        </span>
        <span className="rs-num rs-mission-pay">
          {done ? `+${xp.toLocaleString()} XP earned` : `+${xp.toLocaleString()} XP`}
        </span>
      </footer>
    </section>
  );
}

/*------------------------------------------------------------------------------
Reward drop

A claim is a drop, not a notification. Rarity colour, a lit frame, the item
named as an item with its quantity — and the wallet requirement demoted to
fine print underneath rather than being the headline it used to be.
------------------------------------------------------------------------------*/
export function RewardPanel({
  kind,
  title,
  itemTitle,
  quantity = 1,
  claimable,
  busy,
  message,
  note,
  onClaim,
}: {
  kind: 'weekly' | 'streak';
  title: string;
  itemTitle: string;
  quantity?: number;
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
      className={`rs-drop rs-cut ${claimable ? 'is-ready' : ''}`}
      style={{ ['--drop' as string]: accent }}
    >
      <div className="rs-drop-head">
        <span className="rs-drop-tick" aria-hidden />
        <span className="rs-label" style={{ color: accent }}>{title}</span>
      </div>

      <div className="rs-drop-body">
        <span className="rs-drop-slot">
          <span className="rs-drop-icon">{gold ? <IconGift /> : <IconFlame />}</span>
          <span className="rs-drop-qty rs-num">×{quantity}</span>
        </span>
        <span className="rs-drop-info">
          <span className="rs-drop-item">{itemTitle}</span>
          <span className={`rs-badge ${gold ? 'rs-rarity-legendary' : 'rs-rarity-epic'}`}>
            {gold ? 'Legendary' : 'Epic'}
          </span>
        </span>
      </div>

      {claimable ? (
        <button onClick={onClaim} disabled={busy} className={`rs-btn ${gold ? 'rs-btn-gold' : ''} rs-drop-claim`}>
          {busy ? 'Claiming…' : 'Claim drop'}
        </button>
      ) : (
        <p className="rs-drop-note">{note}</p>
      )}
      {message && <p className="rs-drop-msg">{message}</p>}
    </div>
  );
}

/*------------------------------------------------------------------------------
Reward unlocked

A cosmetic the player WON — a cup prize, not a purchase. It is the rarest thing
that can appear on this screen, so it gets the loudest card and sits above
everything else in the ops lane until it is acknowledged.
------------------------------------------------------------------------------*/
export function RewardWonPanel({ title, onEquip }: { title: string; onEquip: () => void }) {
  return (
    <div className="rs-drop rs-drop-won rs-cut is-ready" style={{ ['--drop' as string]: 'var(--rs-gold)' }}>
      <div className="rs-drop-head">
        <span className="rs-live-dot rs-drop-live" aria-hidden />
        <span className="rs-label" style={{ color: 'var(--rs-gold)' }}>Reward unlocked</span>
      </div>
      <p className="rs-drop-won-title">You won {title}</p>
      <p className="rs-drop-note">Earned on the board — it can&apos;t be bought.</p>
      <button onClick={onEquip} className="rs-btn rs-btn-gold rs-drop-claim">Equip it</button>
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
        <button onClick={onOpen} className="rs-panel-go">
          Board <span className="rs-panel-go-icon"><IconChevron /></span>
        </button>
      }
    >
      <div className="rs-stand">
        <div>
          <div className="rs-label">Rank</div>
          <div className="rs-num rs-stand-rank">
            {rank ? <>#{rank.rank}</> : <span className="text-white/30">—</span>}
          </div>
          {rank && <div className="rs-stand-of">of {rank.total.toLocaleString()}</div>}
        </div>
        <div className="rs-stand-best">
          <div className="rs-label">Best</div>
          <div className="rs-num rs-stand-score" style={{ color: player.tierColor }}>
            {player.best.toLocaleString()}
          </div>
        </div>
      </div>

      {toNext ? (
        <div className="mt-3">
          <div className="rs-stand-next">
            <span>Next</span>
            <span style={{ color: player.tierColor }}>{toNext.name}</span>
          </div>
          <div className="rs-meter">
            <div className="rs-meter-fill" style={{ width: `${progress * 100}%`, background: player.tierColor, boxShadow: `0 0 10px -2px ${player.tierColor}` }} />
          </div>
        </div>
      ) : (
        <p className="rs-drop-note mt-3">Top tier reached — hold the line.</p>
      )}

      {!rank && <p className="rs-drop-note mt-3">Unranked. Finish a raid to claim a position.</p>}
    </Panel>
  );
}

/*------------------------------------------------------------------------------
Live cup — stakes, not a crypto banner
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
    <button onClick={onOpen} className="rs-cup rs-cut">
      <span aria-hidden className="rs-cup-glow" />
      <span className="rs-cup-head">
        <span className="rs-live-dot rs-cup-live" />
        <span className="rs-label" style={{ color: 'var(--rs-gold)' }}>Live event</span>
      </span>
      <span className="rs-cup-row">
        <span className="rs-cup-name">{name}</span>
        {prize ? <span className="rs-num rs-cup-prize">${prize.toLocaleString()}</span> : null}
      </span>
      <span className="rs-cup-meta">
        <span className="rs-cup-bolt"><IconBolt /></span>
        {ends ? <span>Ends in {ends}</span> : <span>Running now</span>}
        {sponsor && <span className="rs-cup-sponsor">· {sponsor}</span>}
      </span>
    </button>
  );
}
