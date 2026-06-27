import { NextResponse } from 'next/server';
import { getActiveSponsors } from '@/lib/sponsors';

// Public: the active sponsors the game and partners UI display. Returns only
// presentational fields (no internal flags), so it's safe to be open.
export async function GET() {
  const sponsors = await getActiveSponsors();
  return NextResponse.json({
    sponsors: sponsors.map((s) => ({
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      logoUrl: s.logoUrl,
      accentColor: s.accentColor,
      socials: s.socials,
      slots: s.slots,
    })),
  });
}
