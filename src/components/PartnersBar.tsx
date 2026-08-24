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

/*==============================================================================
Partner strip

Operator-managed sponsor placements. It used to run as two separate floating
bars - one pinned over the top of the screen, one at the bottom - which is
precisely the kind of page furniture that made the menu read as a website.

Both placements now collapse into a single quiet strip along the bottom edge,
sitting behind the command centre's own chrome: readable, clickable, credited,
and never in front of anything the player came here to do. On phones it rides
above the tab bar rather than under it.
==============================================================================*/

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
  const featured = sponsors.find((s) => s.slots?.includes('menu'));
  const partners = sponsors.filter((s) => s.slots?.includes('partners') && s.id !== featured?.id);

  if (partners.length === 0 && !featured) return null;

  return (
    <div data-game-ui="" className="rs-partners">
      <span className="rs-label shrink-0">Backed by</span>
      <div className="rs-scroll flex min-w-0 items-center gap-3 overflow-x-auto">
        {featured && (
          <a
            key={featured.id}
            href={linkFor(featured)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Follow ${featured.name}`}
            onClick={() => trackAd(featured.id, 'click')}
            className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
            style={{ color: featured.accentColor || 'var(--rs-cyan)' }}
          >
            {featured.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.logoUrl} alt="" className="h-4 w-4 rounded-sm object-contain" />
            ) : null}
            <span>{featured.name}</span>
          </a>
        )}
        {partners.map((s) => (
          <a
            key={s.id}
            href={linkFor(s)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Follow ${s.name}`}
            onClick={() => trackAd(s.id, 'click')}
            className="flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-white/35 transition-colors hover:text-white"
          >
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="h-3.5 w-3.5 rounded-sm object-contain opacity-70" />
            ) : null}
            <span>{s.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
