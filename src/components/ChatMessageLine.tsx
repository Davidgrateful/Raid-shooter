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

// Renders "@Name" tokens in a message as a highlighted mention when they
// case-insensitively match a currently-eligible top-20 player's call sign -
// no exact-match requirement (call signs are free text), so "@voidking"
// still highlights against "VOIDKING". Unmatched "@word" tokens render as
// plain text - never flagged as broken, since call signs can change.
function renderTextWithMentions(text: string, knownNames: Set<string>) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && knownNames.has(part.slice(1).toUpperCase())) {
      return (
        <span key={i} className="font-bold text-amber-300">
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function ChatMessageLine({
  message,
  knownNames,
  iconSize = 18,
  onNameClick,
}: {
  message: ChatMessageData;
  knownNames: Set<string>;
  iconSize?: number;
  onNameClick?: (name: string) => void;
}) {
  return (
    <div className="flex items-start gap-1.5 text-sm leading-snug">
      <span className="mt-0.5 shrink-0">
        <PilotIcon cosmetics={message.cosmetics} size={iconSize} />
      </span>
      <span className="min-w-0">
        <button
          type="button"
          onClick={() => onNameClick?.(message.name)}
          disabled={!onNameClick}
          className={`font-bold text-cyan-300 ${onNameClick ? 'hover:underline' : ''}`}
        >
          {message.name}
        </button>
        {message.verified && <span className="ml-1 text-cyan-300">✓</span>}
        <span className="text-white/70">: {renderTextWithMentions(message.text, knownNames)}</span>
      </span>
    </div>
  );
}
