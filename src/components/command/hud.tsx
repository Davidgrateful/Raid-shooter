'use client';

import type { ReactNode } from 'react';
import { WalletButton } from '@/components/WalletButton';
import type { PlayerSnapshot } from './engine';
import type { CupSeason } from './useMenuData';
import { IconChevron, IconComms, IconFlame, IconMail, IconSignal } from './icons';

/*==============================================================================
Command chrome — the top HUD and the navigation terminal

These two pieces are what make the screen read as a running game rather than a
page. Both follow the same rule: they are INSTRUMENTS. They report state, they
never decorate. Everything in them is a real value read from the engine or the
server, laid out in tabular figures with a technical label above it.

The top HUD is a segmented strip, not a nav bar — segments divided by hairline
ticks, each one a readout. The rail is a terminal: a header saying where you
are, the destinations you can reach, and the utilities that support them,
grouped tightly so the column reads as one instrument rather than two things
separated by a void.
==============================================================================*/

/*------------------------------------------------------------------------------
A single readout in the top strip: technical caption, then the figure.
------------------------------------------------------------------------------*/
function Readout({
  label,
  children,
  tone,
  onClick,
  title,
  badge,
}: {
  label: string;
  children: ReactNode;
  tone?: string;
  onClick?: () => void;
  title?: string;
  badge?: ReactNode;
}) {
  const inner = (
    <>
      <span className="rs-readout-label">{label}</span>
      <span className="rs-readout-value" style={tone ? { color: tone } : undefined}>{children}</span>
      {badge}
    </>
  );
  return onClick ? (
    <button type="button" className="rs-readout" onClick={onClick} title={title}>{inner}</button>
  ) : (
    <div className="rs-readout" title={title}>{inner}</div>
  );
}

export function TopHud({
  player,
  daily,
  streakMilestone,
  cup,
  cupEnds,
  commsUnread,
  commsLive,
  hasInbox,
  unread,
  onOpenStreak,
  onOpenComms,
  onOpenInbox,
  onOpenCup,
}: {
  player: PlayerSnapshot | null;
  daily: { streak: number } | null;
  streakMilestone: boolean;
  cup: CupSeason | null;
  cupEnds: string;
  commsUnread: boolean;
  commsLive: boolean;
  hasInbox: boolean;
  unread: number;
  onOpenStreak: () => void;
  onOpenComms: () => void;
  onOpenInbox: () => void;
  onOpenCup: () => void;
}) {
  return (
    <header className="rs-cc-top">
      {/*--- identity: the brand, then where you are ---------------------*/}
      <div className="rs-hud-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Raid Shooter" />
        <span className="rs-hud-screen">
          <span className="rs-hud-screen-tick" aria-hidden />
          Command deck
        </span>
      </div>

      {/*--- live event: only present while a cup is actually running ------*/}
      {cup && (
        <button className="rs-hud-cup" onClick={onOpenCup}>
          <span className="rs-live-dot" aria-hidden />
          <span className="rs-hud-cup-name">{cup.name}</span>
          {cupEnds && <span className="rs-num rs-hud-cup-time">{cupEnds}</span>}
          <span className="rs-hud-cup-go" aria-hidden><IconChevron /></span>
        </button>
      )}

      {/*--- readouts: streak, best, comms, inbox, wallet -----------------*/}
      <div className="rs-hud-readouts">
        {daily && daily.streak > 0 && (
          <Readout
            label="Streak"
            tone="var(--rs-gold)"
            onClick={onOpenStreak}
            title={`${daily.streak} day streak`}
            badge={streakMilestone ? <span className="rs-readout-dot" style={{ background: 'var(--rs-gold)' }} /> : null}
          >
            <span className="rs-readout-icon"><IconFlame /></span>
            <span className="rs-num">{daily.streak}</span>
          </Readout>
        )}

        {player && (
          <Readout label="Best" title="Your best score">
            <span className="rs-readout-icon" style={{ color: 'var(--rs-cyan)' }}><IconSignal /></span>
            <span className="rs-num">{player.best.toLocaleString()}</span>
          </Readout>
        )}

        <Readout
          label="Comms"
          onClick={onOpenComms}
          title={commsLive ? 'Squad comms — you are in the top 20' : 'Squad comms — open to the top 20'}
          tone={commsLive ? 'var(--rs-green)' : undefined}
          badge={commsUnread ? <span className="rs-readout-dot rs-live-dot" style={{ background: 'var(--rs-red)' }} /> : null}
        >
          <span className="rs-readout-icon"><IconComms /></span>
          <span className="rs-readout-word">{commsLive ? 'Online' : 'Top 20'}</span>
        </Readout>

        {hasInbox && (
          <Readout
            label="Inbox"
            onClick={onOpenInbox}
            title="Payouts and event results"
            badge={unread > 0 ? <span className="rs-readout-count">{unread > 9 ? '9+' : unread}</span> : null}
          >
            <span className="rs-readout-icon"><IconMail /></span>
          </Readout>
        )}

        <div className="rs-hud-wallet"><WalletButton /></div>
      </div>
    </header>
  );
}

/*==============================================================================
Navigation terminal
==============================================================================*/
export interface NavEntry {
  id: string;
  label: string;
  hint: string;
  short: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  state: string;
}

export function NavRail({
  nav,
  onGo,
  onInvite,
  onFeedback,
}: {
  nav: NavEntry[];
  onGo: (target: string) => void;
  onInvite: () => void;
  onFeedback: () => void;
}) {
  return (
    <nav className="rs-cc-rail" aria-label="Main">
      {/* Where you are. DEPLOY is an ACTION that leaves this screen, so it is
          marked as the primary route rather than as "the current page" — the
          old build lit it as active while you were sitting on the home
          screen, which is simply not true. */}
      <div className="rs-rail-head">
        <span className="rs-rail-head-tick" aria-hidden />
        <span>Command</span>
      </div>

      <div className="rs-rail-group">
        {nav.map(({ id, label, hint, Icon, state: target }) => (
          <button
            key={id}
            className="rs-nav-item"
            data-primary={id === 'deploy' ? 'true' : 'false'}
            onClick={() => onGo(target)}
          >
            <span className="rs-nav-icon"><Icon /></span>
            <span className="rs-nav-text">
              <span className="rs-nav-label">{label}</span>
              <span className="rs-nav-hint">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Utilities sit directly under the destinations, not pinned to the
          bottom of the viewport. They are secondary, not distant — the old
          layout left several hundred pixels of dead rail between them. */}
      <div className="rs-rail-head rs-rail-head-sub">
        <span className="rs-rail-head-tick" aria-hidden />
        <span>Squad</span>
      </div>
      <div className="rs-rail-group">
        <button className="rs-nav-item rs-nav-item-sm" onClick={onInvite}>
          <span className="rs-nav-icon" style={{ color: 'var(--rs-gold)' }}>✦</span>
          <span className="rs-nav-text"><span className="rs-nav-label">Invite</span></span>
        </button>
        <button className="rs-nav-item rs-nav-item-sm" onClick={onFeedback}>
          <span className="rs-nav-icon">✎</span>
          <span className="rs-nav-text"><span className="rs-nav-label">Feedback</span></span>
        </button>
      </div>
    </nav>
  );
}
