import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateGuestId } from '@/lib/session';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { cachedTiers } from '@/lib/holder';
import { castVote, getPoll, myVote, results } from '@/lib/poll';

export const dynamic = 'force-dynamic';

// The voter: a signed-in wallet, else the guest's durable device token (the
// same precedence /api/streak uses), else the session's guest id.
async function voterKey(req: NextRequest, create: boolean, bodyToken?: unknown): Promise<string | null> {
  const session = await getSession();
  if (session.siwe) return session.siwe.address.toLowerCase();
  const raw = typeof bodyToken === 'string' ? bodyToken : req.nextUrl.searchParams.get('guestToken');
  if (raw && /^[a-z0-9-]{8,40}$/i.test(raw)) return `guest:${raw.toLowerCase()}`;
  if (session.guestId) return session.guestId;
  return create ? getOrCreateGuestId(session) : null;
}

export async function GET(req: NextRequest) {
  if (!(await rateLimit('poll_read', clientIp(req), 60, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const poll = await getPoll();
  if (!poll) return NextResponse.json({ poll: null });
  const voter = await voterKey(req, false);
  const mine = voter ? await myVote(poll, voter) : null;
  // results are shown once you've voted, or once the poll has closed
  const showResults = mine !== null || !poll.active;
  return NextResponse.json({
    poll: { id: poll.id, question: poll.question, options: poll.options, active: poll.active },
    myVote: mine,
    results: showResults ? await results(poll) : null,
  });
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit('poll_vote', clientIp(req), 10, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { pollId?: unknown; option?: unknown; guestToken?: unknown } | null;
  const poll = await getPoll();
  if (!poll || !poll.active || body?.pollId !== poll.id) {
    return NextResponse.json({ error: 'poll_closed' }, { status: 409 });
  }
  const option = Number(body?.option);
  if (!Number.isInteger(option) || option < 0 || option >= poll.options.length) {
    return NextResponse.json({ error: 'invalid_option' }, { status: 400 });
  }
  const voter = await voterKey(req, true, body?.guestToken);
  if (!voter) return NextResponse.json({ error: 'no_voter' }, { status: 400 });
  // a holder vote is one from a wallet with a cached on-chain tier
  const tier = voter.startsWith('0x') ? (await cachedTiers([voter])).get(voter) ?? null : null;
  const counted = await castVote(poll, voter, option, tier);
  const mine = await myVote(poll, voter);
  return NextResponse.json({ ok: true, counted, myVote: mine, results: await results(poll) });
}
