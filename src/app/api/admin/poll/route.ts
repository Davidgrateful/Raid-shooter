import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { checkPollInput, clearPoll, closePoll, getPoll, results, startPoll } from '@/lib/poll';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req, 'content.manage');
  if (!auth.ok) return auth.res;
  const poll = await getPoll();
  return NextResponse.json({ poll, results: poll ? await results(poll) : null });
}

// { action: 'start', question, options } replaces the live poll (a new id, so
// votes start from zero); { action: 'close' } stops voting and shows results;
// { action: 'clear' } takes it off the deck.
export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'content.manage');
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => null)) as { action?: string; question?: unknown; options?: unknown } | null;
  if (body?.action === 'close') {
    const poll = await closePoll();
    if (poll) await audit({ actor: auth.identity.actor, action: 'poll.close', target: poll.id, detail: poll.question });
    return NextResponse.json({ ok: true, poll, results: poll ? await results(poll) : null });
  }
  if (body?.action === 'clear') {
    const poll = await getPoll();
    await clearPoll();
    if (poll) await audit({ actor: auth.identity.actor, action: 'poll.clear', target: poll.id, detail: poll.question });
    return NextResponse.json({ ok: true, poll: null, results: null });
  }
  if (body?.action === 'start') {
    const problem = checkPollInput(body);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const poll = await startPoll(String(body.question), (body.options as string[]).map(String));
    await audit({ actor: auth.identity.actor, action: 'poll.start', target: poll.id, detail: poll.question });
    return NextResponse.json({ ok: true, poll, results: await results(poll) });
  }
  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
