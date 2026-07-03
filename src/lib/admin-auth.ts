import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSession } from '@/lib/session';
import { getAdmin } from '@/lib/admins';
import { hasScope, type Role, type Scope } from '@/lib/roles';

// Auth + RBAC gate for every /api/admin/* route.
//
// Two ways to be an admin:
//   1. Wallet session - the caller signed in with SIWE and their address is
//      in the admin roster (or ADMIN_OWNER_ADDRESSES). Role comes from there.
//   2. Break-glass token - the legacy ADMIN_STATS_TOKEN, sent as a Bearer
//      header or ?key=. Treated as Owner, so recovery/bootstrap always works.
//
// adminAuth resolves the caller and (optionally) checks a required scope,
// returning either the authorized identity or a ready-to-return error.

export interface AdminIdentity {
  actor: string; // wallet address, or 'token' for the break-glass owner
  role: Role;
}

type AuthResult = { ok: true; identity: AdminIdentity } | { ok: false; res: NextResponse };

function tokenMatches(req: NextRequest): boolean {
  const expected = process.env.ADMIN_STATS_TOKEN;
  if (!expected) return false;
  const header = req.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = bearer || req.nextUrl.searchParams.get('key') || '';
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function adminAuth(req: NextRequest, scope?: Scope): Promise<AuthResult> {
  // 1) break-glass token => Owner
  if (tokenMatches(req)) {
    return { ok: true, identity: { actor: 'token', role: 'owner' } };
  }

  // 2) wallet session => roster role
  const session = await getSession();
  const address = session.siwe?.address;
  if (address) {
    const admin = await getAdmin(address);
    if (admin) {
      if (scope && !hasScope(admin.role, scope)) {
        return {
          ok: false,
          res: NextResponse.json({ error: `Your role (${admin.role}) can't do that.` }, { status: 403 }),
        };
      }
      return { ok: true, identity: { actor: admin.address, role: admin.role } };
    }
  }

  return {
    ok: false,
    res: NextResponse.json({ error: 'Not signed in as an admin.' }, { status: 401 }),
  };
}

// Back-compat helper for routes that use the "null == allowed" shape, now
// with an optional required scope. Returns a NextResponse to return on
// denial, or null when allowed.
export async function adminGate(req: NextRequest, scope?: Scope): Promise<NextResponse | null> {
  const r = await adminAuth(req, scope);
  return r.ok ? null : r.res;
}
