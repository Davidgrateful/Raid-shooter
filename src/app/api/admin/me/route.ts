import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { scopesFor, ROLES } from '@/lib/roles';

// Who am I? The admin page calls this after wallet sign-in (or with the
// break-glass token) to learn its role and which scopes to render.
export async function GET(req: NextRequest) {
  const r = await adminAuth(req);
  if (!r.ok) return r.res;
  const { actor, role } = r.identity;
  return NextResponse.json({
    actor,
    role,
    roleLabel: ROLES[role].label,
    scopes: scopesFor(role),
  });
}
