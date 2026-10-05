'use client';

import { useCallback, useEffect, useState } from 'react';
import { LINK_WINDOW_MS, useWallet, wallet } from '@/lib/walletStore';

/*==============================================================================
ACCOUNT - linked sign-ins (System screen)

Players with an account on one wallet asked to also sign in with Google or
email (Reown's embedded wallets are a different address, so that used to be
a separate, empty account), and the reverse. Here they link them: either
sign-in then opens the same account - pilots, items, kits, rank. The server
side is src/lib/accounts.ts and /api/account/link. Reads the wallet only
through the store, so this screen never pulls the wallet SDK into the boot.
==============================================================================*/

interface LinkView { account: string; signer: string; links: string[]; max: number }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function AccountLinks() {
  const w = useWallet();
  const [view, setView] = useState<LinkView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch('/api/account/link', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setView(d.signedIn ? { account: d.account, signer: d.signer, links: d.links || [], max: d.max || 3 } : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!w.authenticated) return;
    load();
    window.addEventListener('raidshooter:linked', load);
    return () => window.removeEventListener('raidshooter:linked', load);
  }, [w.authenticated, w.siweSigner, load]);

  // an abandoned attempt ends on its own; re-render when the window closes
  const linking = !!w.linkingSince;
  useEffect(() => {
    if (!linking) return;
    const t = setTimeout(() => wallet.cancelLink(), Math.max(0, w.linkingSince + LINK_WINDOW_MS - Date.now()));
    return () => clearTimeout(t);
  }, [linking, w.linkingSince]);

  const remove = async (address: string) => {
    setBusy(address);
    setNote(null);
    try {
      const res = await fetch('/api/account/link', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
      const d = await res.json().catch(() => ({}));
      if (d.ok) { setNote({ ok: true, text: `${short(address)} removed. It no longer opens this account.` }); load(); }
      else setNote({ ok: false, text: d.message || 'Could not remove that sign-in. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  if (!w.authenticated) {
    return (
      <div className="rs-set-row">
        <div className="rs-set-text">
          <span className="rs-set-label">Linked sign-ins</span>
          <span className="rs-set-help">Sign in first, then link your wallet and your Google or email login so either one opens the same account.</span>
        </div>
        <div className="rs-set-ctl">
          <button type="button" className="rs-btn rs-btn-ghost" onClick={() => void wallet.ask()}>Sign in</button>
        </div>
      </div>
    );
  }

  const shown = note || w.linkNote;
  const all = view ? [view.account, ...view.links] : [];
  const full = view ? view.links.length >= view.max : false;

  return (
    <div className="rs-acct" data-linking={linking ? '1' : '0'}>
      <div className="rs-set-row">
        <div className="rs-set-text">
          <span className="rs-set-label">Linked sign-ins</span>
          <span className="rs-set-help">
            Add your Google or email login to the wallet you already play with, or the reverse. Either one then opens this
            account, with your pilots, items, kits and rank. Anything the new one already had merges in.
          </span>
        </div>
      </div>

      <ul className="rs-acct-list" aria-label="Sign-ins for this account">
        {all.map((a, i) => (
          <li key={a} className="rs-acct-item" data-main={i === 0 ? '1' : '0'}>
            <span className="rs-acct-addr rs-num">{short(a)}</span>
            <span className="rs-acct-tags">
              {i === 0 && <span className="rs-acct-tag">Main</span>}
              {view && a === view.signer && <span className="rs-acct-tag rs-acct-tag-on">Signed in</span>}
            </span>
            {i > 0 && view && a !== view.signer && (
              <button type="button" className="rs-acct-remove" disabled={busy === a} onClick={() => void remove(a)}>
                {busy === a ? 'Removing…' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {linking ? (
        <div className="rs-acct-wait" role="status">
          <span className="rs-acct-wait-text">
            Connect the other wallet, or choose Google / email, in the window. It will ask you to sign once to confirm.
          </span>
          <span className="rs-acct-wait-acts">
            <button type="button" className="rs-btn rs-btn-ghost" onClick={() => void wallet.connect()}>Open window</button>
            <button type="button" className="rs-btn rs-btn-ghost" onClick={() => wallet.cancelLink()}>Cancel</button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="rs-btn rs-btn-solid rs-acct-add"
          disabled={!view || full}
          onClick={() => { setNote(null); void wallet.startLink(); }}
        >
          {full ? `${view?.max} sign-ins linked` : 'Link another sign-in'}
        </button>
      )}

      {shown && <p className="rs-acct-note" data-ok={shown.ok ? '1' : '0'} role="status">{shown.text}</p>}
    </div>
  );
}
