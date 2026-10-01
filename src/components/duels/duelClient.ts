import { guestToken } from '@/components/command/useMenuData';

/*
 * The client half of DUELS (server rules: src/lib/duels.ts). Shared by the
 * deck panel, the duel-link invite and the debrief.
 */

export interface DuelEntryView { name: string; verified: boolean; score: number; pilot: string; level: number; kills: number; time: number; mine: boolean; creator: boolean }
export interface DuelView {
  id: string;
  state: 'open' | 'settled' | 'expired';
  expiresAt: number;
  creator: { name: string; verified: boolean };
  entries: DuelEntryView[];
  role: 'creator' | 'challenger' | null;
  canFly: boolean;
  seed?: number;
  outcome?: 'won' | 'lost' | 'draw';
}

interface DuelEngine {
  startDuelRun?: (d: { id: string; seed: number }) => void;
  ensurePilotName?: () => string;
  session?: { authenticated?: boolean };
  storage?: Record<string, unknown>;
}

function eng(): DuelEngine | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { $?: DuelEngine }).$) || null;
}

export function duelUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://raidshooter.xyz';
  return `${origin}/duel/${id}`;
}

function q(): string {
  const g = guestToken();
  return g ? `?g=${encodeURIComponent(g)}` : '';
}

export async function fetchDuel(id: string): Promise<DuelView | null> {
  const r = await fetch(`/api/duels/${encodeURIComponent(id)}${q()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return d?.duel ?? null;
}

export interface DuelsDeck {
  access: 'off' | 'holders' | 'all';
  signedIn: boolean;
  canCreate: boolean;
  reason: 'off' | 'sign_in' | 'not_a_holder' | 'chain_unavailable' | null;
  minHold: number;
  mine: DuelView[];
}

export async function fetchDeck(): Promise<DuelsDeck | null> {
  const r = await fetch(`/api/duels${q()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export async function createDuel(): Promise<{ duel?: DuelView; error?: string }> {
  const e = eng();
  const authed = !!e?.session?.authenticated;
  const body = {
    guestToken: authed ? undefined : guestToken() || undefined,
    name: authed ? (e?.storage?.pilotname as string | undefined) : e?.ensurePilotName?.(),
    turnstileToken: authed ? undefined : (window as unknown as { __turnstileToken?: string }).__turnstileToken,
  };
  try {
    const r = await fetch('/api/duels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: d.error || 'failed' };
    return { duel: d.duel };
  } catch {
    return { error: 'offline' };
  }
}

/** Starts the duel's seeded raid in the engine. Needs the seed (canFly). */
export function flyDuel(view: DuelView): boolean {
  const e = eng();
  if (!e?.startDuelRun || typeof view.seed !== 'number' || !view.canFly) return false;
  e.startDuelRun({ id: view.id, seed: view.seed });
  return true;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "You won 18,420 - 15,980", "Waiting for a rival", ... from the viewer's side */
export function duelLine(v: DuelView): string {
  const mine = v.entries.find((e) => e.mine);
  const theirs = v.entries.find((e) => !e.mine);
  if (v.state === 'settled' && mine && theirs) {
    const s = `${mine.score.toLocaleString()} – ${theirs.score.toLocaleString()}`;
    return v.outcome === 'won' ? `You won ${s}` : v.outcome === 'lost' ? `You lost ${s}` : `Dead heat ${s}`;
  }
  if (v.state === 'expired') return mine ? 'Expired - nobody took it on' : 'Expired';
  if (mine) return 'Your run is in. Waiting for a rival';
  if (theirs) return `${theirs.name} scored ${theirs.score.toLocaleString()}. Your move`;
  return 'Nobody has flown it yet';
}

export function rivalName(v: DuelView): string | null {
  const theirs = v.entries.find((e) => !e.mine);
  if (theirs) return theirs.name;
  return v.role === 'creator' ? null : v.creator.name;
}
