// The admin roster: which wallet addresses (and optional email labels) can
// sign into the team console, and with what role. KV-backed, in-memory
// fallback for dev.
//
// Bootstrapping: addresses in ADMIN_OWNER_ADDRESSES (comma-separated) are
// always Owners even if the roster is empty - that's how the first person
// gets in and adds the rest. The legacy ADMIN_STATS_TOKEN still works as a
// break-glass Owner (see admin-auth.ts).

import { isKvConfigured, redisCommand } from '@/lib/kv';
import { isRole, type Role } from '@/lib/roles';

const ADMINS_KEY = 'shooterboard:admins';

export interface Admin {
  address: string; // lowercase wallet address - the identity
  role: Role;
  label?: string; // human name / email, for display only
  addedBy?: string;
  addedAt: number;
}

const mem = new Map<string, Admin>();

function envOwners(): string[] {
  return (process.env.ADMIN_OWNER_ADDRESSES || '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a));
}

export async function listAdmins(): Promise<Admin[]> {
  let rows: Admin[];
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGETALL', ADMINS_KEY])) as unknown;
    const vals: string[] = [];
    if (Array.isArray(raw)) {
      for (let i = 1; i < raw.length; i += 2) vals.push(String(raw[i]));
    } else if (raw && typeof raw === 'object') {
      for (const v of Object.values(raw as Record<string, unknown>)) vals.push(String(v));
    }
    rows = vals.map((v) => { try { return JSON.parse(v) as Admin; } catch { return null; } }).filter((a): a is Admin => !!a);
  } else {
    rows = [...mem.values()];
  }
  // fold in env owners that aren't explicitly stored, so they always appear
  const known = new Set(rows.map((r) => r.address));
  for (const addr of envOwners()) {
    if (!known.has(addr)) {
      rows.push({ address: addr, role: 'owner', label: 'Env owner', addedAt: 0 });
    }
  }
  return rows.sort((a, b) => a.addedAt - b.addedAt);
}

// Resolve an address to its admin record (role), or null if not an admin.
export async function getAdmin(address: string): Promise<Admin | null> {
  const addr = (address || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return null;
  if (envOwners().includes(addr)) {
    return { address: addr, role: 'owner', label: 'Env owner', addedAt: 0 };
  }
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGET', ADMINS_KEY, addr])) as string | null;
    if (!raw) return null;
    try { return JSON.parse(raw) as Admin; } catch { return null; }
  }
  return mem.get(addr) || null;
}

export async function upsertAdmin(input: { address: string; role: Role; label?: string; addedBy?: string }): Promise<Admin | { error: string }> {
  const address = (input.address || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return { error: 'Valid wallet address required.' };
  if (!isRole(input.role)) return { error: 'Unknown role.' };
  const existing = isKvConfigured()
    ? ((await redisCommand(['HGET', ADMINS_KEY, address])) as string | null)
    : (mem.has(address) ? '1' : null);
  const admin: Admin = {
    address,
    role: input.role,
    label: (input.label || '').toString().slice(0, 60) || undefined,
    addedBy: input.addedBy,
    addedAt: existing ? (JSON.parse(existing as string).addedAt || Date.now()) : Date.now(),
  };
  if (isKvConfigured()) {
    await redisCommand(['HSET', ADMINS_KEY, address, JSON.stringify(admin)]);
  } else {
    mem.set(address, admin);
  }
  return admin;
}

export async function removeAdmin(address: string): Promise<boolean> {
  const addr = (address || '').toLowerCase();
  if (envOwners().includes(addr)) return false; // env owners can't be removed via UI
  if (isKvConfigured()) {
    const n = (await redisCommand(['HDEL', ADMINS_KEY, addr])) as number;
    return n > 0;
  }
  return mem.delete(addr);
}

// Count of real, stored owners (excludes env owners) - used to prevent
// removing/demoting the last owner and locking everyone out.
export async function ownerCount(): Promise<number> {
  const all = await listAdmins();
  return all.filter((a) => a.role === 'owner').length;
}
