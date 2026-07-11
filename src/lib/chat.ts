// Top-10 chat. Scoped to whoever currently holds a top-10 leaderboard spot
// (checked fresh on every post in the API route) - a live perk that comes
// and goes with rank, not a permanent channel. Redis-backed (ZSET for order
// + HASH for bodies, same pattern as the leaderboard) with an in-memory
// fallback for dev/no-KV.

import { isKvConfigured, kvUrl, kvToken, redisCommand } from '@/lib/kv';

export interface ChatMessage {
  id: string;
  key: string; // leaderboard member key (address or "guest:<id>")
  name: string;
  text: string;
  verified: boolean;
  at: number;
}

const ZKEY = 'chat:messages';
const HKEY = 'chat:entries';
const MUTED_KEY = 'chat:muted';
const MAX_MESSAGES = 200;

const redis = redisCommand;

const memMessages: ChatMessage[] = [];
const memMuted = new Set<string>();

export async function postMessage(input: {
  key: string;
  name: string;
  text: string;
  verified: boolean;
}): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    key: input.key,
    name: input.name,
    text: input.text,
    verified: input.verified,
    at: Date.now(),
  };

  if (isKvConfigured()) {
    await redis(['ZADD', ZKEY, message.at, message.id]);
    await redis(['HSET', HKEY, message.id, JSON.stringify(message)]);
    const count = (await redis(['ZCARD', ZKEY])) as number;
    if (count > MAX_MESSAGES) {
      const stale = (await redis(['ZRANGE', ZKEY, 0, count - MAX_MESSAGES - 1])) as string[];
      if (stale && stale.length > 0) {
        await redis(['ZREM', ZKEY, ...stale]);
        await redis(['HDEL', HKEY, ...stale]);
      }
    }
    return message;
  }

  memMessages.push(message);
  if (memMessages.length > MAX_MESSAGES) {
    memMessages.splice(0, memMessages.length - MAX_MESSAGES);
  }
  return message;
}

export async function getRecent(limit = 50): Promise<ChatMessage[]> {
  if (kvUrl && kvToken) {
    const ids = (await redis(['ZREVRANGE', ZKEY, 0, limit - 1])) as string[];
    if (!ids || ids.length === 0) return [];
    const raw = (await redis(['HMGET', HKEY, ...ids])) as (string | null)[];
    const messages: ChatMessage[] = [];
    for (const item of raw) {
      if (item) {
        try {
          messages.push(JSON.parse(item) as ChatMessage);
        } catch {
          // skip corrupt rows
        }
      }
    }
    return messages.reverse(); // oldest first for display
  }
  return memMessages.slice(-limit);
}

export async function deleteMessage(id: string): Promise<void> {
  if (kvUrl && kvToken) {
    await redis(['ZREM', ZKEY, id]);
    await redis(['HDEL', HKEY, id]);
    return;
  }
  const idx = memMessages.findIndex((m) => m.id === id);
  if (idx >= 0) memMessages.splice(idx, 1);
}

export async function isMuted(key: string): Promise<boolean> {
  if (kvUrl && kvToken) {
    const r = (await redis(['SISMEMBER', MUTED_KEY, key])) as number;
    return r === 1;
  }
  return memMuted.has(key);
}

export async function muteKey(key: string): Promise<void> {
  if (kvUrl && kvToken) {
    await redis(['SADD', MUTED_KEY, key]);
  } else {
    memMuted.add(key);
  }
}

export async function unmuteKey(key: string): Promise<void> {
  if (kvUrl && kvToken) {
    await redis(['SREM', MUTED_KEY, key]);
  } else {
    memMuted.delete(key);
  }
}

export async function getMuted(): Promise<string[]> {
  if (kvUrl && kvToken) {
    const r = (await redis(['SMEMBERS', MUTED_KEY])) as string[];
    return r || [];
  }
  return [...memMuted];
}

// Small blocklist filter - not exhaustive, but catches the common cases
// before a message ever reaches other players' screens. Word-boundary
// matched, case-insensitive; leetspeak/spacing evasion isn't attempted here
// since this is a first line of defense, not the only one (admins can also
// delete a message or mute a key after the fact).
const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot',
  'retard', 'whore', 'slut', 'rape', 'kys',
];
const BLOCKED_RE = new RegExp(`\\b(${BLOCKED_WORDS.join('|')})\\b`, 'i');

export function containsProfanity(text: string): boolean {
  return BLOCKED_RE.test(text);
}
