'use client';

import { useEffect, useRef, useState } from 'react';

// Fire-and-forget sponsor metric beacon (impression / click). Best-effort, so
// failures never disrupt the UI.
function trackAd(id: string, type: 'impression' | 'click') {
  try {
    const body = JSON.stringify({ id, type });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/sponsors/track', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/sponsors/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

// Clickable partner logos overlaid at the bottom of the menu/loading screens.
// Reads the public /api/sponsors feed, so the operator manages it entirely
// from the admin dashboard. Hidden during gameplay and on other screens.

interface Sponsor {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  accentColor?: string;
  socials?: { twitter?: string; telegram?: string; website?: string };
  slots: string[];
}

const SHOW_ON = new Set(['menu', 'loading']);

export function PartnersBar() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [visible, setVisible] = useState(false);
  // remember which sponsors we've already counted an impression for this
  // session, so re-renders / state flips don't double-count reach
  const seenImpression = useRef<Set<string>>(new Set());

  // count one impression per sponsor the first time its placement is shown
  useEffect(() => {
    if (!visible) return;
    for (const s of sponsors) {
      const shown = s.slots?.includes('partners') || s.slots?.includes('menu') || s.slots?.includes('loading');
      if (shown && !seenImpression.current.has(s.id)) {
        seenImpression.current.add(s.id);
        trackAd(s.id, 'impression');
      }
    }
  }, [visible, sponsors]);

  useEffect(() => {
    fetch('/api/sponsors')
      .then((r) => r.json())
      .then((d) => setSponsors(d.sponsors || []))
      .catch(() => {});

    // the engine dispatches this on every state change
    const onState = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setVisible(SHOW_ON.has(detail));
    };
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => window.removeEventListener('raidshooter:state', onState as EventListener);
  }, []);

  if (!visible) return null;

  const linkFor = (s: Sponsor) => s.socials?.website || s.socials?.twitter || s.socials?.telegram || '#';
  const partners = sponsors.filter((s) => s.slots?.includes('partners'));
  // the "menu" slot is a single featured headline placement; show the first one
  const featured = sponsors.find((s) => s.slots?.includes('menu'));

  if (partners.length === 0 && !featured) return null;

  return (
    <>
      {featured ? (
        <div
          style={{ position: 'fixed', left: 0, right: 0, top: 12, zIndex: 40, pointerEvents: 'none' }}
          className="flex flex-col items-center gap-1"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/30">Powered by</div>
          <a
            href={linkFor(featured)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Follow ${featured.name}`}
            onClick={() => trackAd(featured.id, 'click')}
            style={{ pointerEvents: 'auto', borderColor: featured.accentColor || undefined }}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-black/50 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors hover:text-white"
          >
            {featured.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
            ) : null}
            <span>{featured.name}</span>
            {featured.tagline ? <span className="text-white/40">— {featured.tagline}</span> : null}
          </a>
        </div>
      ) : null}

      {partners.length > 0 ? (
        <div
          style={{ position: 'fixed', left: 0, right: 0, bottom: 6, zIndex: 40, pointerEvents: 'none' }}
          className="flex flex-col items-center gap-1"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/30">Partners</div>
          <div className="flex items-center gap-4" style={{ pointerEvents: 'auto' }}>
            {partners.map((s) => (
              <a
                key={s.id}
                href={linkFor(s)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Follow ${s.name}`}
                onClick={() => trackAd(s.id, 'click')}
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
      ) : null}
    </>
  );
}
