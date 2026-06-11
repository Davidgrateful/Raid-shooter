import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTop, submitEntry } from '@/lib/leaderboard';

export async function GET() {
  try {
    const entries = await getTop(50);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.siwe) {
    return NextResponse.json({ error: 'wallet_required' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { score, level, kills, combo, pilot, time } = body as Record<string, unknown>;
  if (
    !isInt(score, 1, 5_000_000) ||
    !isInt(level, 1, 500) ||
    !isInt(kills, 0, 100_000) ||
    !isInt(combo, 0, 10_000) ||
    !isInt(time, 0, 86_400) ||
    typeof pilot !== 'string' ||
    !/^[A-Z ]{1,12}$/.test(pilot)
  ) {
    return NextResponse.json({ error: 'invalid_run' }, { status: 400 });
  }

  // loose plausibility bounds: max enemy value is 500 (boss) at a x8
  // multiplier, and kill rates far beyond human play are rejected
  if (score > kills * 4200 + 10 || kills > time * 10 + 30) {
    return NextResponse.json({ error: 'implausible_run' }, { status: 400 });
  }

  try {
    const result = await submitEntry({
      address: session.siwe.address.toLowerCase(),
      score,
      level,
      kills,
      combo,
      pilot,
      time,
      at: Date.now(),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}
