import { NextRequest, NextResponse } from 'next/server';
import { adminGate } from '@/lib/admin-auth';
import { aiEnabled, draftAnnouncement, draftReply, summarizeFeedback } from '@/lib/ai-admin';
import { listFeedback } from '@/lib/feedback';

// AI admin assistant. The operator drives it from the dashboard; it drafts
// text (announcements, replies, feedback digests) which the operator then
// publishes through the existing (deterministic) endpoints. The assistant
// itself never posts, pays, or mutates anything - it only returns strings.
//
// GET  -> { enabled } so the UI can show/hide the panel.
// POST { action, ... } -> the requested draft.
export async function GET(req: NextRequest) {
  const denied = await adminGate(req, 'content.manage');
  if (denied) return denied;
  return NextResponse.json({ enabled: aiEnabled() });
}

export async function POST(req: NextRequest) {
  const denied = await adminGate(req, 'content.manage');
  if (denied) return denied;

  if (!aiEnabled()) {
    return NextResponse.json(
      { error: 'AI assistant is off. Set ANTHROPIC_API_KEY to enable it.' },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: string; brief?: string; message?: string; context?: string }
    | null;
  const action = body?.action;

  try {
    if (action === 'draft-announcement') {
      if (!body?.brief) return NextResponse.json({ error: 'brief required' }, { status: 400 });
      const draft = await draftAnnouncement(body.brief);
      if (!draft) return NextResponse.json({ error: 'draft_failed' }, { status: 502 });
      return NextResponse.json({ ok: true, draft });
    }

    if (action === 'draft-reply') {
      if (!body?.message) return NextResponse.json({ error: 'message required' }, { status: 400 });
      const reply = await draftReply(body.message, body.context);
      if (!reply) return NextResponse.json({ error: 'draft_failed' }, { status: 502 });
      return NextResponse.json({ ok: true, reply });
    }

    if (action === 'summarize-feedback') {
      const items = (await listFeedback(60)).map((f) => f.text).filter(Boolean);
      const summary = await summarizeFeedback(items);
      if (!summary) return NextResponse.json({ error: 'draft_failed' }, { status: 502 });
      return NextResponse.json({ ok: true, summary, count: items.length });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 });
  }
}
