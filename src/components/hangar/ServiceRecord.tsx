'use client';

import { useEffect, useState } from 'react';
import { SystemSection } from './systems';

/*==============================================================================
SERVICE RECORD - the achievements, on the pilot screen

Goals beyond score, counted by the engine from things a run already does
(public/game/achievements.js) and kept on this device. Cosmetic: nothing here
touches score, rank or a payout. An unlock shows a banner mid-run; this is
where the full list and the progress toward each one live.
==============================================================================*/

interface Progress { id: string; title: string; desc: string; have: number; goal: number; done: number }

function read(): Progress[] {
  const $ = (window as unknown as { $?: { achievementProgress?: () => Progress[] } }).$;
  try { return $?.achievementProgress?.() || []; } catch { return []; }
}

function when(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ServiceRecord() {
  const [list, setList] = useState<Progress[]>([]);
  useEffect(() => {
    const update = () => setList(read());
    update();
    window.addEventListener('raidshooter:achievement', update);
    window.addEventListener('raidshooter:state', update);
    return () => {
      window.removeEventListener('raidshooter:achievement', update);
      window.removeEventListener('raidshooter:state', update);
    };
  }, []);
  if (!list.length) return null;
  const done = list.filter((a) => a.done).length;
  // unlocked first (newest on top), then the closest to unlocking
  const sorted = [...list].sort((a, b) =>
    (b.done ? 1 : 0) - (a.done ? 1 : 0) || b.done - a.done || b.have / b.goal - a.have / a.goal);

  return (
    <SystemSection label="Service record" tone="var(--rs-gold)" note={`${done} of ${list.length}`}>
      <ul className="rs-ach" aria-label="Achievements">
        {sorted.map((a) => (
          <li key={a.id} className="rs-ach-row" data-done={a.done ? '1' : '0'}>
            <span className="rs-ach-badge" aria-hidden>{a.done ? '✓' : a.title.charAt(0)}</span>
            <span className="rs-ach-body">
              <span className="rs-ach-title">{a.title}</span>
              <span className="rs-ach-desc">{a.desc}</span>
              {a.done ? (
                <span className="rs-ach-when">Unlocked {when(a.done)}</span>
              ) : (
                <span className="rs-ach-bar" role="progressbar" aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={a.have} aria-label={`${a.title} progress`}>
                  <span style={{ width: `${Math.round((a.have / a.goal) * 100)}%` }} />
                </span>
              )}
            </span>
            {!a.done && <span className="rs-ach-count rs-num">{a.have}/{a.goal}</span>}
          </li>
        ))}
      </ul>
      <p className="rs-sys-foot">Counted on this device as you fly. Cosmetic only: no score, rank or prize changes.</p>
    </SystemSection>
  );
}
