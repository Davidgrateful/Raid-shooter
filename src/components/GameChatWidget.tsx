'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessageLine, type ChatMessageData } from '@/components/ChatMessageLine';

// A persistent in-game chat icon, docked to the right edge, menu-screen only
// (same visibility rule as GameOverlays' feedback/invite buttons - it never
// sits on top of gameplay). Clicking it slides out the top-20 chat panel
// without leaving the menu or navigating to the web leaderboard.

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
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => window.removeEventListener('raidshooter:state', onState as EventListener);
  }, []);

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

  return (
    <>
      {/* docked chat icon, right edge, mid-height */}
      <div data-game-ui="" style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 45 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Top 20 chat"
          className="relative flex items-center gap-1.5 rounded-l-full border border-r-0 border-cyan-400/30 bg-black/60 py-2.5 pl-3 pr-2.5 text-cyan-200 backdrop-blur-sm hover:border-cyan-400/60 hover:bg-black/75"
        >
          <span className="text-base">💬</span>
          <span className="hidden text-[10px] font-black uppercase tracking-wider sm:inline">Chat</span>
          {hasUnread && !open && (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-black/40 bg-red-500" />
            </span>
          )}
        </button>
      </div>

      {/* slide-out panel */}
      {open && (
        <div
          data-game-ui=""
          style={{ position: 'fixed', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 55, width: 300, maxWidth: '88vw' }}
          className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#0b0e16]/95 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Top 20 chat</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white">✕</button>
          </div>

          <div ref={listRef} className="max-h-56 space-y-2 overflow-y-auto px-3 py-2.5">
            {messages.length === 0 ? (
              <p className="text-xs text-white/25">No messages yet — the top 20 haven&apos;t said anything.</p>
            ) : (
              messages.map((m) => (
                <ChatMessageLine
                  key={m.id}
                  message={m}
                  knownNames={knownNames}
                  iconSize={16}
                  onNameClick={eligible ? tagPlayer : undefined}
                />
              ))
            )}
          </div>

          <div className="border-t border-white/10 px-3 py-2.5">
            {eligible ? (
              <div className="flex gap-1.5">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 240))}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="Talk to the top 20..."
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white placeholder-white/25 outline-none focus:border-cyan-400/50"
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-white/30">Chat is open to the current top 20 ranked pilots. Climb the board to unlock it.</p>
            )}
            {error && <p className="mt-1.5 text-[11px] text-amber-300">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
