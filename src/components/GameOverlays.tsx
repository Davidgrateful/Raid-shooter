'use client';

import { useEffect, useState } from 'react';

// Player-facing HTML overlays for operator content + feedback, shown only on
// the menu screen so they never intrude on gameplay:
//   - a dismissible NEWS banner showing the latest active announcement
//   - a Feedback button + modal that posts to /api/feedback
// Both read/write the same endpoints the admin console manages.

interface Announcement { id: string; title: string; body: string }
interface WeeklyGift { available: boolean; claimed?: boolean; item: { id: string; title: string } | null }
interface StreakState { days: number; claimedAt: number; goal: number; pilotGoal?: number; pilotClaimed?: boolean }
interface CupSeason { id: string; name: string; live: boolean; prize1Usd?: number; poolUsd?: number; endsAt: number | null; sponsorName: string | null }
interface InboxMessage { id: string; kind: 'payout' | 'cup' | 'system'; title: string; body: string; at: number; meta?: { txHash?: string; url?: string; amountUsd?: number; rank?: number } }

function myGuestToken(): string | null {
  try {
    const raw = localStorage.getItem('radiusraid');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guesttoken?: string };
    return typeof parsed.guesttoken === 'string' && parsed.guesttoken.length >= 8 ? parsed.guesttoken : null;
  } catch {
    return null;
  }
}

export function GameOverlays() {
  const [onMenu, setOnMenu] = useState(false);
  const [news, setNews] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false); // news expanded
  const [fbOpen, setFbOpen] = useState(false);
  const [fbText, setFbText] = useState('');
  const [fbSent, setFbSent] = useState(false);
  const [fbBusy, setFbBusy] = useState(false);
  const [gift, setGift] = useState<WeeklyGift | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  const [invOpen, setInvOpen] = useState(false);
  const [inv, setInv] = useState<{ code: string; invites: number; top: { code: string; invites: number }[] } | null>(null);
  const [invCopied, setInvCopied] = useState(false);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [streakBusy, setStreakBusy] = useState(false);
  const [streakMsg, setStreakMsg] = useState('');
  const [cup, setCup] = useState<CupSeason | null>(null);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  // track a phone-width breakpoint so docked overlays can restack instead of
  // colliding the way they would if the desktop layout were forced onto a
  // narrow screen (the top cup pill vs the centered news banner especially)
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 640);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  useEffect(() => {
    fetch('/api/season')
      .then((r) => r.json())
      .then((d) => setCup(d.season && d.season.live ? d.season : null))
      .catch(() => {});
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => { if (d.announcements?.length) setNews(d.announcements[0]); })
      .catch(() => {});
    const onState = (e: Event) => {
      const isMenu = (e as CustomEvent).detail === 'menu';
      setOnMenu(isMenu);
      // re-check the weekly gift whenever the menu is entered (the player
      // may have connected a wallet since the last look)
      if (isMenu) {
        // pull the player's inbox (payout confirmations, cup thank-yous)
        const gt = myGuestToken();
        fetch(`/api/inbox${gt ? `?guestToken=${encodeURIComponent(gt)}` : ''}`)
          .then((r) => r.json())
          .then((d) => { setInbox(d.messages || []); setUnread(d.unread || 0); })
          .catch(() => {});
        fetch('/api/claim/weekly').then((r) => r.json()).then(setGift).catch(() => {});
        // record today's play, then read back the full streak state
        // (claimedAt isn't in the record response) - works with no wallet,
        // pure retention hook for guests/web2 players
        const guestToken = myGuestToken();
        fetch('/api/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestToken: guestToken || undefined }),
        })
          .then(() => fetch(`/api/streak${guestToken ? `?guestToken=${encodeURIComponent(guestToken)}` : ''}`))
          .then((r) => r.json())
          .then(setStreak)
          .catch(() => {});
      }
    };
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => window.removeEventListener('raidshooter:state', onState as EventListener);
  }, []);

  async function claimStreak() {
    setStreakBusy(true); setStreakMsg('');
    try {
      const res = await fetch('/api/streak/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken: myGuestToken() || undefined }),
      });
      const d = await res.json();
      if (res.ok && d.granted) {
        setStreakMsg(`Claimed: ${d.granted.title} — ready to use in your next run!`);
        setStreak((prev) => (prev ? { ...prev, claimedAt: d.days } : prev));
        try { (window as unknown as { $: { fetchProfile?: () => void } }).$?.fetchProfile?.(); } catch { /* engine may not be ready */ }
      } else {
        setStreakMsg('Not ready yet — keep the streak going.');
      }
    } catch {
      setStreakMsg('Claim failed — try again.');
    } finally { setStreakBusy(false); }
  }

  async function claimGift() {
    setGiftBusy(true); setGiftMsg('');
    try {
      const res = await fetch('/api/claim/weekly', { method: 'POST' });
      const d = await res.json();
      if (res.ok && d.granted) {
        setGiftMsg(`Claimed: ${d.granted.title} — ready to use in your next run!`);
        setGift({ available: false, claimed: true, item: d.granted });
        // let the engine pick up the new item without a reload
        try { (window as unknown as { $: { fetchProfile?: () => void } }).$?.fetchProfile?.(); } catch { /* engine may not be ready */ }
      } else {
        setGiftMsg(d.error === 'already_claimed' ? 'Already claimed this week.' : 'Claim failed — try again.');
      }
    } catch {
      setGiftMsg('Claim failed — try again.');
    } finally { setGiftBusy(false); }
  }

  const inviteLink = inv?.code ? `${typeof window !== 'undefined' ? window.location.origin : 'https://raidshooter.xyz'}/?ref=${inv.code}` : '';

  async function openInbox() {
    setInboxOpen(true);
    if (unread > 0) {
      setUnread(0); // optimistic clear
      const gt = myGuestToken();
      fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken: gt || undefined }),
      }).catch(() => {});
    }
  }

  async function openInvite() {
    setInvOpen(true);
    setInvCopied(false);
    try {
      const d = await fetch('/api/referral').then((r) => r.json());
      setInv({ code: d.code || '', invites: d.invites || 0, top: d.top || [] });
    } catch { /* keep whatever we had */ }
  }

  async function copyInvite() {
    if (!inviteLink) return;
    try {
      if (navigator.share) { await navigator.share({ title: 'Raid Shooter', text: 'Play Raid Shooter with me — we both earn a boost', url: inviteLink }); return; }
      await navigator.clipboard.writeText(inviteLink);
      setInvCopied(true);
      setTimeout(() => setInvCopied(false), 1600);
    } catch { /* share/copy is best-effort */ }
  }

  async function sendFeedback() {
    if (fbText.trim().length < 2) return;
    setFbBusy(true);
    try {
      await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fbText }) });
      setFbSent(true);
      setFbText('');
      setTimeout(() => { setFbOpen(false); setFbSent(false); }, 1400);
    } finally { setFbBusy(false); }
  }

  function openCup() {
    try {
      const $ = (window as unknown as { $: { boardTab?: string; setState: (s: string) => void } }).$;
      $.boardTab = 'cup';
      $.setState('board');
    } catch { /* engine not ready */ }
  }

  if (!onMenu) return null;

  return (
    <>
      {/* live cup: free "why play today" hook, points into the board's cup
          tab - only shown while a season is actually live */}
      {cup && (
        <div data-game-ui="" style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: 'calc(env(safe-area-inset-left, 0px) + 8px)', zIndex: 45, maxWidth: '55vw' }}>
          <button
            onClick={openCup}
            className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 backdrop-blur-md hover:border-amber-400/70 hover:text-amber-100"
          >
            <span>⚡</span>
            <span className="truncate font-bold uppercase tracking-wide">{cup.name}</span>
            {(cup.prize1Usd || cup.poolUsd) ? (
              <span className="font-mono text-amber-300">{(cup.prize1Usd || cup.poolUsd)} USDC</span>
            ) : null}
          </button>
        </div>
      )}

      {/* news banner */}
      {news && !dismissed && (
        <div data-game-ui="" style={{ position: 'fixed', top: `calc(env(safe-area-inset-top, 0px) + ${cup && narrow ? 48 : 8}px)`, left: '50%', transform: 'translateX(-50%)', zIndex: 45, maxWidth: '92vw' }}>
          <div className="flex items-center gap-3 rounded-full border border-cyan-400/30 bg-black/70 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
            <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">News</span>
            <button onClick={() => setOpen(true)} className="max-w-[60vw] truncate font-medium hover:text-white">{news.title}</button>
            <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* news expanded modal */}
      {open && news && (
        <div data-game-ui="" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="flex items-center justify-center bg-black/60 p-6">
          <div onClick={(e) => e.stopPropagation()} className="max-w-md rounded-2xl border border-white/10 bg-[#0b0e16] p-6 text-white">
            <div className="text-lg font-bold text-cyan-300">{news.title}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{news.body}</p>
            <button onClick={() => setOpen(false)} className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Close</button>
          </div>
        </div>
      )}

      {/* daily streak: no wallet needed, works identically for guests -
          re-arms every {goal} days so it's a repeat hook, not a one-off */}
      {streak && streak.days >= streak.goal && streak.days - streak.claimedAt >= streak.goal && (
        <div data-game-ui="" style={{ position: 'fixed', right: 'calc(env(safe-area-inset-right, 0px) + 12px)', bottom: `calc(env(safe-area-inset-bottom, 0px) + ${gift?.item && !gift.claimed ? 52 : 12}px)`, zIndex: 45, maxWidth: '80vw' }}>
          <div className="flex items-center gap-2 rounded-full border border-orange-400/40 bg-black/60 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm">
            <span>🔥</span>
            <span className="hidden sm:inline">{streak.days}-day streak! Free consumable ready</span>
            <button onClick={claimStreak} disabled={streakBusy}
              className="rounded-full bg-orange-400/90 px-3 py-1 font-semibold text-black hover:bg-orange-300 disabled:opacity-50">
              {streakBusy ? 'Claiming…' : 'Claim free'}
            </button>
          </div>
          {streakMsg && <div className="mt-1 rounded-lg border border-emerald-500/30 bg-black/70 px-3 py-1.5 text-xs text-emerald-300">{streakMsg}</div>}
        </div>
      )}

      {/* weekly gift: shown to wallet players until claimed; guests see the
          hook that makes connecting a wallet worth it */}
      {gift?.item && !gift.claimed && (
        <div data-game-ui="" style={{ position: 'fixed', right: 'calc(env(safe-area-inset-right, 0px) + 12px)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', zIndex: 45, maxWidth: '80vw' }}>
          <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/60 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm">
            <span>🎁</span>
            {gift.available ? (
              <>
                <span className="hidden sm:inline">Weekly gift: <b className="text-amber-300">{gift.item.title}</b></span>
                <button onClick={claimGift} disabled={giftBusy}
                  className="rounded-full bg-amber-400/90 px-3 py-1 font-semibold text-black hover:bg-amber-300 disabled:opacity-50">
                  {giftBusy ? 'Claiming…' : 'Claim free'}
                </button>
              </>
            ) : (
              <span>Connect wallet to claim this week&apos;s free <b className="text-amber-300">{gift.item.title}</b></span>
            )}
          </div>
          {giftMsg && <div className="mt-1 rounded-lg border border-emerald-500/30 bg-black/70 px-3 py-1.5 text-xs text-emerald-300">{giftMsg}</div>}
        </div>
      )}

      {/* inbox + feedback + invite buttons, bottom-left */}
      <div data-game-ui="" style={{ position: 'fixed', left: 'calc(env(safe-area-inset-left, 0px) + 12px)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', zIndex: 45, maxWidth: 'calc(100vw - 24px)' }} className="flex flex-wrap items-center gap-2">
        {inbox.length > 0 && (
          <button onClick={openInbox}
            className="relative rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm hover:border-cyan-400/40 hover:text-white">
            ✉ Inbox
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )}
        <button onClick={() => setFbOpen(true)}
          className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm hover:border-cyan-400/40 hover:text-white">
          ✎ Feedback
        </button>
        <button onClick={openInvite}
          className="rounded-full border border-amber-400/30 bg-black/50 px-3 py-1.5 text-xs text-amber-200/90 backdrop-blur-sm hover:border-amber-400/60 hover:text-amber-100">
          ✦ Invite
        </button>
        {streak && streak.days > 0 && (
          <button onClick={() => window.dispatchEvent(new CustomEvent('raidshooter:openstreak'))}
            className="relative rounded-full border border-cyan-400/30 bg-black/50 px-3 py-1.5 text-xs text-cyan-200/90 backdrop-blur-sm hover:border-cyan-400/60 hover:text-cyan-100">
            🔥 Streak {streak.days}
            {typeof streak.pilotGoal === 'number' && streak.days >= streak.pilotGoal && !streak.pilotClaimed && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(255,207,77,.8)]" />
            )}
          </button>
        )}
      </div>

      {/* inbox modal: the player's targeted messages (payouts, cup thanks) */}
      {inboxOpen && (
        <div data-game-ui="" onClick={() => setInboxOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="flex items-center justify-center bg-black/60 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0e16] p-6 text-white">
            <div className="text-base font-semibold text-cyan-200">Your inbox</div>
            <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
              {inbox.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-white/40">No messages yet.</div>
              ) : inbox.map((m) => (
                <div key={m.id} className={`rounded-lg border p-3 ${m.kind === 'payout' ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : m.kind === 'cup' ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{m.kind === 'payout' ? '💸 ' : m.kind === 'cup' ? '🏁 ' : ''}{m.title}</span>
                    <span className="shrink-0 text-[10px] text-white/30">{new Date(m.at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">{m.body}</p>
                  {m.meta?.txHash && (
                    <a href={`https://basescan.org/tx/${m.meta.txHash}`} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[11px] text-cyan-300 underline">View transaction ↗</a>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 text-right">
              <button onClick={() => setInboxOpen(false)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* invite modal: personal link, invite count, top recruiters */}
      {invOpen && (
        <div data-game-ui="" onClick={() => setInvOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="flex items-center justify-center bg-black/60 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0e16] p-6 text-white">
            <div className="text-base font-semibold text-amber-200">Invite a wingman</div>
            <p className="mt-1 text-xs text-white/40">Share your link. When they play and clear 5,000, you both earn a boost — and you climb the recruiters board.</p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">{inviteLink || 'Loading your link…'}</span>
              <button onClick={copyInvite} disabled={!inviteLink}
                className="shrink-0 rounded-md bg-amber-400/90 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-40">
                {invCopied ? 'Copied!' : 'Copy / Share'}
              </button>
            </div>

            <div className="mt-3 text-xs text-white/50">Confirmed invites: <b className="text-white/80">{inv?.invites ?? 0}</b></div>

            {inv?.top && inv.top.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">Top recruiters</div>
                <div className="mt-2 divide-y divide-white/5">
                  {inv.top.slice(0, 5).map((r, i) => (
                    <div key={r.code} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-white/70"><span className="text-white/40">{i + 1}.</span> {r.code}</span>
                      <span className="tabular-nums text-amber-200/90">{r.invites}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button onClick={() => setInvOpen(false)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* feedback modal */}
      {fbOpen && (
        <div data-game-ui="" onClick={() => !fbBusy && setFbOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="flex items-center justify-center bg-black/60 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0e16] p-6 text-white">
            <div className="text-base font-semibold">Send feedback to the team</div>
            <p className="mt-1 text-xs text-white/40">Bugs, ideas, anything. We read every message.</p>
            {fbSent ? (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">Thanks — got it! 🙌</div>
            ) : (
              <>
                <textarea value={fbText} onChange={(e) => setFbText(e.target.value)} rows={4} maxLength={500} placeholder="Type your message…"
                  className="mt-3 w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60" />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setFbOpen(false)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Cancel</button>
                  <button onClick={sendFeedback} disabled={fbBusy || fbText.trim().length < 2} className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-40">{fbBusy ? 'Sending…' : 'Send'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
