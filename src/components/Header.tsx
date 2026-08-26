'use client';

import { useEffect, useState } from 'react';
import { WalletButton } from './WalletButton';

export function Header() {
  // Slides away during action so it never covers gameplay. It also stands
  // down on any screen that carries its own wallet control - the command deck
  // and the hangar both host one in their own top bar, and two Connect buttons
  // on one screen is exactly the kind of web-page residue this redesign is
  // removing.
  const [inAction, setInAction] = useState(false);

  useEffect(() => {
    const onState = (e: Event) => {
      const state = (e as CustomEvent<string>).detail;
      setInAction(state === 'play' || state === 'upgrade' || state === 'menu' || state === 'hangar' || state === 'market' || state === 'playmode');
    };
    window.addEventListener('raidshooter:state', onState);
    return () => window.removeEventListener('raidshooter:state', onState);
  }, []);

  return (
    <header
      /*
       * `-translate-y-full` slides this out of sight, but a translated element
       * is still focusable and still announced: measured on the command deck,
       * this button sat at y=-42 with visibility:visible, so a keyboard user
       * tabbed into an off-screen CONNECT WALLET and screen readers reported
       * two identically-named controls. `inert` takes it out of the tab order
       * and the accessibility tree as well, which is what "stands down"
       * was always meant to mean.
       */
      inert={inAction}
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
