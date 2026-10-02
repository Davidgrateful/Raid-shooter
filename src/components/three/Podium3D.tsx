'use client';

import { useEffect, useRef, useState } from 'react';
import { want3D } from './Bay3D';
import type { PodiumController, PodiumPilot } from './podiumScene';
import { loadThree } from './loadThree';

/*==============================================================================
Podium3D - the board's top three standing in their own planes

Sits above the podium cards, which keep the names and scores as real text.
Loads three.js only on this page and only once the board has three entries;
with no WebGL it renders nothing and the cards stand alone, as before.
==============================================================================*/

// the board stores the pilot's display title; older entries have no pilotId
const ID_BY_TITLE: Record<string, string> = {
  ONYIX: 'onyix', NOVA: 'nova', 'TANK REX': 'tankrex', 'ASTRA VANE': 'astravane', 'IRON HALO': 'ironhalo',
  'RUNE PILOT': 'runepilot', 'NEBULA FOX': 'nebulafox', 'JAVELIN 9': 'javelin9', 'ATLAS BEAM': 'atlasbeam',
  'GLITCH PRINCE': 'glitchprince', SOLSTICE: 'solstice', 'CRIMSON WISP': 'crimsonwisp', RIDER: 'voltrider',
};

export interface PodiumEntry { pilot: string; cosmetics?: { pilotId?: string; shipColor?: string } }

export function podiumPilots(top: PodiumEntry[]): PodiumPilot[] {
  return top.slice(0, 3).map((e) => ({
    pilotId: e.cosmetics?.pilotId || ID_BY_TITLE[(e.pilot || '').toUpperCase()] || 'onyix',
    color: e.cosmetics?.shipColor || '#ffffff',
  }));
}

export function Podium3D({ top }: { top: PodiumEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctlRef = useRef<PodiumController | null>(null);
  const [ready, setReady] = useState(false);
  const [off, setOff] = useState(false);
  const pilots = podiumPilots(top);
  const key = pilots.map((p) => `${p.pilotId}:${p.color}`).join('|');

  useEffect(() => {
    if (!want3D()) { setOff(true); return; }
    let cancelled = false;
    loadThree(() => import('./podiumScene'))
      .then(([T, mod]) => {
        if (cancelled || !canvasRef.current) return;
        try {
          ctlRef.current = mod.createPodiumScene(T, canvasRef.current);
          setReady(true);
        } catch { setOff(true); }
      })
      .catch(() => { if (!cancelled) setOff(true); });
    return () => { cancelled = true; ctlRef.current?.dispose(); ctlRef.current = null; };
  }, []);

  useEffect(() => {
    if (ready) ctlRef.current?.setPilots(pilots);
    // the key covers every field pilots is built from
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  if (off) return null;
  return (
    <div className="relative mx-auto h-[220px] w-full max-w-3xl sm:h-[280px]" aria-hidden>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 400ms ease' }}
      />
    </div>
  );
}
