'use client';

import { useEffect, useState } from 'react';
import { useEngineState } from '@/components/command/engine';
import { duelLine, fetchDuel, flyDuel, type DuelView } from './duelClient';

/*==============================================================================
The duel link, inside the game

/duel/ABC123 hands over to /?duel=ABC123. Once the engine is on its menu,
this asks the server how the duel stands for THIS player and offers the one
thing they can do: fly it, see how it ended, or learn that it expired. The
query string is cleared afterwards so a reload does not ask again.
==============================================================================*/

export function DuelInvite() {
  const state = useEngineState();
  const [code, setCode] = useState<string | null>(null);
  const [view, setView] = useState<DuelView | null | 'missing'>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('duel');
    if (p && /^[A-Za-z0-9]{6}$/.test(p)) setCode(p.toUpperCase());
  }, []);

  // wait for the menu: the engine (and the player's identity) is ready there
  useEffect(() => {
    if (!code || view !== null || state !== 'menu') return;
    fetchDuel(code).then((v) => { setView(v ?? 'missing'); setOpen(true); }).catch(() => { setView('missing'); setOpen(true); });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('duel');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* history unavailable */ }
  }, [code, view, state]);

  if (!open || view === null) return null;
  const close = () => setOpen(false);
  const v = view === 'missing' ? null : view;
  const target = v && v.entries.length ? Math.max(...v.entries.map((e) => e.score)) : null;

  return (
    <div data-game-ui="" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="duel-invite-title">
      <div className="rs-panel rs-cut w-full max-w-sm p-5 text-white">
        <div className="rs-label text-[color:var(--rs-cyan)]">Duel {code}</div>
        {!v ? (
          <>
            <h2 id="duel-invite-title" className="rs-display mt-2 text-xl">Duel not found</h2>
            <p className="mt-2 text-sm text-white/60">The link may be mistyped, or the duel ended more than a week ago.</p>
          </>
        ) : v.canFly ? (
          <>
            <h2 id="duel-invite-title" className="rs-display mt-2 text-xl">
              {v.role === 'creator' ? 'Fly your duel' : `${v.creator.name} challenges you`}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              {target !== null ? <>Beat <b className="rs-num text-[color:var(--rs-gold)]">{target.toLocaleString()}</b> on the same raid. </> : 'Nobody has flown it yet. '}
              One attempt: same waves, same drops, no continues.
            </p>
          </>
        ) : (
          <>
            <h2 id="duel-invite-title" className="rs-display mt-2 text-xl">{v.state === 'settled' ? 'This duel is settled' : v.state === 'expired' ? 'This duel has expired' : 'You have flown this one'}</h2>
            <p className="mt-2 text-sm text-white/65">{duelLine(v)}.</p>
          </>
        )}
        <div className="mt-4 flex gap-2">
          {v?.canFly && (
            <button type="button" className="rs-duel-btn rs-duel-btn-go flex-1" onClick={() => { if (flyDuel(v)) close(); }}>
              Fly this raid
            </button>
          )}
          <button type="button" className="rs-duel-btn flex-1" onClick={close}>{v?.canFly ? 'Not now' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
