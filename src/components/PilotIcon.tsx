// A small badge rendering a player's equipped loadout on the leaderboard -
// the point isn't pixel-perfect fidelity to the canvas ship art, it's making
// a cosmetic purchase visible to every other competitor scanning the board,
// not just the buyer. Shapes are grouped into the same silhouette families
// the game's own character definitions already use (see characters.js:
// "darts/arrows are fast and fragile, rings/hexagons are armored and slow,
// diamonds/circles run balanced"), so a pilot reads as recognizably itself
// even simplified down to a ~24px glyph.

export interface Cosmetics {
  pilotId?: string;
  shipColor?: string;
  trailHue?: number;
  droneId?: string;
}

type Family = 'triangle' | 'needle' | 'hex' | 'diamond-tail' | 'diamond-orbit' | 'diamond-blocks' | 'ring' | 'circle-tail';

const FAMILY_BY_PILOT: Record<string, Family> = {
  onyix: 'triangle',
  solstice: 'triangle',
  nova: 'needle',
  javelin9: 'needle',
  tankrex: 'hex',
  atlasbeam: 'hex',
  astravane: 'diamond-tail',
  nebulafox: 'diamond-tail',
  runepilot: 'diamond-orbit',
  glitchprince: 'diamond-blocks',
  ironhalo: 'ring',
  crimsonwisp: 'circle-tail',
  voltrider: 'needle',
};

function Glyph({ family, color }: { family: Family; color: string }) {
  switch (family) {
    case 'triangle':
      return <path d="M12 3 L19 20 L12 16.5 L5 20 Z" fill={color} />;
    case 'needle':
      return <path d="M12 2 L15 20 L12 17 L9 20 Z" fill={color} />;
    case 'hex':
      return <path d="M12 3 L19 7.5 L19 16.5 L12 21 L5 16.5 L5 7.5 Z" fill={color} />;
    case 'diamond-tail':
      return (
        <>
          <path d="M12 4 L18 12 L12 20 L6 12 Z" fill={color} />
          <path d="M9 20 L7 23 M15 20 L17 23" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </>
      );
    case 'diamond-orbit':
      return (
        <>
          <path d="M12 5 L17 12 L12 19 L7 12 Z" fill={color} />
          <circle cx="4.5" cy="9" r="1.6" fill={color} />
          <circle cx="19.5" cy="9" r="1.6" fill={color} />
        </>
      );
    case 'diamond-blocks':
      return (
        <>
          <path d="M12 5 L17 12 L12 19 L7 12 Z" fill={color} />
          <rect x="3.5" y="3.5" width="3" height="3" fill={color} />
          <rect x="17.5" y="17.5" width="3" height="3" fill={color} />
        </>
      );
    case 'ring':
      return <circle cx="12" cy="12" r="7.5" fill="none" stroke={color} strokeWidth="4" />;
    case 'circle-tail':
      return (
        <>
          <circle cx="12" cy="10" r="6" fill={color} />
          <path d="M9 15 Q12 21 15 15" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.7" />
        </>
      );
  }
}

export function PilotIcon({ cosmetics, size = 24, pilotName }: { cosmetics?: Cosmetics; size?: number; pilotName?: string }) {
  const family = (cosmetics?.pilotId && FAMILY_BY_PILOT[cosmetics.pilotId]) || null;
  const color = cosmetics?.shipColor || 'rgba(255,255,255,0.25)';

  // On hover (desktop) / tap-and-hold (most mobile browsers), a small label
  // shows which pilot this player flies - the icon alone reads "someone
  // customized their ship" but doesn't say which pilot, and players kept
  // asking to see that. Only rendered when the row passes a pilotName;
  // falls back to nothing (no dead tooltip) if it's not known.
  const tooltip = pilotName ? (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-black/95 px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
    >
      {pilotName}
    </span>
  ) : null;

  if (!family) {
    // no cosmetics on file (older entry, or fetch failed) - a neutral dash
    // instead of a broken/empty slot
    return (
      <span
        className="group relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 text-white/20"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        <span aria-hidden>·</span>
        {tooltip}
      </span>
    );
  }

  const hasTrail = typeof cosmetics?.trailHue === 'number';

  return (
    <span className="group relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {hasTrail && (
        <svg width={size} height={size} viewBox="0 0 24 24" className="absolute inset-0" aria-hidden>
          <circle cx="12" cy="12" r="10.5" fill="none" stroke={`hsl(${cosmetics!.trailHue}, 90%, 60%)`} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.55" />
        </svg>
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" className="relative" aria-hidden>
        <Glyph family={family} color={color} />
      </svg>
      {cosmetics?.droneId && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 rounded-full border border-black/40"
          style={{ width: size * 0.28, height: size * 0.28, background: 'hsl(190, 100%, 65%)' }}
        />
      )}
      {tooltip}
    </span>
  );
}
