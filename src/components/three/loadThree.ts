/*==============================================================================
Loading three.js without touching a seeded raid's dice

Evaluating three.js (and modules built on it) calls Math.random: every
object it constructs at module load gets a UUID from it. During a Daily Run
or a duel, Math.random IS the raid's seeded generator (public/game/
dailyrun.js), so a module that evaluated mid-raid would shift that pilot's
waves. Every 3D import goes through here, which guarantees the two never
overlap:

  - a load asked for while a seeded stream is live waits until it ends
  - a seeded raid asked for while a load is in flight waits until it lands
    ($.threeBusy() / $.whenThreeIdle(), read by startDailyRun/startDuelRun)

Work done with three AFTER it has loaded (building scenes) is fenced by the
caller with $.__realRandom, as ArenaObjects3D does.
==============================================================================*/

type Engine = { __realRandom?: () => number; threeBusy?: () => boolean; whenThreeIdle?: (fn: () => void) => void };

const pending = new Set<Promise<unknown>>();
const waiting: Array<() => void> = [];

function eng(): Engine | null {
  return typeof window === 'undefined' ? null : ((window as unknown as { $?: Engine }).$ || null);
}

/** a seeded stream is live: Math.random has been swapped for the raid's */
export function seededRaidLive(): boolean {
  const $ = eng();
  return !!$ && !!$.__realRandom && Math.random !== $.__realRandom;
}

function install() {
  const $ = eng();
  if (!$ || $.threeBusy) return;
  $.threeBusy = () => pending.size > 0;
  $.whenThreeIdle = (fn) => { if (!pending.size) fn(); else waiting.push(fn); };
}

export function loadThree<M>(extra: () => Promise<M>): Promise<[typeof import('three'), M]> {
  install();
  const go = (): Promise<[typeof import('three'), M]> => {
    const p = Promise.all([import('three'), extra()]) as Promise<[typeof import('three'), M]>;
    pending.add(p);
    const settle = () => {
      pending.delete(p);
      if (!pending.size) waiting.splice(0).forEach((fn) => { try { fn(); } catch { /* a deferred start that throws is the caller's */ } });
    };
    p.then(settle, settle);
    return p;
  };
  if (!seededRaidLive()) return go();
  return new Promise((resolve, reject) => {
    const retry = () => { if (seededRaidLive()) setTimeout(retry, 500); else go().then(resolve, reject); };
    setTimeout(retry, 500);
  });
}
