import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { DUEL_ACCESS, duelCount, getDuelConfig, saveDuelConfig, type DuelAccess } from '@/lib/duels';

export const dynamic = 'force-dynamic';

// Who may create DUELS (holders only / everyone / off), and how many exist.
export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'market.manage');
  if (!auth.ok) return auth.res;
  const [config, count] = await Promise.all([getDuelConfig(), duelCount()]);
  return NextResponse.json({ config, count });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'market.manage');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => null)) as { access?: unknown } | null;
  const access = body?.access;
  if (typeof access !== 'string' || !(DUEL_ACCESS as string[]).includes(access)) {
    return NextResponse.json({ error: 'access must be off, holders or all' }, { status: 400 });
  }
  const before = await getDuelConfig();
  const config = await saveDuelConfig(access as DuelAccess, auth.identity.actor);
  await audit({ actor: auth.identity.actor, action: 'duels.access', target: 'duels', detail: `${before.access} -> ${access}` });
  return NextResponse.json({ ok: true, config, count: await duelCount() });
}
