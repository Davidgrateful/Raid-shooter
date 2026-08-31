'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { engine, useEngineState, withEngine } from '@/components/command/engine';
import { chooseUpgrade, readDraft, type DraftCard, type DraftView } from './data';

/*==============================================================================
THE DRAFT

A level-up interrupts the raid, so this screen has about two seconds of the
player's attention and one job: make the choice legible enough to be a real
decision rather than a reflex tap on the middle card.

THE HONEST PART
`$.resetUpgrades()` wipes `$.upgrades` on every reset. A pick made here is a
build for THIS raid and is gone the moment the run ends - it is not bought, not
banked, and not part of the loadout the hangar shows. The old cards never said
so, and sat one tap away from a screen where everything else IS permanent. So
the header says it plainly, once, in the quietest voice on the screen.

WHAT REPLACED "SHOOT FASTER"
The engine's own descriptions are directional but not decisive - three cards
that all say "better" give the player nothing to choose between. The real
magnitude of one pick lives in `recomputeUpgrades()`, so each card now states
that (−15% time between shots, +40% bullet damage) alongside the stack you
already hold and the cap it is walking toward. A card at 5/6 is a visibly
different proposition from a card at 0/6, which is exactly the information a
draft decision needs.

MOTION
The frozen last frame of the raid stays behind this, dimmed. The cards arrive
staggered, fast. Choosing runs a single confirm flash on the taken card and
hands straight back to the engine - the run never visibly "returns to a menu".
==============================================================================*/

/* No lane may borrow a reserved colour: cyan is equip/active/navigation/system
   and is never a category here. See UPGRADE_EFFECT for why there are three. */
const LANE_TONE: Record<string, string> = {
  offence: 'var(--rs-red)',
  survival: 'var(--rs-green)',
  salvage: 'var(--rs-gold)',
};

const LANE_LABEL: Record<string, string> = {
  offence: 'Offence',
  survival: 'Survival',
  salvage: 'Salvage',
};

export function UpgradeDraft() {
  const state = useEngineState();
  const onDraft = state === 'upgrade';

  const [view, setView] = useState<DraftView | null>(null);
  const [taken, setTaken] = useState<string | null>(null);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__htmlUpgrade = 1;
  }, []);

  // Deferred a tick so neither write re-enters render synchronously; the
  // engine has already staged $.upgradeChoices by the time this reads it.
  useEffect(() => {
    if (!onDraft) {
      const off = setTimeout(() => setTaken(null), 0);
      return () => clearTimeout(off);
    }
    const t = setTimeout(() => setView(readDraft()), 0);
    return () => clearTimeout(t);
  }, [onDraft]);

  const pick = useCallback((id: string) => {
    if (taken) return;
    setTaken(id);
    withEngine((e) => e.audio?.play?.('levelup'));
    // the confirm flash plays, then the engine takes the run back
    setTimeout(() => chooseUpgrade(id), 260);
  }, [taken]);

  /* --- focus: this is a BLOCKING modal, so it has to behave like one -----
   *
   * Measured before this existed, with the draft open: aria-modal was absent,
   * document.activeElement was <body> (focus never entered), and Tab from the
   * last card escaped straight to the "Connect Wallet" button BEHIND the veil.
   * A keyboard player tabbing through a run-halting dialog landed on the page
   * underneath it, and a screen reader was never told a dialog had opened.
   *
   * The 1/2/3 shortcut below already made this playable without a mouse, but
   * only for someone who knew the shortcut existed. Moving focus in makes the
   * cards reachable and announces the dialog; trapping Tab keeps them there
   * until a pick is made, which is the same contract the run itself has.
   */
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!onDraft || !view) return;
    const cards = (): HTMLElement[] => {
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      return nodes ? Array.from(nodes) : [];
    };
    // a tick, so the cards exist and the entry animation has them laid out
    const enter = setTimeout(() => cards()[0]?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = cards();
      if (items.length === 0) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      // also catches focus that is somehow already outside the panel
      const outside = !panelRef.current?.contains(document.activeElement);
      if (outside || document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(enter);
      window.removeEventListener('keydown', onKey);
    };
    // `view` is in the deps so a bonus second pick re-arms the trap
  }, [onDraft, view]);

  /* --- 1/2/3 pick the cards; the draft is playable without a mouse ------ */
  useEffect(() => {
    if (!onDraft || !view) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= view.cards.length) {
        pick(view.cards[n - 1].id);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDraft, view, pick]);

  if (!onDraft || !view) return null;

  return (
    <div
      data-game-ui=""
      ref={panelRef}
      className="rs-draft"
      role="dialog"
      aria-modal="true"
      aria-label="Choose an upgrade"
    >
      <div className="rs-draft-veil" aria-hidden />

      <div className="rs-draft-inner">
        <header className="rs-draft-head">
          <span className="rs-draft-level">
            <span className="rs-draft-level-cap">Level</span>
            <span className="rs-num rs-draft-level-num">{view.level}</span>
          </span>
          <h2 className="rs-draft-title">Field refit</h2>
          {/* the one thing the old cards never said */}
          <p className="rs-draft-note">
            This raid only — refits are lost when the run ends
          </p>
          {view.bonusQueued && (
            <p className="rs-draft-bonus">Boss down · a second pick follows this one</p>
          )}
        </header>

        <div className="rs-draft-cards">
          {view.cards.map((card, i) => (
            <Card
              key={card.id}
              card={card}
              index={i}
              taken={taken}
              onPick={() => pick(card.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({
  card,
  index,
  taken,
  onPick,
}: {
  card: DraftCard;
  index: number;
  taken: string | null;
  onPick: () => void;
}) {
  const tone = LANE_TONE[card.lane] || 'var(--rs-text-dim)';
  const isTaken = taken === card.id;
  const dimmed = !!taken && !isTaken;
  return (
    <button
      type="button"
      className="rs-draft-card"
      data-taken={isTaken ? '1' : '0'}
      data-dimmed={dimmed ? '1' : '0'}
      style={{ '--lane': tone, '--i': String(index) } as React.CSSProperties}
      onClick={onPick}
      disabled={!!taken}
    >
      <span className="rs-draft-card-top">
        <span className="rs-draft-lane">{LANE_LABEL[card.lane] || card.lane}</span>
        {card.isNew ? (
          <span className="rs-draft-new">New</span>
        ) : (
          <span className="rs-draft-stack rs-num">{card.owned}/{card.max}</span>
        )}
      </span>

      <span className="rs-draft-name">{card.title}</span>

      {/* the actual arithmetic from recomputeUpgrades(), not "better" */}
      <span className="rs-draft-step">{card.step || card.desc}</span>
      {card.step && card.gloss && <span className="rs-draft-desc">{card.desc}</span>}

      {/* the stack ladder: how much room this pick still has to grow */}
      <span className="rs-draft-pips" aria-hidden>
        {Array.from({ length: card.max }, (_, p) => (
          <i key={p} data-on={p < card.owned ? '1' : p === card.owned ? 'next' : '0'} />
        ))}
      </span>

      <span className="rs-draft-key" aria-hidden>{index + 1}</span>
    </button>
  );
}

/** Exposed so the engine-facing bits can tell whether this overlay is live. */
export function isDraftOverlayActive(): boolean {
  return !!engine() && (window as unknown as Record<string, unknown>).__htmlUpgrade === 1;
}
