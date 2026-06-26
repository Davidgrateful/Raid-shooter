import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Shareable "I ranked #X" card (1200x630, the Twitter/Telegram OG size).
// Generated server-side so a player can post a link that unfurls into this
// image, or save it straight from a run. All values come from query params:
//   /api/card?name=MOONBOY&rank=6&score=64500&pilot=NOVA&kills=320
//            &combo=48&level=8&tier=PLATINUM

const TIERS: Record<string, string> = {
  BRONZE: '#cd7f32',
  SILVER: '#cfd3d6',
  GOLD: '#ffcf33',
  PLATINUM: '#39d6e6',
  DIAMOND: '#6fb7ff',
  MASTER: '#c77dff',
};

function tierFromScore(score: number): string {
  if (score >= 250000) return 'MASTER';
  if (score >= 100000) return 'DIAMOND';
  if (score >= 50000) return 'PLATINUM';
  if (score >= 20000) return 'GOLD';
  if (score >= 5000) return 'SILVER';
  return 'BRONZE';
}

function commas(n: number): string {
  return n.toLocaleString('en-US');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get('name') || 'PILOT').toUpperCase().slice(0, 16);
  const pilot = (searchParams.get('pilot') || 'NOVA').toUpperCase().slice(0, 16);
  const score = Math.max(0, parseInt(searchParams.get('score') || '0', 10) || 0);
  const rank = parseInt(searchParams.get('rank') || '0', 10) || 0;
  const kills = Math.max(0, parseInt(searchParams.get('kills') || '0', 10) || 0);
  const combo = Math.max(0, parseInt(searchParams.get('combo') || '0', 10) || 0);
  const level = Math.max(0, parseInt(searchParams.get('level') || '0', 10) || 0);
  const tier = (searchParams.get('tier') || tierFromScore(score)).toUpperCase();
  const tierColor = TIERS[tier] || TIERS.BRONZE;

  const stat = (label: string, value: string) => ({
    label,
    value,
  });
  const stats = [
    stat('KILLS', commas(kills)),
    stat('COMBO', `x${combo}`),
    stat('WAVE', String(level || 1)),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(145deg, #05060a 0%, #0b1020 55%, #060810 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
          padding: '52px 72px',
          position: 'relative',
          justifyContent: 'space-between',
        }}
      >
        {/* tier accent bar */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, height: '10px', background: tierColor }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, letterSpacing: 6, color: '#aeb6c2' }}>
            RAID SHOOTER
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 3,
              color: '#06121a',
              background: tierColor,
              padding: '8px 20px',
              borderRadius: 8,
            }}
          >
            {tier}
          </div>
        </div>

        {/* rank + name */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
          {rank > 0 && (
            <div style={{ display: 'flex', fontSize: 92, fontWeight: 900, lineHeight: 1, color: tierColor }}>
              RANK #{rank}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 54, fontWeight: 800, marginTop: rank > 0 ? 10 : 0 }}>{name}</div>
          <div style={{ display: 'flex', fontSize: 27, color: '#7d8aa0', marginTop: 8, letterSpacing: 2 }}>
            FLYING {pilot}
          </div>
        </div>

        {/* score */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
          <div style={{ display: 'flex', fontSize: 22, color: '#7d8aa0', letterSpacing: 4 }}>SCORE</div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, color: '#fff', lineHeight: 1.05 }}>
            {commas(score)}
          </div>
        </div>

        {/* stat row + CTA */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20 }}>
          <div style={{ display: 'flex', gap: '44px' }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 19, color: '#7d8aa0', letterSpacing: 3 }}>{s.label}</div>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, color: tierColor }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: '#cfd6e2' }}>
            CAN YOU BEAT IT?  PLAY FREE &gt;
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
