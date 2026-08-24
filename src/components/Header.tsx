'use client';

import { useEffect, useState } from 'react';
import { WalletButton } from './WalletButton';

export function Header() {
  // Slides away during action so it never covers gameplay. It also stands
  // down on the menu, where the command centre's own top bar hosts the wallet
  // control - two Connect buttons on one screen is exactly the kind of
  // web-page residue this redesign is removing.
  const [inAction, setInAction] = useState(false);

  useEffect(() => {
    const onState = (e: Event) => {
      const state = (e as CustomEvent<string>).detail;
      setInAction(state === 'play' || state === 'upgrade' || state === 'menu');
    };
    window.addEventListener('raidshooter:state', onState);
    return () => window.removeEventListener('raidshooter:state', onState);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-end gap-2 px-4 py-2 max-sm:px-2 max-sm:py-1 bg-transparent pointer-events-none transition-transform duration-300 ${
        inAction ? '-translate-y-full' : ''
      }`}
    >
      <div className="pointer-events-auto">
        <WalletButton />
      </div>
    </header>
  );
}
