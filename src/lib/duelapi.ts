import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { displayName } from '@/lib/tiers';

/*
 * Who is asking, for DUELS. A signed-in wallet is its address. A guest is the
 * durable device token the client already sends with run tickets
 * (`guest:<token>`), so a guest's duel, its run ticket and its inbox all key
 * the same way.
 */
export interface DuelCaller { key: string | null; verified: boolean; address?: string }

const GUEST = /^[a-z0-9-]{8,40}$/i;

export async function duelCaller(guestToken: unknown): Promise<DuelCaller> {
  const session = await getSession();
  if (session.siwe) {
    const a = session.siwe.address.toLowerCase();
    return { key: a, verified: true, address: a };
  }
  if (typeof guestToken === 'string' && GUEST.test(guestToken)) {
    return { key: `guest:${guestToken.toLowerCase()}`, verified: false };
  }
  return { key: null, verified: false };
}

export function guestFromQuery(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('g');
}

/** a call sign as the boards clean them: A-Z, 0-9 and spaces, 3-12 long */
export function cleanName(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const c = v.toUpperCase().replace(/\s+/g, ' ').trim();
  return /^[A-Z0-9 ]{3,12}$/.test(c) ? c : undefined;
}

export function nameFor(caller: DuelCaller, body: Record<string, unknown>): string | null {
  const n = cleanName(body.name);
  if (n) return n;
  if (caller.address) return displayName(undefined, caller.address);
  return null;
}
