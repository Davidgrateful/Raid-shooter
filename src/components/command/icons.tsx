/*==============================================================================
Command terminal iconography

One family, one grammar: 24x24, 1.6 stroke, flat caps, built from the same
angular shapes as the ships. Icons carry the nav on mobile where labels shrink
to a whisper, so each silhouette has to be distinguishable at a glance.
==============================================================================*/

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconDeploy({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M12 3.5 15.5 12v6.5L12 16l-3.5 2.5V12z" />
      <path d="M8.5 18.5 6.5 21M15.5 18.5 17.5 21" />
    </svg>
  );
}

export function IconPilot({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
      <path d="M8.4 8.5h7.2" />
    </svg>
  );
}

export function IconArmory({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M12 3 20 6.6v6.1c0 4-3.3 7-8 8.3-4.7-1.3-8-4.3-8-8.3V6.6z" />
      <path d="M12 9v5M9.6 11.4h4.8" />
    </svg>
  );
}

export function IconMarket({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M4 8.4h16l-1.3 11a1.6 1.6 0 0 1-1.6 1.4H6.9a1.6 1.6 0 0 1-1.6-1.4z" />
      <path d="M8.6 8.4V6.5a3.4 3.4 0 0 1 6.8 0v1.9" />
    </svg>
  );
}

export function IconRankings({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M4 20.5h16" />
      <path d="M6.5 20.5v-6h4v6M13.5 20.5V8h4v12.5" />
      <path d="M9 6 10.4 3l1.4 3-1.4 1.2z" />
    </svg>
  );
}

export function IconSystem({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" />
    </svg>
  );
}

export function IconMore({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFlame({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M12 21c3.6 0 6-2.3 6-5.4 0-3.6-3-5-4-8.6-2.2 1.4-2.6 3.3-2.6 4.6-1-.6-1.4-1.6-1.4-2.8C8 10.4 6 12.2 6 15.6 6 18.7 8.4 21 12 21Z" />
    </svg>
  );
}

export function IconBolt({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M13.4 2.6 5 13.6h5.6L9.9 21.4 18.6 10h-5.9z" />
    </svg>
  );
}

export function IconGift({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M3.8 9.6h16.4v3.2H3.8zM5.2 12.8h13.6v7.6H5.2zM12 9.6v10.8" />
      <path d="M12 9.6S10.6 4.4 8.2 4.4a2.3 2.3 0 0 0 0 5.2M12 9.6s1.4-5.2 3.8-5.2a2.3 2.3 0 0 1 0 5.2" />
    </svg>
  );
}

export function IconTarget({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 1.8v3.4M12 18.8v3.4M22.2 12h-3.4M5.2 12H1.8" />
    </svg>
  );
}

export function IconMail({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <rect x="3" y="5.4" width="18" height="13.2" rx="1.6" />
      <path d="m3.6 6.6 8.4 6 8.4-6" />
    </svg>
  );
}

export function IconSignal({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M4 20V14M9.3 20V10M14.7 20V6M20 20V3" />
    </svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="m9 5.5 7 6.5-7 6.5" />
    </svg>
  );
}

export function IconComms({ className }: IconProps) {
  return (
    <svg {...base} className={className} width="100%" height="100%" aria-hidden>
      <path d="M20.4 15.8a1.7 1.7 0 0 1-1.7 1.7H8.2L4 21.2V5.5a1.7 1.7 0 0 1 1.7-1.7h13a1.7 1.7 0 0 1 1.7 1.7z" />
      <path d="M8.2 9.2h8M8.2 12.6h5.2" />
    </svg>
  );
}
