import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { listAdmins, upsertAdmin, removeAdmin, ownerCount, getAdmin } from '@/lib/admins';
import { ROLES, isRole } from '@/lib/roles';
import { audit } from '@/lib/audit';

// Owner-only: manage who can sign into the team console and with what role.
export async function GET(req: NextRequest) {
  const r = await adminAuth(req, 'admins.manage');
  if (!r.ok) return r.res;
  const admins = await listAdmins();
  return NextResponse.json({
    admins,
    roles: Object.entries(ROLES).map(([id, r2]) => ({ id, label: r2.label, desc: r2.desc, scopes: r2.scopes })),
  });
}

export async function POST(req: NextRequest) {
  const r = await adminAuth(req, 'admins.manage');
  if (!r.ok) return r.res;
  const body = (await req.json().catch(() => null)) as { address?: string; role?: string; label?: string } | null;
  if (!body?.address || !isRole(body.role)) {
    return NextResponse.json({ error: 'address and a valid role are required' }, { status: 400 });
  }
  const result = await upsertAdmin({ address: body.address, role: body.role, label: body.label, addedBy: r.identity.actor });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  await audit({ actor: r.identity.actor, action: 'admin.upsert', target: result.address, detail: `role ${result.role}` });
  return NextResponse.json({ ok: true, admin: result });
}

export async function DELETE(req: NextRequest) {
  const r = await adminAuth(req, 'admins.manage');
  if (!r.ok) return r.res;
  const address = (req.nextUrl.searchParams.get('address') || '').toLowerCase();
  // never let the last owner be removed - that would lock everyone out
  const target = await getAdmin(address);
  if (target?.role === 'owner' && (await ownerCount()) <= 1) {
    return NextResponse.json({ error: "Can't remove the last owner." }, { status: 400 });
  }
  const removed = await removeAdmin(address);
  if (removed) await audit({ actor: r.identity.actor, action: 'admin.remove', target: address });
  return NextResponse.json({ ok: removed });
}
