// Sponsor / partnership store. Lets the operator add, edit, and remove
// co-marketing partners from the admin dashboard with zero code changes -
// the game and the public /api/sponsors endpoint read whatever is active.
// Redis-backed when configured, in-memory for dev.

import { isKvConfigured, redisCommand } from '@/lib/kv';

const SPONSORS_KEY = 'shooterboard:sponsors';

export type SponsorSlot = 'loading' | 'menu' | 'partners' | 'arena';
export const SPONSOR_SLOTS: SponsorSlot[] = ['loading', 'menu', 'partners', 'arena'];

export interface Sponsor {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  accentColor?: string;
  socials?: { twitter?: string; telegram?: string; website?: string };
  slots: SponsorSlot[];
  active: boolean;
  order: number;
  createdAt: number;
}

const mem = new Map<string, Sponsor>();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sponsor';
}

// keep only http(s) URLs so a bad value can't inject anything odd downstream
function safeUrl(u: unknown): string | undefined {
  const v = (u || '').toString().trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v.slice(0, 400) : undefined;
}

function clean(input: Partial<Sponsor>): Sponsor {
  const name = (input.name || '').toString().trim().slice(0, 40) || 'Sponsor';
  const id = (input.id || slugify(name)).toString();
  const slots = Array.isArray(input.slots)
    ? input.slots.filter((s): s is SponsorSlot => SPONSOR_SLOTS.includes(s as SponsorSlot))
    : [];
  const accent = (input.accentColor || '').toString().trim();
  return {
    id,
    name,
    tagline: (input.tagline || '').toString().trim().slice(0, 80) || undefined,
    logoUrl: safeUrl(input.logoUrl),
    accentColor: /^#?[0-9a-fA-F]{3,8}$/.test(accent) ? (accent.startsWith('#') ? accent : `#${accent}`) : undefined,
    socials: {
      twitter: safeUrl(input.socials?.twitter),
      telegram: safeUrl(input.socials?.telegram),
      website: safeUrl(input.socials?.website),
    },
    slots,
    active: input.active !== false,
    order: Number.isFinite(input.order) ? Number(input.order) : 0,
    createdAt: input.createdAt || Date.now(),
  };
}

export async function listSponsors(): Promise<Sponsor[]> {
  let rows: Sponsor[];
  if (isKvConfigured()) {
    const raw = (await redisCommand(['HGETALL', SPONSORS_KEY])) as unknown;
    const vals: string[] = [];
    if (Array.isArray(raw)) {
      for (let i = 1; i < raw.length; i += 2) vals.push(String(raw[i]));
    } else if (raw && typeof raw === 'object') {
      for (const v of Object.values(raw as Record<string, unknown>)) vals.push(String(v));
    }
    rows = vals
      .map((v) => {
        try {
          return JSON.parse(v) as Sponsor;
        } catch {
          return null;
        }
      })
      .filter((s): s is Sponsor => !!s);
  } else {
    rows = [...mem.values()];
  }
  return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function getActiveSponsors(slot?: SponsorSlot): Promise<Sponsor[]> {
  const all = await listSponsors();
  return all.filter((s) => s.active && (!slot || s.slots.includes(slot)));
}

export async function upsertSponsor(input: Partial<Sponsor>): Promise<Sponsor> {
  const sponsor = clean(input);
  if (isKvConfigured()) {
    await redisCommand(['HSET', SPONSORS_KEY, sponsor.id, JSON.stringify(sponsor)]);
  } else {
    mem.set(sponsor.id, sponsor);
  }
  return sponsor;
}

export async function deleteSponsor(id: string): Promise<boolean> {
  if (!id) return false;
  if (isKvConfigured()) {
    const removed = (await redisCommand(['HDEL', SPONSORS_KEY, id])) as number;
    return removed > 0;
  }
  return mem.delete(id);
}
