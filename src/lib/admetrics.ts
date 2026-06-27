// Sponsor ad metrics: impressions (a sponsor placement was shown) and clicks
// (a player tapped through). Lightweight Redis counters keyed per sponsor, so
// the admin can show reach + CTR per partner and price slots on real numbers.
// In-memory fallback for dev, like the rest of the storage layer.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const IMPRESSIONS_KEY = 'shooterboard:ad:impressions';
const CLICKS_KEY = 'shooterboard:ad:clicks';

const memImpressions = new Map<string, number>();
const memClicks = new Map<string, number>();

function safeId(id: unknown): string | null {
  const v = (id || '').toString().trim().slice(0, 60);
  return /^[a-z0-9][a-z0-9-]*$/i.test(v) ? v : null;
}

export async function trackEvent(id: string, type: 'impression' | 'click'): Promise<void> {
  const sid = safeId(id);
  if (!sid) return;
  const key = type === 'click' ? CLICKS_KEY : IMPRESSIONS_KEY;
  if (isKvConfigured()) {
    await redisCommand(['HINCRBY', key, sid, 1]);
  } else {
    const mem = type === 'click' ? memClicks : memImpressions;
    mem.set(sid, (mem.get(sid) || 0) + 1);
  }
}

export interface AdMetric {
  id: string;
  impressions: number;
  clicks: number;
  ctrPct: number;
}

async function readHash(key: string, mem: Map<string, number>): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGETALL', key])) as unknown;
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i += 2) out[String(raw[i])] = Number(raw[i + 1]) || 0;
    } else if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = Number(v) || 0;
    }
  } else {
    for (const [k, v] of mem.entries()) out[k] = v;
  }
  return out;
}

// Metrics for every sponsor that has any recorded activity, keyed by id.
export async function getAdMetrics(): Promise<Record<string, AdMetric>> {
  const [impressions, clicks] = await Promise.all([
    readHash(IMPRESSIONS_KEY, memImpressions),
    readHash(CLICKS_KEY, memClicks),
  ]);
  const ids = new Set([...Object.keys(impressions), ...Object.keys(clicks)]);
  const out: Record<string, AdMetric> = {};
  for (const id of ids) {
    const imp = impressions[id] || 0;
    const clk = clicks[id] || 0;
    out[id] = { id, impressions: imp, clicks: clk, ctrPct: imp > 0 ? Math.round((clk / imp) * 1000) / 10 : 0 };
  }
  return out;
}
