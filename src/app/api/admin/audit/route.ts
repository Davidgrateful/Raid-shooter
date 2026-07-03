import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { getAudit } from '@/lib/audit';

// The audit trail: who did what, when. Requires the audit.view scope.
export async function GET(req: NextRequest) {
  const r = await adminAuth(req, 'audit.view');
  if (!r.ok) return r.res;
  const entries = await getAudit(150);
  return NextResponse.json({ entries });
}
