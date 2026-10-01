/*==============================================================================
DUELS - challenge a pilot to the same raid

One duel is one seed. The creator and one challenger each fly that seeded raid
once, whenever they like within 48 hours, and the higher score wins. It is
asynchronous by design: the game runs on serverless functions, which cannot
hold the open connections a live head-to-head would need.

  access   the operator decides who may CREATE a duel (/admin -> Token):
             holders  signed-in wallets with a $RAIDSHOOTER holder tier
                      (the early-access promise; the default)
             all      anyone, guests included
             off      nobody (existing duels can still be finished)
           Anyone with the link can ACCEPT one, guests included, the same
           way guests play the Daily Run.
  scoring  a duel run is a real run: it carries a run ticket, and a claimed
           run time longer than the ticket's age is refused. Duel scores
           never touch the main board, the cups or any payout - a duel is
           for bragging rights, so there is nothing to farm.
  storage  `duel:<id>` (JSON, kept a week past expiry so results stay
           readable), `duels:mine:<identity>` (the last 20 duel ids a player
           created or flew), `duels:config`, `duels:count`.
==============================================================================*/

import { randomBytes, randomInt } from 'crypto';
import { isKvConfigured, redisCommand } from '@/lib/kv';
import { tryLock, unlock } from '@/lib/lock';

export type DuelAccess = 'off' | 'holders' | 'all';
export const DUEL_ACCESS: DuelAccess[] = ['off', 'holders', 'all'];

export const DUEL_TTL_MS = 48 * 3600_000;
const KEEP_AFTER_MS = 7 * 86400_000;
const MINE_MAX = 20;
// no 0/O, 1/I/L - a code people read out to each other
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface DuelPilot {
  /** wallet (lowercase) or guest:<token> - never sent to the client */
  key: string;
  name: string;
  verified: boolean;
}

export interface DuelEntry extends DuelPilot {
  score: number;
  pilot: string;
  level: number;
  kills: number;
  time: number;
  at: number;
}

export interface Duel {
  id: string;
  seed: number;
  createdAt: number;
  expiresAt: number;
  creator: DuelPilot;
  /** at most two: the creator's run and one challenger's, in the order flown */
  entries: DuelEntry[];
}

export interface DuelConfig { access: DuelAccess; updatedAt: number; updatedBy?: string }

// The no-KV fallback lives on globalThis: Next bundles the API routes and the
// /duel page separately, and module-level Maps would give each its own copy.
interface MemStore { duels: Map<string, string>; mine: Map<string, string[]>; config: DuelConfig | null; count: number }
const g = globalThis as unknown as { __rsDuels?: MemStore };
const store: MemStore = g.__rsDuels ?? (g.__rsDuels = { duels: new Map<string, string>(), mine: new Map<string, string[]>(), config: null, count: 0 });
const mem = store.duels;
const memMine = store.mine;

const duelKey = (id: string) => `duel:${id}`;
const mineKey = (k: string) => `duels:mine:${k}`;

export function isDuelId(v: unknown): v is string {
  return typeof v === 'string' && new RegExp(`^[${ALPHABET}]{6}$`).test(v);
}

function newId(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/*--- config ----------------------------------------------------------------*/
let cfgCache: { at: number; cfg: DuelConfig } | null = null;

export function envAccess(): DuelAccess {
  const v = (process.env.DUELS_ACCESS || '').trim().toLowerCase();
  return (DUEL_ACCESS as string[]).includes(v) ? (v as DuelAccess) : 'holders';
}

export async function getDuelConfig(): Promise<DuelConfig> {
  if (cfgCache && Date.now() - cfgCache.at < 30_000) return cfgCache.cfg;
  let cfg: DuelConfig | null = null;
  if (isKvConfigured()) {
    try {
      const raw = (await redisCommand(['GET', 'duels:config'])) as string | null;
      if (raw) cfg = JSON.parse(raw) as DuelConfig;
    } catch { cfg = null; }
  } else {
    cfg = store.config;
  }
  if (!cfg || !(DUEL_ACCESS as string[]).includes(cfg.access)) cfg = { access: envAccess(), updatedAt: 0 };
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}

export async function saveDuelConfig(access: DuelAccess, by?: string): Promise<DuelConfig> {
  const cfg: DuelConfig = { access, updatedAt: Date.now(), updatedBy: by };
  if (isKvConfigured()) await redisCommand(['SET', 'duels:config', JSON.stringify(cfg)]);
  else store.config = cfg;
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}

/*--- storage ---------------------------------------------------------------*/
async function writeDuel(d: Duel): Promise<void> {
  const ttl = Math.max(60, Math.ceil((d.expiresAt + KEEP_AFTER_MS - Date.now()) / 1000));
  if (isKvConfigured()) await redisCommand(['SET', duelKey(d.id), JSON.stringify(d), 'EX', ttl]);
  else mem.set(d.id, JSON.stringify(d));
}

export async function getDuel(id: string): Promise<Duel | null> {
  if (!isDuelId(id)) return null;
  const raw = isKvConfigured() ? ((await redisCommand(['GET', duelKey(id)])) as string | null) : mem.get(id) ?? null;
  if (!raw) return null;
  try { return JSON.parse(raw) as Duel; } catch { return null; }
}

async function remember(key: string, id: string): Promise<void> {
  if (isKvConfigured()) {
    await redisCommand(['LREM', mineKey(key), 0, id]);
    await redisCommand(['LPUSH', mineKey(key), id]);
    await redisCommand(['LTRIM', mineKey(key), 0, MINE_MAX - 1]);
    await redisCommand(['EXPIRE', mineKey(key), 30 * 86400]);
    return;
  }
  const list = (memMine.get(key) || []).filter((x) => x !== id);
  list.unshift(id);
  memMine.set(key, list.slice(0, MINE_MAX));
}

export async function myDuels(key: string, limit = 5): Promise<Duel[]> {
  const ids = isKvConfigured()
    ? (((await redisCommand(['LRANGE', mineKey(key), 0, limit - 1])) as string[] | null) || [])
    : (memMine.get(key) || []).slice(0, limit);
  const duels = await Promise.all(ids.map((id) => getDuel(id)));
  return duels.filter((d): d is Duel => !!d);
}

export async function duelCount(): Promise<number> {
  if (!isKvConfigured()) return store.count;
  return Number((await redisCommand(['GET', 'duels:count'])) || 0);
}

/*--- lifecycle -------------------------------------------------------------*/
export async function createDuel(creator: DuelPilot, now = Date.now()): Promise<Duel> {
  // a 6-character code from 31 symbols is ~887M combinations; retry the
  // rare collision rather than overwrite someone's duel
  for (let attempt = 0; attempt < 5; attempt++) {
    const duel: Duel = {
      id: newId(),
      seed: randomBytes(4).readUInt32BE(0),
      createdAt: now,
      expiresAt: now + DUEL_TTL_MS,
      creator,
      entries: [],
    };
    if (isKvConfigured()) {
      const ok = await redisCommand(['SET', duelKey(duel.id), JSON.stringify(duel), 'NX', 'EX', Math.ceil((DUEL_TTL_MS + KEEP_AFTER_MS) / 1000)]);
      if (ok !== 'OK') continue;
      await redisCommand(['INCR', 'duels:count']);
    } else {
      if (mem.has(duel.id)) continue;
      mem.set(duel.id, JSON.stringify(duel));
      store.count++;
    }
    await remember(creator.key, duel.id);
    return duel;
  }
  throw new Error('duel_id_exhausted');
}

export type DuelState = 'open' | 'settled' | 'expired';

export function duelState(d: Duel, now = Date.now()): DuelState {
  if (d.entries.length >= 2) return 'settled';
  if (now > d.expiresAt) return 'expired';
  return 'open';
}

/** Who this viewer is in the duel, and whether they may still fly it. */
export function roleOf(d: Duel, key: string | null): { role: 'creator' | 'challenger' | null; flown: boolean; canFly: boolean } {
  const flown = !!key && d.entries.some((e) => e.key === key);
  const role = !key ? null : d.creator.key === key ? 'creator' : flown ? 'challenger' : null;
  if (flown || duelState(d) !== 'open') return { role, flown, canFly: false };
  // the second slot belongs to the creator until they fly, and the creator's
  // slot is theirs alone - so a stranger can only take the one open seat
  const creatorFlew = d.entries.some((e) => e.key === d.creator.key);
  const strangerFlew = d.entries.some((e) => e.key !== d.creator.key);
  const canFly = role === 'creator' ? !creatorFlew : !strangerFlew;
  return { role, flown, canFly };
}

export type SubmitResult =
  | { ok: true; duel: Duel; settled: boolean }
  | { ok: false; error: 'not_found' | 'expired' | 'settled' | 'already_flown' | 'seat_taken' | 'busy' };

export async function submitDuelRun(id: string, entry: DuelEntry, now = Date.now()): Promise<SubmitResult> {
  const owner = await tryLock(`duel:${id}`, 8000);
  if (!owner) return { ok: false, error: 'busy' };
  try {
    const d = await getDuel(id);
    if (!d) return { ok: false, error: 'not_found' };
    if (d.entries.some((e) => e.key === entry.key)) return { ok: false, error: 'already_flown' };
    const st = duelState(d, now);
    if (st === 'settled') return { ok: false, error: 'settled' };
    if (st === 'expired') return { ok: false, error: 'expired' };
    if (!roleOf(d, entry.key).canFly) return { ok: false, error: 'seat_taken' };
    d.entries.push({ ...entry, at: now });
    await writeDuel(d);
    await remember(entry.key, d.id);
    return { ok: true, duel: d, settled: d.entries.length >= 2 };
  } finally {
    await unlock(`duel:${id}`, owner);
  }
}

/*--- what a client may see --------------------------------------------------*/
export interface DuelView {
  id: string;
  state: DuelState;
  expiresAt: number;
  creator: { name: string; verified: boolean };
  entries: Array<{ name: string; verified: boolean; score: number; pilot: string; level: number; kills: number; time: number; mine: boolean; creator: boolean }>;
  role: 'creator' | 'challenger' | null;
  canFly: boolean;
  /** only to a viewer who may still fly it */
  seed?: number;
  /** the viewer's result once settled */
  outcome?: 'won' | 'lost' | 'draw';
}

export function viewOf(d: Duel, key: string | null, now = Date.now()): DuelView {
  const { role, canFly } = roleOf(d, key);
  const state = duelState(d, now);
  const entries = d.entries.map((e) => ({
    name: e.name, verified: e.verified, score: e.score, pilot: e.pilot, level: e.level, kills: e.kills, time: e.time,
    mine: !!key && e.key === key, creator: e.key === d.creator.key,
  }));
  let outcome: DuelView['outcome'];
  if (state === 'settled' && key) {
    const mine = d.entries.find((e) => e.key === key);
    const theirs = d.entries.find((e) => e.key !== key);
    if (mine && theirs) outcome = mine.score > theirs.score ? 'won' : mine.score < theirs.score ? 'lost' : 'draw';
  }
  return {
    id: d.id, state, expiresAt: d.expiresAt,
    creator: { name: d.creator.name, verified: d.creator.verified },
    entries, role, canFly,
    ...(canFly ? { seed: d.seed } : {}),
    ...(outcome ? { outcome } : {}),
  };
}
