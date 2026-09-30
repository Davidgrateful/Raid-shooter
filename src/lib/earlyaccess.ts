/*==============================================================================
DUELS early access for $RAIDSHOOTER holders

DUELS is not built yet. What holders get now is a place on the early-access
list, so the operator knows exactly which wallets to let in first when it
opens. Joining is an explicit tap (the list stores a wallet address), and only
a wallet whose on-chain holder tier the server has just confirmed can join -
the list never trusts the client's word for it.
==============================================================================*/

import { isKvConfigured, redisCommand } from '@/lib/kv';
import type { HolderTierId } from '@/lib/holder';

const KEY = 'duels:early';

export interface EarlyAccessRow {
  address: string;
  tier: HolderTierId;
  at: number;
}

const mem = new Map<string, EarlyAccessRow>();

export async function isOnEarlyAccess(address: string): Promise<boolean> {
  const a = address.toLowerCase();
  if (!isKvConfigured()) return mem.has(a);
  return Number(await redisCommand(['HEXISTS', KEY, a])) === 1;
}

/** Adds (or refreshes the tier of) a confirmed holder. */
export async function joinEarlyAccess(address: string, tier: HolderTierId): Promise<void> {
  const a = address.toLowerCase();
  const existing = await listEarlyAccess().then((rows) => rows.find((r) => r.address === a));
  const row: EarlyAccessRow = { address: a, tier, at: existing?.at ?? Date.now() };
  if (!isKvConfigured()) {
    mem.set(a, row);
    return;
  }
  await redisCommand(['HSET', KEY, a, JSON.stringify(row)]);
}

export async function listEarlyAccess(): Promise<EarlyAccessRow[]> {
  let rows: EarlyAccessRow[];
  if (!isKvConfigured()) {
    rows = [...mem.values()];
  } else {
    const raw = (await redisCommand(['HVALS', KEY])) as string[] | null;
    rows = (raw || []).flatMap((v) => {
      try { return [JSON.parse(v) as EarlyAccessRow]; } catch { return []; }
    });
  }
  return rows.sort((x, y) => x.at - y.at);
}
