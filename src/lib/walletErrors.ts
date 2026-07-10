// Wallet connect failure log. "Some people can connect, others can't" has no
// good answer without real data - this captures what AppKit itself reports
// (CONNECT_ERROR / USER_REJECTED, which wallet was selected, the browser UA)
// so the next report can be diagnosed from /admin instead of guessed at.
// No addresses or personal data - just enough to spot a pattern (one wallet
// brand, one browser, one error message repeating).

import { isKvConfigured, redisCommand } from '@/lib/kv';

export interface WalletErrorEntry {
  id: string;
  at: number;
  kind: 'CONNECT_ERROR' | 'USER_REJECTED' | 'DISCONNECT_ERROR';
  walletName?: string;
  message?: string;
  userAgent?: string;
}

const KEY = 'wallet:errors';
const MAX_ENTRIES = 200;

const memEntries: WalletErrorEntry[] = [];

export async function logWalletError(entry: Omit<WalletErrorEntry, 'id' | 'at'>): Promise<void> {
  const full: WalletErrorEntry = { ...entry, id: crypto.randomUUID(), at: Date.now() };
  if (isKvConfigured()) {
    try {
      await redisCommand(['LPUSH', KEY, JSON.stringify(full)]);
      await redisCommand(['LTRIM', KEY, 0, MAX_ENTRIES - 1]);
      await redisCommand(['EXPIRE', KEY, 14 * 86400]);
      return;
    } catch {
      // best-effort - fall through to memory so at least this instance has it
    }
  }
  memEntries.unshift(full);
  if (memEntries.length > MAX_ENTRIES) memEntries.length = MAX_ENTRIES;
}

export async function getWalletErrors(): Promise<WalletErrorEntry[]> {
  if (isKvConfigured()) {
    try {
      const raw = (await redisCommand(['LRANGE', KEY, 0, MAX_ENTRIES - 1])) as string[];
      if (!raw) return [];
      const out: WalletErrorEntry[] = [];
      for (const item of raw) {
        try { out.push(JSON.parse(item) as WalletErrorEntry); } catch { /* skip corrupt row */ }
      }
      return out;
    } catch {
      return [];
    }
  }
  return memEntries;
}
