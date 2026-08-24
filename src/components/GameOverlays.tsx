'use client';

import { useCallback, useEffect, useState } from 'react';

/*==============================================================================
Modal host

These used to be a row of floating pills scattered around the edges of the
menu, which is a large part of what made the game read as a web dashboard. The
triggers now live inside the command centre where they belong (nav rail on
desktop, the MORE sheet on mobile); this component is purely the dialog layer
they open, listening for `raidshooter:open`.

Everything here is operator-managed content or a player message, so it keeps
the same endpoints the admin console writes to.
==============================================================================*/

type Which = 'news' | 'inbox' | 'invite' | 'feedback';

interface Announcement { id: string; title: string; body: string }
interface InboxMessage {
  id: string;
  kind: 'payout' | 'cup' | 'system';
  title: string;
  body: string;
  at: number;
  meta?: { txHash?: string; url?: string; amountUsd?: number; rank?: number };
}

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

/*------------------------------------------------------------------------------
Shared dialog chrome - same clipped panel, same energy edge, same dismissal
behaviour for every modal in the game
------------------------------------------------------------------------------*/
function Dialog({
  title,
  accent = 'var(--rs-cyan)',
  subtitle,
  onClose,
  children,
}: {
  title: string;
  accent?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      data-game-ui=""
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,4,8,0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rs-panel rs-cut rs-panel-lit rs-rise w-full max-w-md p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="rs-label" style={{ color: accent }}>{title}</div>
            {subtitle && <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-white/30 transition-colors hover:text-white">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function GameOverlays() {
  const [open, setOpen] = useState<Which | null>(null);

  const [news, setNews] = useState<Announcement | null>(null);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [inv, setInv] = useState<{ code: string; invites: number; top: { code: string; invites: number }[] } | null>(null);
  const [invCopied, setInvCopied] = useState(false);
  const [fbText, setFbText] = useState('');
  const [fbSent, setFbSent] = useState(false);
  const [fbBusy, setFbBusy] = useState(false);

  const loadInbox = useCallback(() => {
    const gt = myGuestToken();
    fetch(`/api/inbox${gt ? `?guestToken=${encodeURIComponent(gt)}` : ''}`)
      .then((r) => r.json())
      .then((d) => setInbox(d.messages || []))
      .catch(() => {});
    // opening the inbox marks it read
    fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestToken: gt || undefined }),
    }).catch(() => {});
  }, []);

  const loadInvite = useCallback(() => {
    setInvCopied(false);
    fetch('/api/referral')
      .then((r) => r.json())
      .then((d) => setInv({ code: d.code || '', invites: d.invites || 0, top: d.top || [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => { if (d.announcements?.length) setNews(d.announcements[0]); })
      .catch(() => {});

    const onOpen = (e: Event) => {
      const which = (e as CustomEvent).detail as Which;
      setOpen(which);
      if (which === 'inbox') loadInbox();
      if (which === 'invite') loadInvite();
    };
    window.addEventListener('raidshooter:open', onOpen as EventListener);

    // any state change closes whatever was open - a dialog must never survive
    // into a run
    const onState = () => setOpen(null);
    window.addEventListener('raidshooter:state', onState as EventListener);

    return () => {
      window.removeEventListener('raidshooter:open', onOpen as EventListener);
      window.removeEventListener('raidshooter:state', onState as EventListener);
    };
  }, [loadInbox, loadInvite]);

  const inviteLink = inv?.code
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://raidshooter.xyz'}/?ref=${inv.code}`
    : '';

  async function copyInvite() {
    if (!inviteLink) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Raid Shooter', text: 'Fly with me — we both earn a boost', url: inviteLink });
        return;
      }
      await navigator.clipboard.writeText(inviteLink);
      setInvCopied(true);
      setTimeout(() => setInvCopied(false), 1600);
    } catch {
      /* share/copy is best-effort */
    }
  }

  async function sendFeedback() {
    if (fbText.trim().length < 2) return;
    setFbBusy(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fbText }),
      });
      setFbSent(true);
      setFbText('');
      setTimeout(() => { setOpen(null); setFbSent(false); }, 1400);
    } finally {
      setFbBusy(false);
    }
  }

  const close = () => setOpen(null);

  if (!open) return null;

  if (open === 'news' && news) {
    return (
      <Dialog title="Fleet transmission" accent="var(--rs-purple)" onClose={close}>
        <h3 className="rs-display text-lg leading-tight text-white">{news.title}</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{news.body}</p>
        <button onClick={close} className="rs-btn mt-5 w-full">Acknowledged</button>
      </Dialog>
    );
  }

  if (open === 'inbox') {
    return (
      <Dialog title="Pilot inbox" onClose={close} subtitle="Payout confirmations and event results, addressed to you.">
        <div className="rs-scroll max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {inbox.length === 0 ? (
            <div className="rs-panel rs-cut-sm p-5 text-center text-[11px] uppercase tracking-[0.2em] text-white/25">
              No messages
            </div>
          ) : (
            inbox.map((m) => {
              const tone = m.kind === 'payout' ? 'var(--rs-green)' : m.kind === 'cup' ? 'var(--rs-gold)' : 'var(--rs-cyan)';
              return (
                <div key={m.id} className="rs-panel rs-cut-sm p-3" style={{ borderColor: `${tone}44` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rs-label" style={{ color: tone }}>{m.kind}</span>
                    <span className="rs-num text-[10px] text-white/25">{new Date(m.at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1.5 text-[13px] font-bold text-white">{m.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{m.body}</p>
                  {m.meta?.txHash && (
                    <a
                      href={`https://basescan.org/tx/${m.meta.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: tone }}
                    >
                      View settlement ↗
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Dialog>
    );
  }

  if (open === 'invite') {
    return (
      <Dialog
        title="Recruit a wingman"
        accent="var(--rs-gold)"
        onClose={close}
        subtitle="When your recruit clears 5,000, you both earn a boost — and you climb the recruiters board."
      >
        <div className="rs-panel rs-cut-sm flex items-center gap-2 p-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/70">{inviteLink || 'Generating link…'}</span>
          <button onClick={copyInvite} disabled={!inviteLink} className="rs-btn rs-btn-gold shrink-0 px-3 py-1.5 text-[11px]">
            {invCopied ? 'Copied' : 'Share'}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/35">
          <span>Confirmed recruits</span>
          <span className="rs-num text-sm text-[color:var(--rs-gold)]">{inv?.invites ?? 0}</span>
        </div>

        {inv?.top && inv.top.length > 0 && (
          <div className="mt-4">
            <div className="rs-label">Top recruiters</div>
            <div className="mt-2 divide-y divide-white/5">
              {inv.top.slice(0, 5).map((r, i) => (
                <div key={r.code} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-white/70"><span className="rs-num mr-2 text-white/30">{String(i + 1).padStart(2, '0')}</span>{r.code}</span>
                  <span className="rs-num text-[color:var(--rs-gold)]">{r.invites}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    );
  }

  if (open === 'feedback') {
    return (
      <Dialog title="Signal the team" onClose={close} subtitle="Bugs, ideas, anything. Every message is read.">
        {fbSent ? (
          <div className="rs-panel rs-cut-sm p-4 text-center text-sm font-bold text-[color:var(--rs-green)]" style={{ borderColor: 'rgba(62,233,164,0.4)' }}>
            Transmission received.
          </div>
        ) : (
          <>
            <textarea
              value={fbText}
              onChange={(e) => setFbText(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Type your message…"
              className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[color:var(--rs-cyan)]"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={close} className="rs-btn rs-btn-ghost">Cancel</button>
              <button onClick={sendFeedback} disabled={fbBusy || fbText.trim().length < 2} className="rs-btn rs-btn-solid">
                {fbBusy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </Dialog>
    );
  }

  return null;
}
