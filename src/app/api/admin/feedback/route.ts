import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { listFeedback } from '@/lib/feedback';

export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  return NextResponse.json({ feedback: await listFeedback(150) });
}
