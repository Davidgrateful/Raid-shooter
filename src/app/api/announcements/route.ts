import { NextResponse } from 'next/server';
import { getActiveAnnouncements } from '@/lib/announcements';

// Public: active announcements shown in-game.
export async function GET() {
  const announcements = await getActiveAnnouncements();
  return NextResponse.json({
    announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt })),
  });
}
