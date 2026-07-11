import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { deleteMessage, muteKey, unmuteKey, getMuted } from '@/lib/chat';

// Top-10 chat moderation - same scope as announcements/feedback, since a
// public chat channel is a content-moderation surface, not a money or
// player-standing one.

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'content.manage');
  if (!auth.ok) return auth.res;
  const muted = await getMuted();
  return NextResponse.json({ muted });
}

export async function DELETE(req: NextRequest) {
  const auth = await adminAuth(req, 'content.manage');
  if (!auth.ok) return auth.res;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }
  await deleteMessage(id);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'content.manage');
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.key !== 'string' || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (body.action === 'mute') {
    await muteKey(body.key);
  } else if (body.action === 'unmute') {
    await unmuteKey(body.key);
  } else {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
