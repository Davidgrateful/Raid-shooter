'use client';

import { useEffect } from 'react';
import { want3D } from './Bay3D';
import { whenIdle } from '@/lib/idle';
import { loadThree } from './loadThree';

/*==============================================================================
The arena's objects from real 3D models (objectSprites.ts)

Renders nothing itself. Once the game has booted and the browser is idle, it
fetches three.js, renders every object kind into a sprite sheet one kind per
idle moment, and hands the engine a drawer ($.objectSprites). Until a kind is
ready - and for good when 3D is switched off or WebGL is missing - the engine
draws that kind's 2D shape as before, so nothing ever waits on this.

Math.random: during a Daily Run or a duel it IS the raid's dice. three.js is
loaded through loadThree.ts (never overlapping a seeded raid), and the bake
itself is fenced, because three stamps every object it makes with a UUID.
==============================================================================*/

interface Engine {
  state?: string;
  dpr?: number;
  __realRandom?: () => number;
  objectSprites?: { draw: (ctx: CanvasRenderingContext2D, o: { kind: string; id: number; rotation: number; radius: number }) => boolean; kinds: string[] } | null;
}

const eng = () => (window as unknown as { $?: Engine }).$;

type Deadline = { timeRemaining(): number; didTimeout?: boolean };
// the browser's idle time, with what is left of it; a timer where there is none
function idle(fn: (d?: Deadline) => void) {
  const w = window as Window & { requestIdleCallback?: (cb: (d: Deadline) => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(() => fn(), 50);
}

export function ArenaObjects3D() {
  useEffect(() => {
    let cancelled = false, started = false;
    const cancels: Array<() => void> = [];

    const start = () => {
      const $ = eng();
      if (started || cancelled || !$ || !$.state || $.state === 'loading' || !want3D()) return;
      started = true;
      // a few seconds after the splash, so the one-off setup (shader
      // compiles, the studio environment) never lands on the first frames of
      // the menu
      const t = window.setTimeout(() => cancels.push(whenIdle(bakeAll)), 3000);
      cancels.push(() => window.clearTimeout(t));
    };
    const bakeAll = async () => {
      const $ = eng();
      if (!$ || cancelled) return;
      {
        try {
          const [T, mod] = await loadThree(() => import('./objectSprites'));
          if (cancelled) return;
          const fenced = <R,>(fn: () => R): R => {
            const real = Math.random;
            if ($.__realRandom) Math.random = $.__realRandom;
            try { return fn(); } finally { Math.random = real; }
          };
          // three stamps every object it makes (renderer, materials...) with a UUID
          const baker = fenced(() => mod.createObjectBaker(T, Math.max(1, Math.min(2, $.dpr || window.devicePixelRatio || 1))));
          const sheets: Record<string, import('./objectSprites').SpriteSheet> = {};
          const draw = mod.spriteDrawer(sheets);
          $.objectSprites = { draw, kinds: [] };
          const queue = [...baker.kinds];
          let job: ReturnType<typeof baker.begin> = null;
          let kind = '';
          // one cell at a time, only while the browser is idle and never past
          // the time it offered: a bake must never cost the game a frame
          const work = (deadline?: Deadline) => {
            if (cancelled) { baker.dispose(); return; }
            // a busy page that never goes idle still gets a sliver each slot
            const budget = !deadline || deadline.didTimeout ? 6 : Math.min(12, deadline.timeRemaining());
            const until = performance.now() + budget;
            const done = fenced(() => {
              do {
                if (!job) {
                  kind = queue.shift() || '';
                  if (!kind) { baker.dispose(); return true; }
                  job = baker.begin(kind);
                  if (!job) continue;
                }
                if (job.next()) {
                  sheets[kind] = job.sheet;
                  $.objectSprites!.kinds.push(kind);
                  job = null;
                }
              } while (performance.now() < until);
              return false;
            });
            if (!done) idle(work);
          };
          idle(work);
        } catch (e) {
          console.warn('[objects3d] staying 2D:', e);
        }
      }
    };

    start();
    // the engine may still be booting; and 3D may be switched on later
    const onState = () => start();
    window.addEventListener('raidshooter:state', onState);
    return () => {
      cancelled = true;
      window.removeEventListener('raidshooter:state', onState);
      cancels.forEach((c) => c());
    };
  }, []);
  return null;
}
