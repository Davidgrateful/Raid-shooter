import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateGuestId, getSession } from '@/lib/session';
import { checkSubmitAllowed, getTop, getBoardCount, getEntry, isPersistent, submitEntry, suspicionReason, flagRun, type BoardEntry } from '@/lib/leaderboard';
import { getActiveSeason } from '@/lib/rewards';
import { submitCupEntry } from '@/lib/cup';
import { submitWeekly } from '@/lib/weekly';
import { verifyTurnstile } from '@/lib/turnstile';
import { clientIp } from '@/lib/ratelimit';

export async function GET(req: NextRequest) {
  try {
    // The board is no longer hard-capped at 50: it shows however many people
    // actually ranked. `limit` pages the rows for lighter clients (the canvas
    // game asks for fewer; the web page asks for all), while `total` always
    // reports the full field so "OF N" stays accurate. Hard ceiling of 1000
    // keeps a pathological payload from ever being returned.
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 1000;
    const [entries, total] = await Promise.all([getTop(limit), getBoardCount()]);
    return NextResponse.json({ entries, total, persistent: isPersistent() });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

// Known-id allowlists for the cosmetic badge rendered on every leaderboard
// row. Anything outside these lists is dropped rather than stored, so a
// forged payload can never inject an arbitrary string/color into every
// other viewer's render.
const PILOT_IDS = new Set([
  'onyix', 'nova', 'tankrex', 'astravane', 'ironhalo', 'runepilot',
  'nebulafox', 'javelin9', 'atlasbeam', 'glitchprince', 'solstice', 'crimsonwisp',
]);
const DRONE_IDS = new Set([
  'drone_aegis', 'drone_voltmite', 'drone_needlefinch', 'drone_gravbeetle', 'drone_medicwisp', 'drone_champion',
]);
// ship colors are '#fff' or 'hsl(190, 100%, 60%)' style strings (see
// $.definitions.shipColors / premiumColors) - never free text
const SHIP_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\))$/;

function sanitizeCosmetics(input: unknown): BoardEntry['cosmetics'] {
  if (!input || typeof input !== 'object') return undefined;
  const c = input as Record<string, unknown>;
  const out: NonNullable<BoardEntry['cosmetics']> = {};
  if (typeof c.pilotId === 'string' && PILOT_IDS.has(c.pilotId)) out.pilotId = c.pilotId;
  if (typeof c.shipColor === 'string' && c.shipColor.length <= 32 && SHIP_COLOR_RE.test(c.shipColor)) out.shipColor = c.shipColor;
  if (typeof c.trailHue === 'number' && Number.isInteger(c.trailHue) && c.trailHue >= 0 && c.trailHue <= 360) out.trailHue = c.trailHue;
  if (typeof c.droneId === 'string' && DRONE_IDS.has(c.droneId)) out.droneId = c.droneId;
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function POST(req: NextRequest) {
  const session = await getSession();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Guest play by default: a wallet is no longer required to post a score.
  // Wallet players are keyed by their address (verified). Guests are keyed by
  // a DURABLE token the client stores in localStorage and sends every run -
  // this survives the session cookie being dropped (iOS Safari ITP, in-app
  // browsers), the cause of "my score/name doesn't stick unless I connect a
  // wallet". Falls back to the cookie id when no token is supplied.
  const verified = !!session.siwe;
  const rawGuestToken = (body as Record<string, unknown>).guestToken;
  const clientGuestToken =
    typeof rawGuestToken === 'string' && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken)
      ? `guest:${rawGuestToken.toLowerCase()}`
      : null;
  const key = verified
    ? session.siwe!.address.toLowerCase()
    : (clientGuestToken || (await getOrCreateGuestId(session)));

  const { score, level, kills, combo, pilot, time, name } = body as Record<string, unknown>;
  const assisted = (body as Record<string, unknown>).assisted === true;

  // Display name: 3-12 chars, letters/digits/spaces. Optional for wallet
  // players (they fall back to their address); required for guests, who
  // have no readable identity to show otherwise.
  let displayName: string | undefined;
  if (typeof name === 'string') {
    const cleaned = name.toUpperCase().replace(/\s+/g, ' ').trim();
    if (/^[A-Z0-9 ]{3,12}$/.test(cleaned)) {
      displayName = cleaned;
    }
  }
  if (!verified && !displayName) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  // A player who lost their stored custom name (flaky localStorage) would
  // submit an auto-generated "PILOT 1234" default, which then overwrote the
  // good name already on the board. Never let a default clobber a real name:
  // if this run's name is a default but the player already has a custom name
  // stored, keep the custom one.
  if (displayName && /^PILOT \d{4}$/.test(displayName)) {
    try {
      const existing = await getEntry(key);
      if (existing?.name && !/^PILOT \d{4}$/.test(existing.name)) {
        displayName = existing.name;
      }
    } catch {
      // best-effort; fall through with the submitted name
    }
  }

  // Bot defense for guest scores: wallet players already proved identity by
  // signing, so they're exempt; guests must pass a Turnstile challenge. A
  // no-op until TURNSTILE_SECRET_KEY is configured.
  if (!verified) {
    const ok = await verifyTurnstile((body as Record<string, unknown>).turnstileToken as string | undefined, clientIp(req));
    if (!ok) {
      return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
    }
  }
  // Structural bounds are deliberately WIDE - they exist only to reject
  // pathological/forged payloads, never real play. A marathon no-death run
  // legitimately chains a huge kill streak (bestCombo is the streak COUNT,
  // not the x8 score multiplier) and racks up a large score, so combo/kills/
  // score ceilings must sit well above anything a human can reach. Outliers
  // that slip through still rank, but get copied to the admin review queue
  // (suspicionReason) - the actual anti-cheat gate for payouts.
  if (
    !isInt(score, 1, 100_000_000) ||
    !isInt(level, 1, 500) ||
    !isInt(kills, 0, 500_000) ||
    !isInt(combo, 0, 500_000) ||
    !isInt(time, 0, 86_400) ||
    typeof pilot !== 'string' ||
    !/^[A-Z0-9 ]{1,16}$/.test(pilot)
  ) {
    return NextResponse.json({ error: 'invalid_run' }, { status: 400 });
  }

  // The only hard impossibilities: the richest single kill is a boss (value
  // 750) at the x8 combo cap = 6000 pts, so a run can never legitimately
  // average more than that per kill (headroom to 8000). The kill-rate ceiling
  // is generous - piercing/chain drones clear clumps, so a great run in the
  // new denser waves can sustain a high rate - and only blocks the absurd.
  if (score > kills * 8000 + 50 || kills > time * 30 + 100) {
    return NextResponse.json({ error: 'implausible_run' }, { status: 400 });
  }

  try {
    const allowed = await checkSubmitAllowed(key);
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    const entry = {
      address: key,
      name: displayName,
      score,
      level,
      kills,
      combo,
      pilot,
      time,
      at: Date.now(),
      verified,
      assisted,
      cosmetics: sanitizeCosmetics((body as Record<string, unknown>).cosmetics),
    };
    const result = await submitEntry(entry);

    // If a sponsored cup is live right now, this run ALSO posts to the
    // time-boxed cup board — it counts toward the global best (above) and
    // competes for the cup, but the cup ranking only ever sees runs played
    // inside the window. Best-effort: a cup write must never fail a submit.
    try {
      const season = await getActiveSeason();
      const now = Date.now();
      if (season && season.status === 'active' && now >= season.createdAt && (!season.endsAt || now <= season.endsAt)) {
        await submitCupEntry(season.id, entry);
      }
    } catch {
      // cup board unavailable - the global submit already succeeded
    }

    // the weekly ladder (resets Monday) also takes every run - fresh field
    // each week so new players can always rank. Best-effort like the cup.
    try {
      await submitWeekly(entry);
    } catch {
      // weekly board unavailable - never fails the submit
    }

    // outlier runs still rank (no false-positive punishment) but are copied
    // to the admin review queue - the gate for tournament payouts
    const reason = suspicionReason(entry);
    if (reason) {
      flagRun(entry, reason).catch(() => {});
    }
    return NextResponse.json({ ok: true, verified, ...result });
  } catch {
    return NextResponse.json({ error: 'board_unavailable' }, { status: 503 });
  }
}
