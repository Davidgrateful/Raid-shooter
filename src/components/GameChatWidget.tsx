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
  // The channel has its own health, separate from a failed SEND. Without these
  // an unreachable channel rendered as "no transmissions yet" - an empty room
  // rather than a broken radio.
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
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
      .then((r) => {
        if (!r.ok) throw new Error('channel_unreachable');
        return r.json();
      })
      .then((d) => {
        if (!Array.isArray(d.messages)) throw new Error('bad_payload');
        setFailed(false);
        setLoading(false);
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
      .catch(() => { setFailed(true); setLoading(false); });
  }, []);

  /** Explicit retry for the channel itself, offered in place on failure. */
  const loadMessages = useCallback(() => {
    setFailed(false);
    setLoading(true);
    refresh();
  }, [refresh]);

  /** Jump to the newest traffic and clear the unread marker. */
  const scrollToLatest = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setHasUnread(false);
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
  /* The panel is deliberately capped and anchored to the right rail rather than
     filling the screen: comms is secondary to the raid happening behind it, and
     on a landscape phone a full-height panel would be an opaque wall over the
     game. `--rs-safe-*` keeps it clear of notches and home indicators. */
  return (
    <>
      {open && (
        <div
          data-game-ui=""
          role="region"
          aria-label="Squad comms"
          style={{
            position: 'fixed',
            right: 'max(12px, env(safe-area-inset-right))',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 55,
            width: 330,
            maxWidth: 'min(92vw, 330px)',
            maxHeight: 'min(72vh, 520px)',
          }}
          className="rs-cm"
        >
          <span className="rs-cm-edge" aria-hidden />

          {/*--- header: who is here, and the way out ---------------------*/}
          <header className="rs-cm-head">
            <span className="rs-cm-live" aria-hidden />
            <span className="rs-cm-title">Comms</span>
            {/* a real number: the current top 20 is exactly who may transmit */}
            <span className="rs-cm-count">{topEntries.length} ON CHANNEL</span>
            <button className="rs-cm-x" onClick={() => setOpen(false)} aria-label="Close comms">✕</button>
          </header>

          {/*--- the log ---------------------------------------------------*/}
          <div ref={listRef} className="rs-cm-log">
            {loading && messages.length === 0 ? (
              <p className="rs-cm-quiet"><span className="rs-am-wait-bar" aria-hidden />Opening channel</p>
            ) : failed && messages.length === 0 ? (
              <div className="rs-cm-quiet" style={{ flexDirection: 'column', gap: 10 }}>
                <span>Channel unreachable</span>
                <button className="rs-cm-retry" style={{ margin: 0 }} onClick={loadMessages}>Retry</button>
              </div>
            ) : messages.length === 0 ? (
              <p className="rs-cm-quiet">No transmissions yet</p>
            ) : (
              messages.map((m) => (
                <ChatMessageLine
                  key={m.id}
                  message={m}
                  knownNames={knownNames}
                  iconSize={16}
                  self={!!me && m.key === me}
                  onNameClick={eligible ? tagPlayer : undefined}
                />
              ))
            )}
          </div>

          {/* Pulses once on arrival, then holds. A badge that animates forever
              is the kind of noise this redesign is removing. */}
          {hasUnread && (
            <button className="rs-cm-jump" onClick={scrollToLatest}>▼ New transmissions</button>
          )}

          {/*--- composer --------------------------------------------------*/}
          <div className="rs-cm-foot">
            {eligible ? (
              <div className="rs-cm-compose">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 240))}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="Transmit message…"
                  aria-label="Transmit message"
                  maxLength={240}
                  className="rs-cm-input"
                />
                <button
                  className="rs-cm-send"
                  onClick={send}
                  disabled={sending || !text.trim()}
                >
                  {sending ? 'Sending' : 'Send'}
                </button>
              </div>
            ) : (
              /* Not a dead end: it names the rule and the way in. Posting is
                 gated on holding a live top-20 place, so this is the honest
                 state for most players rather than an error. */
              <p className="rs-cm-locked">
                <span className="rs-cm-locked-mark" aria-hidden>//</span>
                Reach the top 20 to transmit. Anyone can read the channel.
              </p>
            )}

            {error && (
              <p className="rs-cm-err" role="status">
                <span aria-hidden>!</span>
                {error}
                <button className="rs-cm-retry" onClick={send} disabled={sending || !text.trim()}>Retry</button>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
