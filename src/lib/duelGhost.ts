import { isKvConfigured, redisCommand } from '@/lib/kv';
import { DUEL_TTL_MS, type Duel } from '@/lib/duels';

/*==============================================================================
DUEL GHOSTS - the first pilot's path, for the second to race

A duel is one seed flown twice, so the second pilot meets the same waves the
first one did. With each duel run the client sends the run's path (where the
plane was, six times a second - public/game/ghost.js); the challenger is
handed the other pilot's path when they launch and races it as a translucent
RIVAL plane.

A ghost is drawing only. It cannot be hit, block anything or touch a dice
roll, and it plays no part in scoring: a bad or missing ghost is dropped, and
the run counts exactly as it would without one.

  storage  `duel:ghost:<id>:<n>`, n = the entry's place in the duel (0 = flown
           first), kept as long as the duel itself
==============================================================================*/

export interface DuelGhost { v: 1; every: number; pilot: string; color: string; s: number[] }

const KEEP_AFTER_MS = 7 * 86400_000;
/** ten minutes of flight at six samples a second, three numbers each */
const MAX_NUMBERS = 3 * 6 * 60 * 10;
const COLOR = /^(#[0-9a-f]{3,8}|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\))$/i;

// The one in-process fallback for a server with no KV (tests, dev), on
// globalThis like the duels themselves, so every route bundle shares it.
const g = globalThis as unknown as { __rsDuelGhosts?: Map<string, string> };
const mem: Map<string, string> = g.__rsDuelGhosts ?? (g.__rsDuelGhosts = new Map());
const ghostKey = (id: string, n: number) => `duel:ghost:${id}:${n}`;

/** A ghost as the client sent it, or null if it is not one. */
export function cleanGhost(v: unknown): DuelGhost | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.every !== 'number' || !Number.isInteger(o.every) || o.every < 1 || o.every > 60) return null;
  if (typeof o.pilot !== 'string' || !/^[a-z0-9_-]{1,24}$/.test(o.pilot)) return null;
  const s = o.s;
  if (!Array.isArray(s) || s.length < 6 || s.length > MAX_NUMBERS || s.length % 3 !== 0) return null;
  for (const n of s) if (typeof n !== 'number' || !Number.isInteger(n) || Math.abs(n) > 1_000_000) return null;
  const color = typeof o.color === 'string' && o.color.length <= 40 && COLOR.test(o.color) ? o.color : '';
  return { v: 1, every: o.every, pilot: o.pilot, color, s: s as number[] };
}

/** Keep the ghost of the duel's entry number `n` (best-effort). */
export async function saveGhost(d: Duel, n: number, ghost: DuelGhost): Promise<void> {
  const raw = JSON.stringify(ghost);
  if (isKvConfigured()) {
    const ttl = Math.max(60, Math.ceil(((d.expiresAt || d.createdAt + DUEL_TTL_MS) + KEEP_AFTER_MS - Date.now()) / 1000));
    await redisCommand(['SET', ghostKey(d.id, n), raw, 'EX', ttl]);
  } else {
    mem.set(ghostKey(d.id, n), raw);
  }
}

/** The other pilot's ghost for this caller, if they flew first and sent one. */
export async function rivalGhost(d: Duel, callerKey: string): Promise<DuelGhost | null> {
  const n = d.entries.findIndex((e) => e.key !== callerKey);
  if (n < 0) return null;
  const raw = isKvConfigured()
    ? ((await redisCommand(['GET', ghostKey(d.id, n)])) as string | null)
    : mem.get(ghostKey(d.id, n)) ?? null;
  if (!raw) return null;
  try { return cleanGhost(JSON.parse(raw)); } catch { return null; }
}
