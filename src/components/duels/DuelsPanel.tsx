'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/command/panels';
import { compactTokens } from '@/lib/token';
import { whenIdle } from '@/lib/idle';
import { copyText, createDuel, duelLine, duelUrl, fetchDeck, flyDuel, rivalName, type DuelView, type DuelsDeck } from './duelClient';

/*==============================================================================
DUELS on the command deck

Create a duel, send the link, fly the raid - in either order. The panel lists
your last few duels with where each one stands, and flies any you still owe a
run on. Who may CREATE is the operator's call (holders first by default);
anyone can accept from a link, so a guest is told that too.
==============================================================================*/

const ERR: Record<string, string> = {
  off: 'Duels are paused right now.',
  sign_in: 'Sign in to create a duel.',
  not_a_holder: 'This wallet does not hold enough $RAIDSHOOTER yet.',
  chain_unavailable: 'Could not check your holder tier just now - try again.',
  name_required: 'Set a call sign first (System -> Call sign).',
  captcha_failed: 'The bot check did not pass - try again.',
  rate_limited: 'Too many duels in a row - wait a minute.',
};

export function DuelsPanel() {
  const [deck, setDeck] = useState<DuelsDeck | null>(null);
  const [made, setMade] = useState<DuelView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(() => {
    fetchDeck().then((d) => { if (d) setDeck(d); }).catch(() => {});
  }, []);
  useEffect(() => whenIdle(load), [load]);

  async function create() {
    setBusy(true); setErr('');
    const r = await createDuel();
    setBusy(false);
    if (r.duel) { setMade(r.duel); load(); } else setErr(ERR[r.error || ''] || 'Could not create a duel - try again.');
  }
  async function copy(id: string) {
    const ok = await copyText(duelUrl(id));
    setCopied(ok ? id : `!${id}`);
    setTimeout(() => setCopied(''), 1800);
  }

  if (!deck) return null;
  const min = compactTokens(deck.minHold);
  const chip = deck.access === 'holders'
    ? <span className="rs-holder-chip" data-tier="holder" title="Holders create duels first">$</span>
    : null;

  // one row per duel: the code, who it's against, where it stands, what you can do
  const row = (v: DuelView) => (
    <li key={v.id} className="rs-duel-row" data-state={v.state} data-outcome={v.outcome || ''}>
      <div className="rs-duel-row-main">
        <span className="rs-duel-code">{v.id}</span>
        <span className="rs-duel-vs">{rivalName(v) ? `vs ${rivalName(v)}` : 'open challenge'}</span>
      </div>
      <div className="rs-duel-line">{duelLine(v)}</div>
      <div className="rs-duel-acts">
        {v.canFly && <button type="button" className="rs-duel-btn rs-duel-btn-go" onClick={() => flyDuel(v)}>Fly it</button>}
        {v.state === 'open' && (
          <button type="button" className="rs-duel-btn" onClick={() => copy(v.id)}>
            {copied === v.id ? 'Link copied' : copied === `!${v.id}` ? duelUrl(v.id) : 'Copy link'}
          </button>
        )}
      </div>
    </li>
  );

  const mine = deck.mine.filter((v) => v.id !== made?.id).slice(0, 3);

  return (
    <Panel title="Duels" action={chip}>
      <p className="rs-duel-blurb">
        Challenge a pilot to the same raid: same waves, same drops. You each fly it once within 48 hours, and the higher score wins.
      </p>

      {made && <ul className="rs-duel-list rs-duel-new">{row(made)}</ul>}

      {deck.canCreate ? (
        <button type="button" className="rs-duel-btn rs-duel-btn-go rs-duel-create" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : made ? 'Another duel' : 'New duel'}
        </button>
      ) : (
        <p className="rs-duel-gate">
          {deck.reason === 'off' && 'Duels are paused. You can still finish any duel you are in.'}
          {deck.reason === 'sign_in' && (deck.access === 'holders'
            ? <>Holders create duels first: sign in with a wallet holding {min}+ $RAIDSHOOTER. Anyone can accept a duel from a link.</>
            : <>Sign in to create a duel. Anyone can accept one from a link.</>)}
          {deck.reason === 'not_a_holder' && <>Holders create duels first: hold {min}+ $RAIDSHOOTER to start one. Anyone can accept a duel from a link.</>}
          {deck.reason === 'chain_unavailable' && 'Could not check your holder tier just now.'}
        </p>
      )}
      {err && <p className="rs-duel-err" role="status">{err}</p>}

      {mine.length > 0 && (
        <>
          <div className="rs-duel-sub">Your duels</div>
          <ul className="rs-duel-list">{mine.map(row)}</ul>
        </>
      )}
    </Panel>
  );
}
