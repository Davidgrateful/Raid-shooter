import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { listAnnouncements, upsertAnnouncement, deleteAnnouncement, type Announcement } from '@/lib/announcements';

export async function GET(req: NextRequest) {
  const denied = await adminGate(req, 'content.manage');
  if (denied) return denied;
  return NextResponse.json({ announcements: await listAnnouncements() });
}

export async function POST(req: NextRequest) {
  const denied = await adminGate(req, 'content.manage');
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Partial<Announcement> | null;
  if (!body || !body.title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  return NextResponse.json({ ok: true, announcement: await upsertAnnouncement(body) });
}

export async function DELETE(req: NextRequest) {
  const denied = await adminGate(req, 'content.manage');
  if (denied) return denied;
  const removed = await deleteAnnouncement(req.nextUrl.searchParams.get('id') || '');
  return NextResponse.json({ ok: removed });
}
