'use client';

import { useEffect, useState } from 'react';

// Clickable partner logos overlaid at the bottom of the menu/loading screens.
// Reads the public /api/sponsors feed, so the operator manages it entirely
// from the admin dashboard. Hidden during gameplay and on other screens.

interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  socials?: { twitter?: string; telegram?: string; website?: string };
  slots: string[];
}

const SHOW_ON = new Set(['menu', 'loading']);

export function PartnersBar() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch('/api/sponsors')
      .then((r) => r.json())
      .then((d) => setSponsors((d.sponsors || []).filter((s: Sponsor) => s.slots?.includes('partners'))))
      .catch(() => {});

    // the engine dispatches this on every state change
    const onState = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setVisible(SHOW_ON.has(detail));
    };
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => window.removeEventListener('raidshooter:state', onState as EventListener);
  }, []);

  if (!visible || sponsors.length === 0) return null;

  const linkFor = (s: Sponsor) => s.socials?.website || s.socials?.twitter || s.socials?.telegram || '#';

  return (
    <div
      style={{ position: 'fixed', left: 0, right: 0, bottom: 6, zIndex: 40, pointerEvents: 'none' }}
      className="flex flex-col items-center gap-1"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/30">Partners</div>
      <div className="flex items-center gap-4" style={{ pointerEvents: 'auto' }}>
        {sponsors.map((s) => (
          <a
            key={s.id}
            href={linkFor(s)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Follow ${s.name}`}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white/70 backdrop-blur-sm transition-colors hover:border-cyan-400/40 hover:text-white"
          >
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="h-4 w-4 rounded object-contain" />
            ) : null}
            <span>{s.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
