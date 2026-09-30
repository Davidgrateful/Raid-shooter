/*==============================================================================
Pilot vote - the operator asks, players answer (roadmap Phase 4)

One live poll at a time, set from /admin -> Content. Anyone can vote once:
signed-in wallets by address, guests by their device token. Guest votes are
cheap to fake (clear storage, vote again), so results carry a second count
that cannot be: votes from wallets the server has a cached $RAIDSHOOTER
holder tier for. That split is the signal worth steering by.
==============================================================================*/

import { isKvConfigured, redisCommand } from '@/lib/kv';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  active: boolean;
  createdAt: number;
}

export interface PollResults {
  total: number;
  counts: number[];
  holderTotal: number;
  holderCounts: number[];
}

const CURRENT = 'poll:current';
const votesKey = (id: string) => `poll:${id}:votes`;

let memPoll: Poll | null = null;
const memVotes = new Map<string, Map<string, string>>();

/** Validates operator input; returns an error message or null. */
export function checkPollInput(input: { question?: unknown; options?: unknown }): string | null {
  const q = typeof input.question === 'string' ? input.question.trim() : '';
  if (q.length < 3 || q.length > 140) return 'question must be 3-140 characters';
  if (!Array.isArray(input.options)) return 'options must be a list';
  const opts = input.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean);
  if (opts.length < 2 || opts.length > 5) return 'give 2 to 5 options';
  if (opts.some((o) => o.length > 60)) return 'each option must be 60 characters or fewer';
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return 'options must be different';
  return null;
}

export async function getPoll(): Promise<Poll | null> {
  if (!isKvConfigured()) return memPoll;
  const raw = (await redisCommand(['GET', CURRENT])) as string | null;
  try { return raw ? (JSON.parse(raw) as Poll) : null; } catch { return null; }
}

export async function startPoll(question: string, options: string[]): Promise<Poll> {
  const poll: Poll = {
    id: Date.now().toString(36),
    question: question.trim(),
    options: options.map((o) => o.trim()).filter(Boolean),
    active: true,
    createdAt: Date.now(),
  };
  if (isKvConfigured()) await redisCommand(['SET', CURRENT, JSON.stringify(poll)]);
  else memPoll = poll;
  return poll;
}

export async function closePoll(): Promise<Poll | null> {
  const poll = await getPoll();
  if (!poll) return null;
  poll.active = false;
  if (isKvConfigured()) await redisCommand(['SET', CURRENT, JSON.stringify(poll)]);
  else memPoll = poll;
  return poll;
}

/** Takes the vote off the deck entirely (its votes are kept under its id). */
export async function clearPoll(): Promise<void> {
  if (isKvConfigured()) await redisCommand(['DEL', CURRENT]);
  else memPoll = null;
}

/** A vote is stored as "<option>" or "<option>:<holderTier>". */
function parse(v: string): { option: number; holder: boolean } {
  const [o, tier] = v.split(':');
  return { option: Number(o), holder: !!tier };
}

/** First vote counts; a second vote from the same voter is refused. */
export async function castVote(poll: Poll, voter: string, option: number, holderTier: string | null): Promise<boolean> {
  const value = holderTier ? `${option}:${holderTier}` : String(option);
  if (!isKvConfigured()) {
    const m = memVotes.get(poll.id) || new Map<string, string>();
    memVotes.set(poll.id, m);
    if (m.has(voter)) return false;
    m.set(voter, value);
    return true;
  }
  return Number(await redisCommand(['HSETNX', votesKey(poll.id), voter, value])) === 1;
}

export async function myVote(poll: Poll, voter: string): Promise<number | null> {
  const v = isKvConfigured()
    ? ((await redisCommand(['HGET', votesKey(poll.id), voter])) as string | null)
    : memVotes.get(poll.id)?.get(voter) ?? null;
  return v === null || v === undefined ? null : parse(v).option;
}

export async function results(poll: Poll): Promise<PollResults> {
  const values = isKvConfigured()
    ? (((await redisCommand(['HVALS', votesKey(poll.id)])) as string[] | null) || [])
    : [...(memVotes.get(poll.id)?.values() || [])];
  const counts = poll.options.map(() => 0);
  const holderCounts = poll.options.map(() => 0);
  for (const v of values) {
    const { option, holder } = parse(v);
    if (!(option >= 0 && option < counts.length)) continue;
    counts[option]++;
    if (holder) holderCounts[option]++;
  }
  return {
    total: counts.reduce((a, b) => a + b, 0),
    counts,
    holderTotal: holderCounts.reduce((a, b) => a + b, 0),
    holderCounts,
  };
}
