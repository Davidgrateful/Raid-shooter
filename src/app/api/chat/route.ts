import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { getTop } from '@/lib/leaderboard';
import { postMessage, getRecent, isMuted, containsProfanity } from '@/lib/chat';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { isChatAutoReplyOn, replyToChat } from '@/lib/ai-admin';

// Cheap pre-filter so the LLM isn't called on every message: only messages
// that look like they want a reply (a question, or help/cup/payout talk)
// are even considered. The model still makes the final call and can decline.
function looksLikeAQuestion(text: string): boolean {
  if (text.includes('?')) return true;
  return /\b(how|why|when|what|where|help|cup|payout|prize|paid|wallet|connect|bug|lag)\b/i.test(text);
}

// Top-20 chat. Reads are public (anyone watching the board can spectate);
// posting requires the caller to currently hold a top-20 spot, checked
// fresh against the live board on every request - rank slips, chat access
// slips with it, no separate permission to revoke.

export async function GET() {
  const messages = await getRecent(50);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const verified = !!session.siwe;
  const rawGuestToken = (body as Record<string, unknown>).guestToken;
  const clientGuestToken =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  const key = verified
    ? session.siwe!.address.toLowerCase()
    : (clientGuestToken || (await getOrCreateGuestId(session)));

  const top20 = await getTop(20);
  const entry = top20.find((e) => e.address === key);
  if (!entry) {
    return NextResponse.json({ error: 'not_top_20' }, { status: 403 });
  }

  if (await isMuted(key)) {
    return NextResponse.json({ error: 'muted' }, { status: 403 });
  }

  const ip = clientIp(req);
  const allowedByKey = await rateLimit('chat_post', key, 5, 15_000);
  const allowedByIp = await rateLimit('chat_post_ip', ip, 10, 15_000);
  if (!allowedByKey || !allowedByIp) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const rawText = (body as Record<string, unknown>).text;
  if (typeof rawText !== 'string') {
    return NextResponse.json({ error: 'invalid_text' }, { status: 400 });
  }
  const text = rawText.trim().replace(/\s+/g, ' ').slice(0, 240);
  if (text.length < 1) {
    return NextResponse.json({ error: 'empty' }, { status: 400 });
  }
  if (containsProfanity(text)) {
    return NextResponse.json({ error: 'blocked' }, { status: 400 });
  }

  const message = await postMessage({
    key,
    name: entry.name || (verified ? `${key.slice(0, 6)}...${key.slice(-4)}` : 'PILOT'),
    text,
    verified,
    cosmetics: entry.cosmetics,
  });

  // Autonomous AI reply (opt-in from admin). Best-effort and heavily gated:
  // only question-like messages are considered, a global rate limit caps how
  // often the AI speaks (cost + anti-spam), and the model itself declines on
  // anything not worth a reply. Never fails or delays the player's own post
  // beyond the one awaited call, and any error is swallowed.
  try {
    if (looksLikeAQuestion(text) && (await isChatAutoReplyOn())) {
      const aiAllowed = await rateLimit('ai_chat_reply', 'global', 1, 25_000);
      if (aiAllowed) {
        const recent = (await getRecent(6)).map((m) => `${m.name}: ${m.text}`);
        const reply = await replyToChat(text, recent);
        if (reply) {
          await postMessage({ key: 'system', name: 'RAID SHOOTER', text: reply, verified: true });
        }
      }
    }
  } catch {
    // AI reply is a bonus, never a dependency - the player's message already posted
  }

  return NextResponse.json({ message });
}
