// Per-player inbox: targeted messages delivered to ONE identity (a wallet
// address or a guest token), as opposed to global chat / announcements which
// everyone sees. This is what backs "you've been paid", "thanks for playing
// the cup", and any future direct operator/AI message to a specific player.
//
// Storage: a Redis list per identity (newest first), capped so it can't grow
// unbounded, plus a per-identity "last read" timestamp for the unread count.
// In-memory fallback keeps local dev working with no KV, same as every other
// store here.

import { isKvConfigured, redisCommand } from '@/lib/kv';

export interface InboxMessage {
  id: string;
  // short machine tag so the client can style/icon by kind
  kind: 'payout' | 'cup' | 'system';
  title: string;
  body: string;
  at: number;
  // optional deep-link context (e.g. a tx hash for a payout)
  meta?: { txHash?: string; url?: string; amountUsd?: number; rank?: number };
}

const MAX_PER_INBOX = 50;
const redis = redisCommand;

function listKey(key: string): string {
  return `inbox:msgs:${key}`;
}
function seenKey(key: string): string {
  return `inbox:seen:${key}`;
}

// in-memory fallback (per instance)
const memInbox = new Map<string, InboxMessage[]>();
const memSeen = new Map<string, number>();

// Normalize an identity to a canonical inbox key. Wallets are lowercased;
// guest tokens come in as "guest:<token>" and are used verbatim. Anything
// else is rejected (returns null) so we never write to a garbage key.
export function inboxKeyFor(identity: string | null | undefined): string | null {
  if (!identity) return null;
  const id = identity.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(id)) return id.toLowerCase();
  if (/^guest:[a-z0-9-]{8,40}$/i.test(id)) return id.toLowerCase();
  return null;
}

export async function sendToInbox(
  identity: string,
  msg: Omit<InboxMessage, 'id' | 'at'>
): Promise<boolean> {
  const key = inboxKeyFor(identity);
  if (!key) return false;
  const full: InboxMessage = {
    ...msg,
    id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
  };
  if (isKvConfigured()) {
    await redis(['LPUSH', listKey(key), JSON.stringify(full)]);
    await redis(['LTRIM', listKey(key), 0, MAX_PER_INBOX - 1]);
    // inboxes self-clean 90 days after the last message
    await redis(['EXPIRE', listKey(key), 90 * 86400]);
    return true;
  }
  const arr = memInbox.get(key) || [];
  arr.unshift(full);
  memInbox.set(key, arr.slice(0, MAX_PER_INBOX));
  return true;
}

export async function getInbox(
  identity: string
): Promise<{ messages: InboxMessage[]; unread: number }> {
  const key = inboxKeyFor(identity);
  if (!key) return { messages: [], unread: 0 };
  let messages: InboxMessage[] = [];
  let seen = 0;
  if (isKvConfigured()) {
    const raw = (await redis(['LRANGE', listKey(key), 0, MAX_PER_INBOX - 1])) as string[];
    messages = (raw || [])
      .map((r) => { try { return JSON.parse(r) as InboxMessage; } catch { return null; } })
      .filter((m): m is InboxMessage => !!m);
    const seenRaw = (await redis(['GET', seenKey(key)])) as string | null;
    seen = seenRaw ? Number(seenRaw) || 0 : 0;
  } else {
    messages = memInbox.get(key) || [];
    seen = memSeen.get(key) || 0;
  }
  const unread = messages.filter((m) => m.at > seen).length;
  return { messages, unread };
}

// Mark everything up to now as read (clears the unread badge).
export async function markInboxRead(identity: string): Promise<void> {
  const key = inboxKeyFor(identity);
  if (!key) return;
  const now = Date.now();
  if (isKvConfigured()) {
    await redis(['SET', seenKey(key), String(now)]);
    await redis(['EXPIRE', seenKey(key), 90 * 86400]);
    return;
  }
  memSeen.set(key, now);
}
