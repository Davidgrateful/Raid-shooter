import type * as THREE_NS from 'three';
import { createArena, type ArenaController, type ArenaQuality } from './arenaScene';

/*==============================================================================
Mounting the 3D arena into the engine's DOM

Shared by the app (Arena3D.tsx) and the design preview, so both run the same
code. Inserts a canvas between the backdrop canvases and #cmg, registers
$.arena3d with the engine, and keeps it in step with the game state:

  play                     active: the engine skips its 2D models and asks
                           for a 3D frame each frame
  pause / upgrade /        shown, frozen - the engine draws its overlays over
  continueoffer / gameover the last frame and so does this layer
  anything else            hidden (menus, hangar, board...)

Quality steps down by itself: a device that takes too long per 3D frame drops
to the low tier (no shadows, lower resolution), and one that is still too slow
there hands the fight back to the 2D art and says so through onSlow.
==============================================================================*/

type Three = typeof THREE_NS;

const SHOWN = new Set(['play', 'pause', 'upgrade', 'continueoffer', 'gameover']);

export interface ArenaMount {
  controller: ArenaController;
  setEnabled(on: boolean): void;
  enabled(): boolean;
  dispose(): void;
}

export function mountArena(T: Three, opts: { quality: ArenaQuality; onSlow?: () => void }): ArenaMount | null {
  const inner = document.getElementById('wrap-inner');
  const cmg = document.getElementById('cmg');
  if (!inner || !cmg) return null;
  const canvas = document.createElement('canvas');
  canvas.id = 'c3d';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  inner.insertBefore(canvas, cmg);
  const controller = createArena(T, canvas, { quality: opts.quality });
  const $ = (window as unknown as { $: Record<string, any> }).$;

  let on = true;
  let state = String($.state || '');
  let frames = 0;
  let slowFrames = 0;
  const hook = {
    active: false,
    setGhost: (g: Parameters<ArenaController['setGhost']>[0]) => controller.setGhost(g),
    frame() {
      controller.frame();
      // step quality down on a device that cannot keep up (measured on the
      // 3D layer's own cost, not the whole frame)
      if (++frames % 90 === 0) {
        const s = controller.stats();
        if (s.quality === 'high' && s.ms > 7) controller.setQuality('low');
        else if (s.quality === 'low' && s.ms > 12) {
          if (++slowFrames >= 3) { setEnabled(false); opts.onSlow?.(); }
        } else slowFrames = 0;
      }
    },
  };
  $.arena3d = hook;

  function sync() {
    hook.active = on && state === 'play';
    canvas.style.visibility = on && SHOWN.has(state) ? 'visible' : 'hidden';
  }
  function setEnabled(v: boolean) { on = v; sync(); }
  const onState = (e: Event) => { state = String((e as CustomEvent).detail || ''); sync(); };
  window.addEventListener('raidshooter:state', onState as EventListener);
  sync();

  return {
    controller,
    setEnabled,
    enabled: () => on,
    dispose() {
      window.removeEventListener('raidshooter:state', onState as EventListener);
      if ($.arena3d === hook) $.arena3d = null;
      controller.dispose();
      canvas.remove();
    },
  };
}
