// Operator-published announcements ("make content"): news/updates shown to
// players in-game. Managed from the admin console, no code changes needed.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const KEY = 'shooterboard:announcements';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: number;
}

const mem = new Map<string, Announcement>();

function clean(input: Partial<Announcement>): Announcement {
  return {
    id: (input.id || `a_${Date.now().toString(36)}`).toString(),
    title: (input.title || '').toString().trim().slice(0, 80),
    body: (input.body || '').toString().trim().slice(0, 600),
    active: input.active !== false,
    createdAt: input.createdAt || Date.now(),
  };
}

function parseHash(raw: unknown): Announcement[] {
  const vals: string[] = [];
  if (Array.isArray(raw)) {
    for (let i = 1; i < raw.length; i += 2) vals.push(String(raw[i]));
  } else if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw as Record<string, unknown>)) vals.push(String(v));
  }
  return vals
    .map((v) => {
      try {
        return JSON.parse(v) as Announcement;
      } catch {
        return null;
      }
    })
    .filter((a): a is Announcement => !!a);
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const rows = isKvConfigured() ? parseHash(await redisCommand(['HGETALL', KEY])) : [...mem.values()];
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  return (await listAnnouncements()).filter((a) => a.active);
}

export async function upsertAnnouncement(input: Partial<Announcement>): Promise<Announcement> {
  const a = clean(input);
  if (isKvConfigured()) await redisCommand(['HSET', KEY, a.id, JSON.stringify(a)]);
  else mem.set(a.id, a);
  return a;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!id) return false;
  if (isKvConfigured()) return ((await redisCommand(['HDEL', KEY, id])) as number) > 0;
  return mem.delete(id);
}
