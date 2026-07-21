'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSIWE } from '@/hooks/useSIWE';
import { ChatMessageLine, type ChatMessageData } from '@/components/ChatMessageLine';

export interface TopChatEntry {
  address: string;
  name?: string;
}

const REFRESH_MS = 5_000;

// The game engine's own storage blob (public/game/storage.js) - a durable
// guest identity lives in here under "guesttoken", already sent with every
// score submission. Reading it directly (same origin, same localStorage key)
// lets a guest player's chat identity match their leaderboard identity
// without inventing a second token scheme.
function myGuestToken(): string | null {
  try {
    const raw = localStorage.getItem('radiusraid');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guesttoken?: string };
    return typeof parsed.guesttoken === 'string' && parsed.guesttoken.length >= 8
      ? parsed.guesttoken
      : null;
  } catch {
    return null;
  }
}

const ERROR_LABELS: Record<string, string> = {
  not_top_20: 'Chat is open to the current top 20 only.',
  muted: 'You have been muted from chat.',
  rate_limited: 'Slow down — try again in a few seconds.',
  blocked: 'That message was blocked.',
  empty: 'Message can’t be empty.',
};

export function TopChat({ topEntries }: { topEntries: TopChatEntry[] }) {
  const { address, authenticated } = useSIWE();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const myKey = authenticated && address
    ? address.toLowerCase()
    : (() => {
        const t = myGuestToken();
        return t ? `guest:${t}` : null;
      })();

  const topKeys = topEntries.map((e) => e.address);
  const knownNames = new Set(topEntries.map((e) => (e.name || '').toUpperCase()).filter(Boolean));
  const eligible = !!myKey && topKeys.includes(myKey);

  function tagPlayer(name: string) {
    setText((t) => (t ? `${t.trim()} @${name} ` : `@${name} `).slice(0, 240));
    inputRef.current?.focus();
  }

  const refresh = useCallback(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.messages)) setMessages(d.messages);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

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

  // tactical HUD corner cuts (matches the in-game comms panel)
  const panelClip = { clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' } as const;
  const btnClip = { clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' } as const;

  return (
    <div
      style={panelClip}
      className="mt-8 border border-cyan-400/25 bg-[#070b12]/90 shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_0_60px_rgba(34,211,238,0.03)] backdrop-blur-sm"
    >
      {/* top accent rail */}
      <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/80 to-cyan-400/0" />

      {/* header */}
      <div className="flex items-center gap-2 border-b border-cyan-400/15 bg-cyan-500/[0.04] px-4 py-2.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-300/90">Top-20 Comms</span>
      </div>

      {/* message feed — kill-feed rows */}
      <div ref={listRef} className="max-h-72 space-y-1 overflow-y-auto px-3 py-3" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(34,211,238,0.02) 24px, rgba(34,211,238,0.02) 25px)' }}>
        {messages.length === 0 ? (
          <p className="py-4 text-center font-mono text-xs uppercase tracking-wider text-white/25">— NO TRANSMISSIONS —</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="border-l-2 border-cyan-400/20 bg-white/[0.015] px-2.5 py-1 transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/[0.04]">
              <ChatMessageLine
                message={m}
                knownNames={knownNames}
                onNameClick={eligible ? tagPlayer : undefined}
              />
            </div>
          ))
        )}
      </div>

      {/* composer */}
      <div className="border-t border-cyan-400/15 bg-black/40 px-3 py-3">
        {eligible ? (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 240))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="> transmit to squad..."
              style={btnClip}
              className="flex-1 border border-cyan-400/20 bg-black/60 px-3 py-2 font-mono text-sm text-cyan-100 placeholder-cyan-300/25 outline-none focus:border-cyan-400/60 focus:bg-black/80"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              style={btnClip}
              className="bg-cyan-400 px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-black shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-colors hover:bg-cyan-300 disabled:opacity-40 disabled:shadow-none"
            >
              ▶ Send
            </button>
          </div>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-wide text-white/30">// Access restricted — reach the top 20 to open comms.</p>
        )}
        {error && <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-amber-400">! {error}</p>}
      </div>
    </div>
  );
}
