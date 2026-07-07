import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
