// Player feedback inbox. Players submit from in-game; the team reads it in
// the admin console. Capped list so it can't grow unbounded.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const KEY = 'shooterboard:feedback';
const MAX = 300;

export interface Feedback {
  id: string;
  text: string;
  from: string; // masked wallet or "guest"
  at: number;
}

const mem: Feedback[] = [];

function mask(id: string): string {
  const addr = id.replace(/^wallet:/, '');
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return 'guest';
}

export async function addFeedback(text: string, playerId: string): Promise<Feedback | null> {
  const clean = (text || '').toString().replace(/\s+/g, ' ').trim().slice(0, 500);
  if (clean.length < 2) return null;
  const fb: Feedback = { id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, text: clean, from: mask(playerId), at: Date.now() };
  if (isKvConfigured()) {
    await redisCommand(['LPUSH', KEY, JSON.stringify(fb)]);
    await redisCommand(['LTRIM', KEY, 0, MAX - 1]);
  } else {
    mem.unshift(fb);
    if (mem.length > MAX) mem.length = MAX;
  }
  return fb;
}

export async function listFeedback(limit = 100): Promise<Feedback[]> {
  const n = Math.max(1, Math.min(MAX, limit));
  if (isKvConfigured()) {
    const raw = (await redisCommand(['LRANGE', KEY, 0, n - 1])) as string[];
    const out: Feedback[] = [];
    for (const r of raw || []) {
      try {
        out.push(JSON.parse(r) as Feedback);
      } catch {
        /* skip */
      }
    }
    return out;
  }
  return mem.slice(0, n);
}
