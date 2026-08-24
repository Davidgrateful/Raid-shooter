import type { Metadata, Viewport } from 'next';
import { Orbitron, Chakra_Petch, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

// Three faces, three jobs - see the TYPOGRAPHY ROLES block in globals.css.
// next/font self-hosts them, which keeps the CSP's `font-src 'self'` intact
// (a Google Fonts <link> would be blocked outright).
const display = Orbitron({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-rs-display', display: 'swap' });
const ui = Chakra_Petch({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-rs-ui', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-rs-mono', display: 'swap' });

// Absolute base so OG/Twitter image URLs resolve on the real domain instead
// of localhost. Set NEXT_PUBLIC_SITE_URL in prod; falls back to the Vercel
// deployment URL, then localhost for dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Raid Shooter — free arcade raids on Base',
  description:
    'Free arcade twin-stick raid shooter: draft upgrades, chain combos, survive hazard sectors, defeat the Asteroid King, and climb the Shooterboard. Skill tops the leaderboard; cosmetics settle on Base.',
  applicationName: 'Raid Shooter',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Raid Shooter',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Raid Shooter — free arcade raids on Base',
    description:
      'Instant arcade raids in your browser. Build your ship, chain combos, beat the boss, claim your rank. Skill-based leaderboard, cosmetics on Base.',
    url: siteUrl,
    siteName: 'Raid Shooter',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Raid Shooter' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Raid Shooter — free arcade raids on Base',
    description:
      'Instant arcade raids in your browser. Build your ship, chain combos, beat the boss, claim your rank.',
    images: ['/og.png'],
  },
};

// lock zoom so pinch and double-tap (used for the dash) never zoom the page
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // run full-bleed under the notch/Dynamic Island instead of letterboxing
  // beside it; the game reads env(safe-area-inset-*) to keep the HUD clear
  viewportFit: 'cover',
  themeColor: '#05070c',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`} data-rs-portrait-ok="1">
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
