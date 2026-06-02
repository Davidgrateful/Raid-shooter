'use client';

import { WalletButton } from './WalletButton';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-black/70 backdrop-blur-sm border-b border-white/10">
      <div className="text-sm font-bold tracking-wider text-white/80">
        RAID SHOOTER
      </div>
      <WalletButton />
    </header>
  );
}
