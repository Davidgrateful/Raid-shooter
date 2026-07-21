import type { MetadataRoute } from 'next';

// PWA manifest — makes Raid Shooter installable to an Android home screen or a
// desktop (Chrome/Edge) as a standalone app, no app store required. Served at
// /manifest.webmanifest by Next. The service worker (public/sw.js, registered
// in ServiceWorkerRegister) is what actually satisfies the installability
// criteria alongside this file.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Raid Shooter',
    short_name: 'Raid Shooter',
    description:
      'Free arcade twin-stick raid shooter — draft upgrades, chain combos, beat the boss, climb the leaderboard.',
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'any',
    background_color: '#05070c',
    theme_color: '#05070c',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
