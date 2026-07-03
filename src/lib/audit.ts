// Audit log: an append-only record of who did what in the team console.
// Non-negotiable once multiple admins can move money or moderate players.
// KV list (capped) with an in-memory fallback for dev.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const AUDIT_KEY = 'shooterboard:audit';
const MAX = 500; // keep the most recent N entries

export interface AuditEntry {
  at: number;
  actor: string;   // admin address or 'token' (break-glass) or 'env-owner'
  action: string;  // e.g. 'payout.send', 'player.ban', 'season.create'
  target?: string; // affected id/address
  detail?: string; // short human summary
}

const mem: AuditEntry[] = [];

// Fire-and-forget: logging must never break the action it records.
export async function audit(entry: Omit<AuditEntry, 'at'>): Promise<void> {
  const row: AuditEntry = { at: Date.now(), ...entry };
  try {
    if (isKvConfigured()) {
      await redisCommand(['LPUSH', AUDIT_KEY, JSON.stringify(row)]);
      await redisCommand(['LTRIM', AUDIT_KEY, 0, MAX - 1]);
    } else {
      mem.unshift(row);
      if (mem.length > MAX) mem.length = MAX;
    }
  } catch {
    // never throw from the audit path
  }
}

export async function getAudit(limit = 100): Promise<AuditEntry[]> {
  if (isKvConfigured()) {
    const raw = (await redisCommand(['LRANGE', AUDIT_KEY, 0, limit - 1])) as string[];
    if (!raw) return [];
    return raw.map((v) => { try { return JSON.parse(v) as AuditEntry; } catch { return null; } }).filter((e): e is AuditEntry => !!e);
  }
  return mem.slice(0, limit);
}
