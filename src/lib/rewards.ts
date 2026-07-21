// Leaderboard tournament / reward system.
//
// A "season" is a tournament window with a prize table (rank -> cosmetic
// item and/or USD payout). The operator runs a season from the admin:
//   1. snapshot the current board into winners,
//   2. one-click GRANT the cosmetic prizes to the top wallets, and
//   3. create a USDC payout batch (exported for signing, or auto-sent if a
//      server signer is configured).
// Redis-backed when configured, in-memory fallback for dev (like every other
// store here).

import { isKvConfigured, redisCommand } from '@/lib/kv';
import { type BoardEntry } from '@/lib/leaderboard';
import { getCupTop } from '@/lib/cup';
import { getItem } from '@/lib/market';
import { grantItem } from '@/lib/profile';

const SEASONS_KEY = 'shooterboard:seasons';
const PAYOUTS_KEY = 'shooterboard:payouts';

export interface PrizeTier {
  // 1-based inclusive rank range this tier applies to. A single rank uses
  // fromRank === toRank.
  fromRank: number;
  toRank: number;
  itemId?: string; // cosmetic granted to each wallet in range
  usd?: number; // USDC paid to each wallet in range
}

export interface Season {
  id: string;
  name: string;
  sponsorId?: string; // presenting partner (board header banner)
  prizes: PrizeTier[];
  status: 'draft' | 'active' | 'ended';
  createdAt: number;
  endsAt?: number;
  // When set, a run only counts toward THIS cup if the player is flying this
  // pilot id (see characters.js unlock.purchase ids, e.g. 'pilot_solstice').
  // The run always still posts to the all-time/weekly boards regardless -
  // this only gates the cup ranking, i.e. the "entry fee" for a sponsor cup
  // tied to a specific character skin.
  requiredPilotId?: string;
  // Optional custom "thanks for participating" copy shown/broadcast when the
  // cup ends. Falls back to a default if unset.
  thanksMessage?: string;
  // Set once when the cup has been auto-settled after endsAt passed (status
  // flipped to 'ended' + thanks broadcast + participants notified). Guards
  // the settlement from firing more than once.
  endedNotified?: boolean;
}

export interface WinnerRow {
  rank: number;
  address: string;
  name?: string;
  score: number;
  verified: boolean;
  itemId?: string;
  usd?: number;
  // populated after a grant/payout pass
  granted?: boolean;
  paid?: boolean;
  txHash?: string;
  // why a payout/grant was skipped (e.g. guest with no wallet)
  note?: string;
}

export interface PayoutBatch {
  id: string;
  seasonId: string;
  createdAt: number;
  status: 'pending' | 'exported' | 'sent';
  tokenSymbol: string;
  network: string;
  rows: WinnerRow[];
  totalUsd: number;
}

const memSeasons = new Map<string, Season>();
const memPayouts = new Map<string, PayoutBatch>();

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'season';
}

// ------- seasons -------

export function cleanSeason(input: Partial<Season>): Season {
  const name = (input.name || '').toString().trim().slice(0, 50) || 'Season';
  const id = (input.id || `${slug(name)}-${Date.now().toString(36)}`).toString();
  const prizes: PrizeTier[] = Array.isArray(input.prizes)
    ? input.prizes
        .map((p) => ({
          fromRank: Math.max(1, Math.floor(Number(p.fromRank) || 1)),
          toRank: Math.max(1, Math.floor(Number(p.toRank) || Number(p.fromRank) || 1)),
          itemId: p.itemId && getItem(p.itemId) ? p.itemId : undefined,
          usd: Number.isFinite(Number(p.usd)) && Number(p.usd) > 0 ? Number(p.usd) : undefined,
        }))
        .filter((p) => p.itemId || p.usd)
        .sort((a, b) => a.fromRank - b.fromRank)
    : [];
  const status: Season['status'] = ['draft', 'active', 'ended'].includes(input.status as string)
    ? (input.status as Season['status'])
    : 'draft';
  return {
    id,
    name,
    sponsorId: (input.sponsorId || '').toString().trim() || undefined,
    prizes,
    status,
    createdAt: input.createdAt || Date.now(),
    endsAt: Number.isFinite(input.endsAt) ? Number(input.endsAt) : undefined,
    requiredPilotId: (input.requiredPilotId || '').toString().trim().toLowerCase() || undefined,
    thanksMessage: (input.thanksMessage || '').toString().trim().slice(0, 200) || undefined,
    endedNotified: input.endedNotified === true ? true : undefined,
  };
}

export async function listSeasons(): Promise<Season[]> {
  let rows: Season[];
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGETALL', SEASONS_KEY])) as unknown;
    const vals: string[] = [];
    if (Array.isArray(raw)) {
      for (let i = 1; i < raw.length; i += 2) vals.push(String(raw[i]));
    } else if (raw && typeof raw === 'object') {
      for (const v of Object.values(raw as Record<string, unknown>)) vals.push(String(v));
    }
    rows = vals.map((v) => { try { return JSON.parse(v) as Season; } catch { return null; } }).filter((s): s is Season => !!s);
  } else {
    rows = [...memSeasons.values()];
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function upsertSeason(input: Partial<Season>): Promise<Season> {
  const season = cleanSeason(input);
  if (isKvConfigured()) {
    await redisCommand(['HSET', SEASONS_KEY, season.id, JSON.stringify(season)]);
  } else {
    memSeasons.set(season.id, season);
  }
  return season;
}

export async function getSeason(id: string): Promise<Season | null> {
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGET', SEASONS_KEY, id])) as string | null;
    if (!raw) return null;
    try { return JSON.parse(raw) as Season; } catch { return null; }
  }
  return memSeasons.get(id) || null;
}

export async function deleteSeason(id: string): Promise<boolean> {
  if (!id) return false;
  if (isKvConfigured()) {
    const removed = (await redisCommand(['HDEL', SEASONS_KEY, id])) as number;
    return removed > 0;
  }
  return memSeasons.delete(id);
}

// The single active season (for the public board header banner). If several
// are marked active, the most recent wins.
export async function getActiveSeason(): Promise<Season | null> {
  const all = await listSeasons();
  return all.find((s) => s.status === 'active') || null;
}

// ------- winners -------

// A board key is payable only if it's a real wallet address (guests use a
// "guest:<id>" key and have no wallet to receive funds/grants).
function isWallet(address: string): boolean {
  return /^0x[0-9a-f]{40}$/i.test(address);
}

// Snapshot the cup board against a season's prize table. Returns one row per
// ranked player that a prize tier covers. Winners are judged on the
// CUP-SCOPED board (runs played while this cup was live), not the all-time
// global board — so a monster score set outside the cup window can't win it.
export async function computeWinners(season: Season): Promise<WinnerRow[]> {
  const maxRank = season.prizes.reduce((m, p) => Math.max(m, p.toRank), 0);
  if (maxRank <= 0) return [];
  const top: BoardEntry[] = await getCupTop(season.id, maxRank);
  const rows: WinnerRow[] = [];
  top.forEach((entry, i) => {
    const rank = i + 1;
    const tier = season.prizes.find((p) => rank >= p.fromRank && rank <= p.toRank);
    if (!tier) return;
    const wallet = isWallet(entry.address);
    rows.push({
      rank,
      address: entry.address,
      name: entry.name,
      score: entry.score,
      verified: !!entry.verified && wallet,
      itemId: tier.itemId,
      usd: tier.usd,
      note: wallet ? undefined : 'GUEST - must connect a wallet to claim',
    });
  });
  return rows;
}

// One-click grant of cosmetic prizes to the winning wallets. Skips guests and
// rows without a cosmetic tier. Idempotent at the profile level (grantItem
// dedupes one-time items).
export async function grantCosmeticPrizes(rows: WinnerRow[]): Promise<WinnerRow[]> {
  for (const row of rows) {
    if (!row.itemId || !isWallet(row.address)) continue;
    const item = getItem(row.itemId);
    if (!item) continue;
    await grantItem(row.address, item);
    row.granted = true;
  }
  return rows;
}

// ------- payouts -------

export async function listPayouts(): Promise<PayoutBatch[]> {
  let rows: PayoutBatch[];
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGETALL', PAYOUTS_KEY])) as unknown;
    const vals: string[] = [];
    if (Array.isArray(raw)) {
      for (let i = 1; i < raw.length; i += 2) vals.push(String(raw[i]));
    } else if (raw && typeof raw === 'object') {
      for (const v of Object.values(raw as Record<string, unknown>)) vals.push(String(v));
    }
    rows = vals.map((v) => { try { return JSON.parse(v) as PayoutBatch; } catch { return null; } }).filter((s): s is PayoutBatch => !!s);
  } else {
    rows = [...memPayouts.values()];
  }
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePayout(batch: PayoutBatch): Promise<void> {
  if (isKvConfigured()) {
    await redisCommand(['HSET', PAYOUTS_KEY, batch.id, JSON.stringify(batch)]);
  } else {
    memPayouts.set(batch.id, batch);
  }
}

export async function getPayout(id: string): Promise<PayoutBatch | null> {
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGET', PAYOUTS_KEY, id])) as string | null;
    if (!raw) return null;
    try { return JSON.parse(raw) as PayoutBatch; } catch { return null; }
  }
  return memPayouts.get(id) || null;
}

// Build a pending payout batch from winners that have a USD prize and a real
// wallet. Persisted so the operator can export it, then mark it sent.
export async function createPayoutBatch(
  season: Season,
  rows: WinnerRow[],
  tokenSymbol: string,
  network: string
): Promise<PayoutBatch> {
  const payable = rows.filter((r) => r.usd && r.usd > 0 && isWallet(r.address));
  const batch: PayoutBatch = {
    id: `payout-${Date.now().toString(36)}`,
    seasonId: season.id,
    createdAt: Date.now(),
    status: 'pending',
    tokenSymbol,
    network,
    rows: payable,
    totalUsd: payable.reduce((sum, r) => sum + (r.usd || 0), 0),
  };
  await savePayout(batch);
  return batch;
}
