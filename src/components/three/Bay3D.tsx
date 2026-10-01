'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ShipDef } from '@/components/command/engine';
import type { BayController, BayMode } from './bayScene';
import { whenIdle } from '@/lib/idle';

/*==============================================================================
Bay3D - the 3D bay, with the flat bay as its floor

three.js is ~150 KB gzipped, so it is only fetched when a screen with a bay
actually mounts, never at boot. Until it is ready - and for good if it cannot
start - the existing 2D viewport (`fallback`) is what shows, so a bay is never
blank and a phone without WebGL plays exactly as before.

3D is skipped up front when:
  - the player switched it off (System -> 3D graphics, storage 'gfx3d' = 0)
  - the browser has no WebGL at all (checked before downloading anything)
==============================================================================*/

export interface Bay3DProps {
  mode: BayMode;
  ship: ShipDef | null;
  color: string;
  accentHue?: number;
  trailHue: number | null;
  drone?: ShipDef | null;
  unlocked?: boolean;
  swapKey?: number;
  swapDir?: number;
  compact?: boolean;
  subject?: 'hull' | 'object';
  /** the 2D version: shown while 3D loads, and instead of it if 3D can't run */
  fallback: ReactNode;
  label?: string;
  /** dampen the scene while a modal owns the screen (the deck) */
  dim?: boolean;
}

function engineStorage(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const $ = (window as unknown as { $?: { storage?: Record<string, unknown> } }).$;
  return $?.storage || null;
}

/** true when this player and this browser should get the 3D bays */
export function want3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (engineStorage()?.gfx3d === 0) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Bay3D(props: Bay3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctlRef = useRef<BayController | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'off'>('loading');
  // bumped every time a scene is (re)built, so the new one gets the subject
  const [gen, setGen] = useState(0);
  const { mode, compact = false } = props;

  // build the scene once per mode; the subject is pushed in below
  useEffect(() => {
    if (!want3D()) { setState('off'); return; }
    let cancelled = false;
    const start = () => {
      Promise.all([import('three'), import('./bayScene')])
        .then(([T, mod]) => {
          if (cancelled || !canvasRef.current) return;
          try {
            ctlRef.current = mod.createBayScene(T, canvasRef.current, mode, compact);
            setState('ready');
            setGen((g) => g + 1);
          } catch {
            setState('off');
          }
        })
        .catch(() => { if (!cancelled) setState('off'); });
    };
    // The deck is the first screen after boot, so its scene must never cost
    // the boot anything: wait until the engine is past its splash, THEN for
    // an idle moment. (Idle alone was not enough - requestIdleCallback's
    // timeout fired mid-boot on a 4x-throttled CPU, and building the scene
    // there, shader compiles and all, cost a slow phone ~0.5-1s of splash.)
    let cancelIdle = () => {};
    let poll = 0;
    if (mode === 'deck') {
      const booted = () => {
        const st = (window as unknown as { $?: { state?: string } }).$?.state;
        return !!st && st !== 'loading';
      };
      const arm = () => { cancelIdle = whenIdle(start); };
      if (booted()) arm();
      else poll = window.setInterval(() => { if (booted()) { window.clearInterval(poll); poll = 0; arm(); } }, 250);
    } else {
      start();
    }
    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
      cancelIdle();
      ctlRef.current?.dispose();
      ctlRef.current = null;
    };
  }, [mode, compact]);

  const lastSwap = useRef(props.swapKey ?? 0);
  useEffect(() => {
    const ctl = ctlRef.current;
    if (!ctl || state !== 'ready') return;
    const swapped = (props.swapKey ?? 0) !== lastSwap.current;
    lastSwap.current = props.swapKey ?? 0;
    ctl.setSubject({
      ship: props.ship,
      color: props.color,
      accentHue: props.accentHue ?? 190,
      trailHue: props.trailHue,
      drone: props.drone ?? null,
      unlocked: props.unlocked ?? true,
      kind: props.subject ?? 'hull',
    }, swapped ? props.swapDir || 1 : 0);
  }, [state, gen, props.ship, props.color, props.accentHue, props.trailHue, props.drone, props.unlocked, props.swapKey, props.swapDir, props.subject]);

  return (
    <div className="relative h-full w-full" data-bay3d={state} style={props.dim ? { opacity: 0.4, transition: 'opacity 200ms' } : undefined}>
      {state !== 'ready' && <div className="absolute inset-0">{props.fallback}</div>}
      {state !== 'off' && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ opacity: state === 'ready' ? 1 : 0, transition: 'opacity 280ms ease' }}
          aria-label={props.label}
          aria-hidden={props.label ? undefined : true}
        />
      )}
    </div>
  );
}
