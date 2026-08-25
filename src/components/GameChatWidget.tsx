'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessageLine, type ChatMessageData } from '@/components/ChatMessageLine';

// Top-20 squad comms, menu-screen only - it never sits on top of gameplay.
//
// The launcher used to be a tab welded to the middle of the right edge, which
// landed straight on the command centre's ops column. It is now opened from a
// chip in the command centre's top bar (`raidshooter:opencomms`), and reports
// its unread state back out (`raidshooter:comms`) so that chip can badge it.
// One control, in the same bar as every other piece of live status.

interface TopEntry {
  address: string;
  name?: string;
}

const REFRESH_MS = 5_000;

const ERROR_LABELS: Record<string, string> = {
  not_top_20: 'Chat is open to the current top 20 only.',
  muted: 'You have been muted from chat.',
  rate_limited: 'Slow down — try again in a few seconds.',
  blocked: 'That message was blocked.',
  empty: 'Message can’t be empty.',
};

const LAST_SEEN_KEY = 'chatLastSeenId';

export function GameChatWidget() {
  const [onMenu, setOnMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [topEntries, setTopEntries] = useState<TopEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onState = (e: Event) => setOnMenu((e as CustomEvent).detail === 'menu');
    const onOpen = () => setOpen((o) => !o);
    window.addEventListener('raidshooter:state', onState as EventListener);
    window.addEventListener('raidshooter:opencomms', onOpen);
    return () => {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      window.removeEventListener('raidshooter:opencomms', onOpen);
    };
  }, []);

  // Mirror comms state up to the top HUD: whether anything is unread, and
  // whether this player can actually transmit (comms are open to the current
  // top 20). The HUD shows ONLINE vs TOP 20 from this - real state, not a
  // decorative "system online" label.
  useEffect(() => {
    const eligible = !!me && topEntries.some((e) => e.address === me);
    window.dispatchEvent(new CustomEvent('raidshooter:comms', {
      detail: { unread: hasUnread && !open, eligible },
    }));
  }, [hasUnread, open, me, topEntries]);

  useEffect(() => {
    if (!onMenu) { setOpen(false); return; }
    fetch('/api/siwe/session')
      .then((r) => r.json())
      .then((d) => setMe(d.authenticated && d.address ? d.address.toLowerCase() : d.guestId || null))
      .catch(() => {});
    fetch('/api/leaderboard?limit=20')
      .then((r) => r.json())
      .then((d) => setTopEntries((d.entries || []).map((e: { address: string; name?: string }) => ({ address: e.address, name: e.name }))))
      .catch(() => {});
  }, [onMenu]);

  // refresh() runs inside a setInterval closure, so it reads `open` via a
  // ref rather than the state directly - otherwise it would always see
  // whatever `open` was when the interval was created, not its current value.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const refresh = useCallback(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d.messages)) return;
        setMessages(d.messages);
        const latest = d.messages[d.messages.length - 1];
        if (!latest) return;
        if (openRef.current) {
          // panel is already open - this message was just seen, not unread
          try { localStorage.setItem(LAST_SEEN_KEY, latest.id); } catch { /* ignore */ }
          setHasUnread(false);
        } else {
          let lastSeen: string | null = null;
          try { lastSeen = localStorage.getItem(LAST_SEEN_KEY); } catch { /* ignore */ }
          setHasUnread(latest.id !== lastSeen);
        }
      })
      .catch(() => {});
  }, []);

  // Poll continuously while on the menu (not just while the panel is open)
  // so the unread dot can appear without the player ever opening chat.
  useEffect(() => {
    if (!onMenu) return;
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [onMenu, refresh]);

  // Opening the panel marks everything currently loaded as seen.
  useEffect(() => {
    if (!open) return;
    setHasUnread(false);
    const latest = messages[messages.length - 1];
    if (latest) {
      try { localStorage.setItem(LAST_SEEN_KEY, latest.id); } catch { /* ignore */ }
    }
  }, [open, messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

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

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, guestToken: myGuestToken() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERROR_LABELS[data.error] || 'Could not send.');
        return;
      }
      setText('');
      refresh();
    } catch {
      setError('Could not send.');
    } finally {
      setSending(false);
    }
  }

  function tagPlayer(name: string) {
    setText((t) => (t ? `${t.trim()} @${name} ` : `@${name} `).slice(0, 240));
    inputRef.current?.focus();
  }

  if (!onMenu) return null;

  const topKeys = topEntries.map((e) => e.address);
  const knownNames = new Set(topEntries.map((e) => (e.name || '').toUpperCase()).filter(Boolean));
  const eligible = !!me && topKeys.includes(me);

  // tactical HUD corner cuts (FPS-panel look)
  const panelClip = { clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' } as const;
  const btnClip = { clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' } as const;

  return (
    <>
      {/* slide-out tactical comms panel */}
      {open && (
        <div
          data-game-ui=""
          style={{ position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 55, width: 320, maxWidth: '90vw', ...panelClip }}
          className="border border-cyan-400/30 bg-[#070b12]/95 shadow-[0_0_50px_rgba(0,0,0,0.65),inset_0_0_60px_rgba(34,211,238,0.03)] backdrop-blur-md"
        >
          {/* top accent rail */}
          <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/80 to-cyan-400/0" />

          {/* header */}
          <div className="flex items-center justify-between border-b border-cyan-400/15 bg-cyan-500/[0.04] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/90">Top-20 Comms</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="font-mono text-xs text-white/40 hover:text-cyan-300">✕</button>
          </div>

          {/* message feed - kill-feed styling */}
          <div ref={listRef} className="max-h-60 space-y-1 overflow-y-auto px-2.5 py-2.5" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(34,211,238,0.02) 22px, rgba(34,211,238,0.02) 23px)' }}>
            {messages.length === 0 ? (
              <p className="py-3 text-center font-mono text-[11px] uppercase tracking-wider text-white/45">— NO TRANSMISSIONS —</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="border-l-2 border-cyan-400/20 bg-white/[0.015] px-2 py-1 transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/[0.04]">
                  <ChatMessageLine
                    message={m}
                    knownNames={knownNames}
                    iconSize={15}
                    onNameClick={eligible ? tagPlayer : undefined}
                  />
                </div>
              ))
            )}
          </div>

          {/* composer */}
          <div className="border-t border-cyan-400/15 bg-black/40 px-2.5 py-2.5">
            {eligible ? (
              <div className="flex gap-1.5">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 240))}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="> transmit to squad..."
                  style={btnClip}
                  className="flex-1 border border-cyan-400/20 bg-black/60 px-2.5 py-1.5 font-mono text-xs text-cyan-100 placeholder-cyan-300/25 outline-none focus:border-cyan-400/60 focus:bg-black/80"
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  style={btnClip}
                  className="bg-cyan-400 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-colors hover:bg-cyan-300 disabled:opacity-40 disabled:shadow-none"
                >
                  ▶ Send
                </button>
              </div>
            ) : (
              <p className="font-mono text-[10px] uppercase tracking-wide text-white/30">// Access restricted — reach the top 20 to open comms.</p>
            )}
            {error && <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-amber-400">! {error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
