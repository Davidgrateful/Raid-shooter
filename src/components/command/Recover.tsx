'use client';

/*==============================================================================
RECOVERY

One state for every recoverable data failure in the game. Before this, a failed
request either said nothing (the profile swallowed its own error) or told the
player to go somewhere else to fix it ("retry from the command deck"), which
made a temporary network blip feel like a wall.

It is deliberately NOT a new component style. It reuses the wait state's own
layout and bar so a failure reads as the same kind of thing as a load - the
screen is still the screen, one line has changed - and RETRY is an ordinary
cyan action, because cyan is what interaction looks like here. Gold stays
reserved for money, acquisition and reward; a retry earns the player nothing.

The error line states what failed. The button states what to do about it. No
raw status codes, no stack traces, and never louder than the content behind it.
==============================================================================*/

interface Props {
  /** What failed, in the game's voice. Short - one line. */
  message: string;
  /** True while the retry is in flight; the button says so and stops taking taps. */
  busy?: boolean;
  onRetry: () => void;
  /** `wall` fills a rack/list area, `line` sits inline in a panel footer. */
  tone?: 'wall' | 'line';
}

export function Recover({ message, busy = false, onRetry, tone = 'wall' }: Props) {
  return (
    <div className="rs-recover" data-tone={tone} role="status">
      <span className="rs-recover-msg">
        {busy && <span className="rs-am-wait-bar" aria-hidden />}
        {busy ? 'Retrying…' : message}
      </span>
      <button
        type="button"
        className="rs-recover-btn"
        onClick={onRetry}
        disabled={busy}
        aria-label={busy ? 'Retrying' : 'Retry'}
      >
        RETRY
      </button>
    </div>
  );
}
