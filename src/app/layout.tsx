import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'Raid Shooter',
  description:
    'Free arcade twin-stick raid shooter: draft upgrades, chain combos, survive hazard sectors, defeat the Asteroid King, and claim your rank on Shooterboard with your wallet.',
  openGraph: {
    title: 'Raid Shooter',
    description:
      'Instant arcade raids in your browser. Build your ship, chain combos, beat the boss, claim your rank.',
    images: ['/og.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Raid Shooter',
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
      </body>
    </html>
  );
}
