'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShipViewport } from './ShipViewport';
import { NavRail, TabBar, TopHud, type NavEntry } from './hud';
import { CupPanel, DeployCta, MissionPanel, Panel, PilotIdentity, RankPanel, RewardPanel, RewardWonPanel } from './panels';
import { engine, readPlayer, useEngineRevision, useEngineState, withEngine, type PlayerSnapshot, type ShipDef } from './engine';
import { guestToken, timeLeft, useMenuData } from './useMenuData';
import { IconArmory, IconDeploy, IconMail, IconPilot, IconRankings, IconSystem } from './icons';

/*==============================================================================
COMMAND CENTRE

The main menu, rebuilt as the player's ship terminal rather than a page of
buttons. The canvas engine still owns the starfield and the drifting hangar
traffic behind this - it just stops drawing its own menu chrome (see the
`__htmlMenu` gate in game.js) and hands the screen over.

Reading order is fixed and deliberate. In the first three seconds:

  1. THIS IS A GAME        the starfield, the lit hull, the reticle
  2. THIS IS MY PILOT      call sign + tier, dead centre, largest text
  3. THIS IS MY SHIP       the actual equipped hull, turning under its rings
  4. THIS IS MY PROGRESS   level, XP bar, hull telemetry directly beneath it
  5. THIS IS WHAT I PRESS  DEPLOY - the only element on screen that glows

Everything else (ops, drops, standing, the cup) is deliberately quieter and
sits to the side, and every one of those cards answers one of "what can I do /
what can I earn / where do I rank". Nothing is here to fill space.
==============================================================================*/

/** Screens where a phone in portrait is a first-class layout, not an error. */
const PORTRAIT_OK = new Set(['menu', 'loading', 'board', 'hangar', '']);

export const NAV: NavEntry[] = [
  { id: 'deploy', label: 'Deploy', hint: 'Launch a raid', short: 'Deploy', Icon: IconDeploy, state: 'playmode' },
  { id: 'pilot', label: 'Pilot', hint: 'Hull & loadout', short: 'Pilot', Icon: IconPilot, state: 'hangar' },
  { id: 'armory', label: 'Armory', hint: 'Market', short: 'Armory', Icon: IconArmory, state: 'market' },
  { id: 'rankings', label: 'Rankings', hint: 'Shooterboard', short: 'Ranks', Icon: IconRankings, state: 'board' },
  { id: 'system', label: 'System', hint: 'Settings', short: 'System', Icon: IconSystem, state: 'settings' },
];

function openModal(which: 'news' | 'inbox' | 'invite' | 'feedback') {
  window.dispatchEvent(new CustomEvent('raidshooter:open', { detail: which }));
}

export function CommandCenter() {
  const state = useEngineState();
  const onMenu = state === 'menu';
  const rev = useEngineRevision(onMenu);
  const data = useMenuData(onMenu);

  const [player, setPlayer] = useState<PlayerSnapshot | null>(null);
  const [daily, setDaily] = useState<{ text: string; done: boolean; xp: number; streak: number } | null>(null);
  const [drone, setDrone] = useState<ShipDef | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  const [streakBusy, setStreakBusy] = useState(false);
  const [streakMsg, setStreakMsg] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [short, setShort] = useState(false);
  const [commsUnread, setCommsUnread] = useState(false);
  const [commsLive, setCommsLive] = useState(false);
  const [won, setWon] = useState<{ id: string; title: string } | null>(null);

  /* --- gate the canvas menu off, once ---------------------------------- */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlMenu = 1;
  }, []);

  /* --- squad comms reports its unread state up to the top bar ----------- */
  useEffect(() => {
    const onComms = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setCommsUnread(!!d.unread);
      setCommsLive(!!d.eligible);
    };
    window.addEventListener('raidshooter:comms', onComms as EventListener);
    return () => window.removeEventListener('raidshooter:comms', onComms as EventListener);
  }, []);

  /* --- phone landscape is only ~380px tall: drop to the compact stack --- */
  useEffect(() => {
    const f = () => setShort(window.innerHeight < 560);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  /* --- portrait is a real layout here, but not during a raid ------------ */
  useEffect(() => {
    document.documentElement.dataset.rsPortraitOk = PORTRAIT_OK.has(state) ? '1' : '0';
  }, [state]);

  /* --- read the engine's truth on every menu revision ------------------- */
  useEffect(() => {
    if (!onMenu) return;
    setPlayer(readPlayer());
    setDrone(withEngine((e) => e.equippedDrone?.() ?? null) ?? null);
    setWon(withEngine((e) => e.celebration ?? null) ?? null);
    setDaily(
      withEngine((e) => {
        if (!e.dailyChallenge) return null;
        return {
          text: e.dailyChallenge().text,
          done: !!e.dailyDone?.(),
          xp: e.dailyNextXp?.() ?? 0,
          streak: e.dailyStreak?.() ?? 0,
        };
      }) ?? null,
    );
  }, [onMenu, rev]);

  /* --- navigation ------------------------------------------------------- */
  const go = useCallback((target: string) => {
    setMoreOpen(false);
    withEngine((e) => {
      // a call sign is required before a first run or a first look at the
      // board, so nobody's first score lands under a generated placeholder
      if ((target === 'playmode' || target === 'board') && !e.storage?.['pilotname']) {
        e.promptPilotName?.();
        e.ensurePilotName?.();
      }
      e.setState(target);
    });
  }, []);

  // the engine owns the call sign (it validates and syncs it to the board),
  // so renaming goes through its prompt rather than a second input here
  const rename = useCallback(() => {
    withEngine((e) => {
      e.promptPilotName?.();
      e.ensurePilotName?.();
    });
    setPlayer(readPlayer());
  }, []);

  // A won cosmetic is announced exactly once. Acknowledging it marks it seen
  // in the engine's storage and drops the player into the hangar to put it on.
  const equipReward = useCallback(() => {
    withEngine((e) => {
      if (e.celebration) {
        e.markRewardSeen?.(e.celebration.id);
        e.celebration = null;
      }
    });
    setWon(null);
    go('hangar');
  }, [go]);

  const openCup = useCallback(() => {
    withEngine((e) => {
      e.boardTab = 'cup';
      e.setState('board');
    });
  }, []);

  /* --- claims ----------------------------------------------------------- */
  const claimGift = useCallback(async () => {
    setGiftBusy(true);
    setGiftMsg('');
    try {
      const res = await fetch('/api/claim/weekly', { method: 'POST' });
      const d = await res.json();
      if (res.ok && d.granted) {
        setGiftMsg(`${String(d.granted.title).toUpperCase()} secured — ready for your next raid.`);
        data.refreshGift();
        withEngine((e) => e.fetchProfile?.());
      } else {
        setGiftMsg(d.error === 'already_claimed' ? 'Already claimed this week.' : 'Claim failed — try again.');
      }
    } catch {
      setGiftMsg('Claim failed — try again.');
    } finally {
      setGiftBusy(false);
    }
  }, [data]);

  const claimStreak = useCallback(async () => {
    setStreakBusy(true);
    setStreakMsg('');
    try {
      const res = await fetch('/api/streak/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken: guestToken() || undefined }),
      });
      const d = await res.json();
      if (res.ok && d.granted) {
        setStreakMsg(`${String(d.granted.title).toUpperCase()} secured — ready for your next raid.`);
        data.refreshStreak();
        withEngine((e) => e.fetchProfile?.());
      } else {
        setStreakMsg('Not ready yet — keep the streak alive.');
      }
    } catch {
      setStreakMsg('Claim failed — try again.');
    } finally {
      setStreakBusy(false);
    }
  }, [data]);

  /* --- derived ---------------------------------------------------------- */
  const streakClaimable = !!(
    data.streak &&
    data.streak.days >= data.streak.goal &&
    data.streak.days - data.streak.claimedAt >= data.streak.goal
  );
  const giftClaimable = !!(data.gift?.item && !data.gift.claimed && data.gift.available);
  const giftPending = !!(data.gift?.item && !data.gift.claimed);
  const deploySub = useMemo(() => {
    const dailyLeft = withEngine((e) => !e.dailyRunPlayedToday?.());
    return dailyLeft ? 'Endless raid · daily run available' : 'Endless raid';
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!onMenu) return null;

  const cupEnds = data.cup ? timeLeft(data.cup.endsAt) : '';

  /*----------------------------------------------------------------------
  Supporting column. Same content on every breakpoint - it moves, it never
  gets amputated, because "what can I earn" is not a desktop-only question.
  ----------------------------------------------------------------------*/
  const opsCards = (
    <>
      {won && <RewardWonPanel title={won.title} onEquip={equipReward} />}

      {data.cup && (
        <CupPanel
          name={data.cup.name}
          prize={data.cup.prize1Usd || data.cup.poolUsd || null}
          ends={cupEnds}
          sponsor={data.cup.sponsorName}
          onOpen={openCup}
        />
      )}

      {daily && (
        <MissionPanel
          text={daily.text}
          done={daily.done}
          xp={daily.xp}
          streak={daily.streak}
          onOpen={() => go('playmode')}
        />
      )}

      {streakClaimable && data.streak && (
        <RewardPanel
          kind="streak"
          title={`${data.streak.days} day streak`}
          itemTitle="Field consumable"
          claimable
          busy={streakBusy}
          message={streakMsg}
          onClaim={claimStreak}
        />
      )}

      {giftPending && data.gift?.item && (
        <RewardPanel
          kind="weekly"
          title="Weekly raid reward"
          itemTitle={data.gift.item.title}
          claimable={giftClaimable}
          busy={giftBusy}
          message={giftMsg}
          note="Link a wallet to secure this drop to your pilot."
          onClaim={claimGift}
        />
      )}

      {player && <RankPanel player={player} rank={data.rank} onOpen={() => go('board')} />}

      {data.news && (
        <Panel title="Transmission" accent="var(--rs-purple)">
          <button onClick={() => openModal('news')} className="w-full text-left">
            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/85">{data.news.title}</p>
            <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--rs-purple)]">
              Read briefing
            </span>
          </button>
        </Panel>
      )}
    </>
  );

  return (
    <div data-game-ui="" className="rs-cc" data-short={short ? '1' : '0'}>
      {/* atmosphere: a soft vignette that lets the engine's starfield through
          while keeping the panels legible over it */}
      <div aria-hidden className="rs-cc-veil" />

      <TopHud
        player={player}
        daily={daily}
        streakMilestone={
          !!(data.streak && typeof data.streak.pilotGoal === 'number'
            && data.streak.days >= data.streak.pilotGoal && !data.streak.pilotClaimed)
        }
        cup={data.cup}
        cupEnds={cupEnds}
        commsUnread={commsUnread}
        commsLive={commsLive}
        hasInbox={data.hasInbox}
        unread={data.unread}
        onOpenStreak={() => window.dispatchEvent(new CustomEvent('raidshooter:openstreak'))}
        onOpenComms={() => window.dispatchEvent(new CustomEvent('raidshooter:opencomms'))}
        onOpenInbox={() => openModal('inbox')}
        onOpenCup={openCup}
      />

      <NavRail
        nav={NAV}
        onGo={go}
        onInvite={() => openModal('invite')}
        onFeedback={() => openModal('feedback')}
      />

      {/*==================================================================
      COMMAND AREA - ship, identity, the one action that matters
      ==================================================================*/}
      <main className="rs-cc-main rs-scroll">
        <div className="rs-cc-stage">
          <div className="rs-cc-ship">
            <ShipViewport
              ship={player?.ship ?? null}
              color={player?.shipColor ?? '#fff'}
              trailHue={player?.trailHue ?? null}
              drone={drone}
            />
            {/* Holographic readouts pinned to the bay. Rendered as HTML, not
                canvas, so they use the real webfaces and stay selectable and
                translatable. Every value is read from the engine — the bay
                reports what is loaded, it does not invent instrumentation. */}
            {player && (
              <>
                <div className="rs-bay-tag rs-bay-tag-l" aria-hidden={false}>
                  <span className="rs-bay-cap">Hull</span>
                  <span className="rs-bay-val" style={{ color: player.shipColor }}>
                    {player.ship?.title || '—'}
                  </span>
                </div>
                <div className="rs-bay-tag rs-bay-tag-r">
                  <span className="rs-bay-cap">Class</span>
                  <span className="rs-bay-val" style={{ color: 'var(--rs-purple)' }}>
                    {player.ship?.ability?.title || 'STANDARD'}
                  </span>
                </div>
                {/* what the hull is actually carrying, on the bay floor */}
                <div className="rs-bay-loadout">
                  {player.droneTitle && (
                    <span className="rs-badge rs-rarity-rare">Drone · {player.droneTitle}</span>
                  )}
                  {player.trailHue !== null && (
                    <span className="rs-badge rs-rarity-epic">Trail equipped</span>
                  )}
                </div>
              </>
            )}
          </div>

          {player ? (
            <PilotIdentity player={player} compact={short} onRename={rename} />
          ) : (
            <div className="py-6 text-center text-[11px] uppercase tracking-[0.3em] text-white/25">Linking pilot…</div>
          )}

          <div className="rs-cc-cta">
            <DeployCta onDeploy={() => go('playmode')} sub={deploySub} />
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button className="rs-btn rs-btn-ghost" onClick={() => go('hangar')}>Change hull</button>
              <button className="rs-btn rs-btn-ghost" onClick={() => go('market')}>Armory</button>
            </div>
          </div>
        </div>
      </main>

      {/*==================================================================
      OPS COLUMN - what to do, what to earn, where you stand
      ==================================================================*/}
      <aside className="rs-cc-ops rs-scroll">{opsCards}</aside>

      {/*==================================================================
      BOTTOM NAV - mobile. Thumb-reach, icon-led, five slots, no more.
      ==================================================================*/}
      {/* No tab is lit for LOCATION here: the command deck is home, and home
          is not one of the five destinations. */}
      <TabBar nav={NAV} moreOpen={moreOpen} onGo={go} onMore={() => setMoreOpen((v) => !v)} />

      {moreOpen && (
        <>
          <div className="rs-cc-scrim" onClick={() => setMoreOpen(false)} />
          <div className="rs-cc-sheet rs-rise">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
            <button className="rs-nav-item" onClick={() => go('settings')}>
              <span className="rs-nav-icon"><IconSystem /></span><span>System</span>
            </button>
            <button className="rs-nav-item" onClick={() => { setMoreOpen(false); openModal('invite'); }}>
              <span className="rs-nav-icon text-[color:var(--rs-gold)]">✦</span><span>Invite a wingman</span>
            </button>
            <button className="rs-nav-item" onClick={() => { setMoreOpen(false); openModal('feedback'); }}>
              <span className="rs-nav-icon">✎</span><span>Send feedback</span>
            </button>
            {data.hasInbox && (
              <button className="rs-nav-item" onClick={() => { setMoreOpen(false); openModal('inbox'); }}>
                <span className="rs-nav-icon"><IconMail /></span><span>Inbox</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Exposed so the engine-facing bits can tell whether this overlay is live. */
export function isCommandCenterActive(): boolean {
  return !!engine() && (window as unknown as Record<string, unknown>).__htmlMenu === 1;
}
