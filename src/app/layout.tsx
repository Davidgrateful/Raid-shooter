import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'Raid Shooter',
  description: 'Canvas-based arcade shooter game with Web3 wallet integration',
};

// lock zoom so pinch and double-tap (used for the dash) never zoom the page
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
