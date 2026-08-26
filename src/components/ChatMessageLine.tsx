'use client';

import { Fragment } from 'react';
import { PilotIcon, type Cosmetics } from '@/components/PilotIcon';

export interface ChatMessageData {
  id: string;
  key: string;
  name: string;
  text: string;
  verified: boolean;
  at: number;
  cosmetics?: Cosmetics;
}

/*==============================================================================
A COMMS ROW

This was one run-on line - "icon NAME✓: text", all of it the same cyan. It now
has a hierarchy: WHO (cyan, bold), WHEN (mono, faint, right-aligned), and WHAT
(plain readable text). The timestamp is not new data - `at` was always in the
payload, it was simply never shown.

System traffic is a different kind of thing from a player talking, so it gets a
different shape entirely rather than a different colour of the same shape.
==============================================================================*/

/**
 * Highlight "@Name" when it matches a currently-eligible pilot. Unmatched
 * tokens stay plain - call signs are free text and change, so a miss must
 * never render as broken.
 */
function renderTextWithMentions(text: string, knownNames: Set<string>) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') && knownNames.has(part.slice(1).toUpperCase()) ? (
      <span key={i} className="rs-cm-mention">{part}</span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** 24-hour, zero-padded, so a column of times lines up in the mono face. */
function clock(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The server posts its own messages under the reserved key `system` (the only
 * non-player author that exists). A record callout is recognised from the text
 * the server already sends - nothing here invents an event type.
 */
function systemKind(message: ChatMessageData): 'system' | 'record' | null {
  if (message.key !== 'system') return null;
  return /personal best|record|rank #/i.test(message.text) ? 'record' : 'system';
}

export function ChatMessageLine({
  message,
  knownNames,
  iconSize = 18,
  onNameClick,
  self = false,
}: {
  message: ChatMessageData;
  knownNames: Set<string>;
  iconSize?: number;
  onNameClick?: (name: string) => void;
  /** The signed-in player's own transmission, marked so they can find it. */
  self?: boolean;
}) {
  const kind = systemKind(message);

  if (kind) {
    return (
      <div className="rs-cm-sys" data-kind={kind}>
        <span className="rs-cm-sys-mark" aria-hidden>{kind === 'record' ? '▲' : '//'}</span>
        <span className="rs-cm-sys-body">
          <span className="rs-cm-sys-who">{message.name}</span>
          <p className="rs-cm-sys-text">{message.text}</p>
        </span>
        <time className="rs-cm-time" dateTime={new Date(message.at || Date.now()).toISOString()}>
          {clock(message.at)}
        </time>
      </div>
    );
  }

  return (
    <div className="rs-cm-msg" data-self={self ? 'true' : 'false'}>
      <span className="rs-cm-avatar">
        <PilotIcon cosmetics={message.cosmetics} size={iconSize} />
      </span>

      <span className="rs-cm-meta">
        <button
          type="button"
          onClick={() => onNameClick?.(message.name)}
          disabled={!onNameClick}
          className="rs-cm-name"
          title={onNameClick ? `Tag ${message.name}` : message.name}
        >
          {message.name}
        </button>
        {message.verified && (
          <span className="rs-cm-verified" title="Wallet verified" aria-label="verified">✓</span>
        )}
        <time className="rs-cm-time" dateTime={new Date(message.at || Date.now()).toISOString()}>
          {clock(message.at)}
        </time>
      </span>

      <p className="rs-cm-text">{renderTextWithMentions(message.text, knownNames)}</p>
    </div>
  );
}
