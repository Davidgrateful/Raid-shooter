import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { listSponsors, upsertSponsor, deleteSponsor, type Sponsor } from '@/lib/sponsors';

// Admin CRUD for sponsors/partners. The operator drives this entirely from
// the dashboard - no code changes needed to add or remove a partner.
export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const sponsors = await listSponsors();
  return NextResponse.json({ sponsors });
}

export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Partial<Sponsor> | null;
  if (!body || !body.name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const sponsor = await upsertSponsor(body);
  return NextResponse.json({ ok: true, sponsor });
}

export async function DELETE(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get('id') || '';
  const removed = await deleteSponsor(id);
  return NextResponse.json({ ok: removed });
}
