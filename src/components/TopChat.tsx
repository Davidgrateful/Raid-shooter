'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSIWE } from '@/hooks/useSIWE';

interface ChatMessage {
  id: string;
  key: string;
  name: string;
  text: string;
  verified: boolean;
  at: number;
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

export function TopChat({ topKeys }: { topKeys: string[] }) {
  const { address, authenticated } = useSIWE();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const myKey = authenticated && address
    ? address.toLowerCase()
    : (() => {
        const t = myGuestToken();
        return t ? `guest:${t}` : null;
      })();

  const eligible = !!myKey && topKeys.includes(myKey);

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

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Top 20 chat</span>
      </div>

      <div ref={listRef} className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-xs text-white/25">No messages yet — the top 20 haven&apos;t said anything.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm leading-snug">
              <span className="font-bold text-cyan-300">{m.name}</span>
              {m.verified && <span className="ml-1 text-cyan-300">✓</span>}
              <span className="text-white/70">: {m.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        {eligible ? (
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 240))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Talk to the top 20..."
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/50"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/30">Chat is open to the current top 20 ranked pilots. Climb the board to unlock it.</p>
        )}
        {error && <p className="mt-1.5 text-xs text-amber-300">{error}</p>}
      </div>
    </div>
  );
}
