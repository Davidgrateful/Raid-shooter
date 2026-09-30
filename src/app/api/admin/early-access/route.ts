import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { listEarlyAccess } from '@/lib/earlyaccess';

export const dynamic = 'force-dynamic';

// The DUELS early-access list: confirmed holders, oldest first.
export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'players.view');
  if (!auth.ok) return auth.res;
  const rows = await listEarlyAccess();
  return NextResponse.json({ total: rows.length, rows });
}
