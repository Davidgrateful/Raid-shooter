'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// A persistent in-game chat icon, docked to the right edge, menu-screen only
// (same visibility rule as GameOverlays' feedback/invite buttons - it never
// sits on top of gameplay). Clicking it slides out the top-10 chat panel
// without leaving the menu or navigating to the web leaderboard.

interface ChatMessage {
  id: string;
  key: string;
  name: string;
  text: string;
  verified: boolean;
  at: number;
}

const REFRESH_MS = 5_000;

const ERROR_LABELS: Record<string, string> = {
  not_top_10: 'Chat is open to the current top 10 only.',
  muted: 'You have been muted from chat.',
  rate_limited: 'Slow down — try again in a few seconds.',
  blocked: 'That message was blocked.',
  empty: 'Message can’t be empty.',
};

export function GameChatWidget() {
  const [onMenu, setOnMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [topKeys, setTopKeys] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    fetch('/api/leaderboard?limit=10')
      .then((r) => r.json())
      .then((d) => setTopKeys((d.entries || []).map((e: { address: string }) => e.address)))
      .catch(() => {});
  }, [onMenu]);

  const refresh = useCallback(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.messages)) setMessages(d.messages); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [open, refresh]);

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

  if (!onMenu) return null;

  const eligible = !!me && topKeys.includes(me);

  return (
    <>
      {/* docked chat icon, right edge, mid-height */}
      <div data-game-ui="" style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 45 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Top 10 chat"
          className="flex items-center gap-1.5 rounded-l-full border border-r-0 border-cyan-400/30 bg-black/60 py-2.5 pl-3 pr-2.5 text-cyan-200 backdrop-blur-sm hover:border-cyan-400/60 hover:bg-black/75"
        >
          <span className="text-base">💬</span>
          <span className="hidden text-[10px] font-black uppercase tracking-wider sm:inline">Chat</span>
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
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Top 10 chat</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white">✕</button>
          </div>

          <div ref={listRef} className="max-h-56 space-y-2 overflow-y-auto px-3 py-2.5">
            {messages.length === 0 ? (
              <p className="text-xs text-white/25">No messages yet — the top 10 haven&apos;t said anything.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="text-xs leading-snug">
                  <span className="font-bold text-cyan-300">{m.name}</span>
                  {m.verified && <span className="ml-1 text-cyan-300">✓</span>}
                  <span className="text-white/70">: {m.text}</span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 px-3 py-2.5">
            {eligible ? (
              <div className="flex gap-1.5">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 240))}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="Talk to the top 10..."
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
              <p className="text-[11px] text-white/30">Chat is open to the current top 10 ranked pilots. Climb the board to unlock it.</p>
            )}
            {error && <p className="mt-1.5 text-[11px] text-amber-300">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
