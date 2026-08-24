'use client';

import { useEffect, useRef } from 'react';
import type { ShipDef } from './engine';

/*==============================================================================
Ship viewport — the hangar bay

The centrepiece of the command centre. This is deliberately NOT an image: it
runs the pilot's real `draw()` function from the engine's character
definitions, in the player's own equipped hull colour, with their trail hue and
their drone in orbit. What sits here is what launches when they hit DEPLOY —
that is the whole point of "this is MY ship".

V2 moves it from "a ship on a starfield" to "a ship parked in a bay". The
difference is entirely environmental, and it is what stops the hull reading as
a sticker:

  PEDESTAL   an elliptical pool of light the hull is standing in, with a
             compressed reflection of the hull in it
  DEPTH      three separated planes — dust behind, hull, dust in front — so
             the bay has a front and a back rather than being a flat disc
  RINGS      instrumentation that is clearly measuring the hull: slow opposed
             arcs, a dashed inner track, cardinal ticks
  SCAN       one sweep every few seconds, never a strobe

Everything idles. Nothing performs.
==============================================================================*/

interface Props {
  ship: ShipDef | null;
  color: string;
  trailHue: number | null;
  drone?: ShipDef | null;
  /** Dampens the whole scene while a modal owns the screen. */
  dim?: boolean;
}

interface Mote {
  x: number;
  y: number;
  z: number;
  vy: number;
  front: boolean;
}

export function ShipViewport({ ship, color, trailHue, drone, dim = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  // The animation loop reads the current props through this ref rather than
  // closing over them, so equipping a different hull or colour swaps what is
  // drawn on the very next frame without tearing down and restarting the loop.
  const propsRef = useRef({ ship, color, trailHue, drone, dim });
  useEffect(() => {
    propsRef.current = { ship, color, trailHue, drone, dim };
  }, [ship, color, trailHue, drone, dim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const motes: Mote[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes.length = 0;
      const count = Math.round((width * height) / 4200);
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: 0.3 + Math.random() * 0.7,
          vy: 0.1 + Math.random() * 0.35,
          // a quarter of the dust drifts in FRONT of the hull, which is what
          // separates the bay into planes instead of one flat disc
          front: Math.random() < 0.26,
        });
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /*--- dust, split by plane so the hull can be drawn between them --------*/
    const drawMotes = (front: boolean, alpha: number) => {
      for (const m of motes) {
        if (m.front !== front) continue;
        m.y -= m.vy * m.z;
        if (m.y < -2) {
          m.y = height + 2;
          m.x = Math.random() * width;
        }
        const size = front ? m.z * 2.4 : m.z * 1.5;
        ctx.fillStyle = `rgba(160, 215, 245, ${(front ? 0.09 + m.z * 0.16 : 0.04 + m.z * 0.1) * alpha})`;
        ctx.fillRect(m.x, m.y, size, size);
      }
    };

    let tick = 0;
    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const { ship: def, color: hull, trailHue: hue, drone: wing, dim: damped } = propsRef.current;
      tick += 1;
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;

      const cx = width / 2;
      const scale = Math.min(width, height);
      // the hull sits slightly above centre so the pedestal has room to read
      const cy = height * 0.455;
      const padY = cy + scale * 0.3;
      const alpha = damped ? 0.35 : 1;
      ctx.globalAlpha = alpha;

      /* --- back plane: the bay's own light and the dust behind the hull --- */
      const back = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.56);
      back.addColorStop(0, 'rgba(40, 120, 160, 0.13)');
      back.addColorStop(0.55, 'rgba(30, 90, 130, 0.04)');
      back.addColorStop(1, 'rgba(20, 60, 100, 0)');
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, width, height);
      drawMotes(false, alpha);

      /* --- pedestal: the pool of light the hull is standing in ------------ */
      // an ellipse, not a circle - it reads as ground seen at an angle, which
      // is what gives the bay a floor
      const padRx = scale * 0.33;
      const padRy = scale * 0.075;
      const pad = ctx.createRadialGradient(cx, padY, 0, cx, padY, padRx);
      pad.addColorStop(0, `${rgba(hull, 0.3)}`);
      pad.addColorStop(0.4, `${rgba(hull, 0.09)}`);
      pad.addColorStop(1, `${rgba(hull, 0)}`);
      ctx.save();
      ctx.translate(cx, padY);
      ctx.scale(1, padRy / padRx);
      ctx.translate(-cx, -padY);
      ctx.fillStyle = pad;
      ctx.beginPath();
      ctx.arc(cx, padY, padRx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // the pad's rim: a thin lit ellipse, brighter at the front edge
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, padY, padRx * 0.82, padRy * 0.82, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(hull, 0.24);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, padY, padRx * 0.82, padRy * 0.82, 0, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = rgba(hull, 0.5);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      /* --- targeting rings: slow, opposed, unmistakably instrumentation --- */
      const ringR = scale * 0.31;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineWidth = 1;

      ctx.strokeStyle = 'rgba(53, 232, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // outer arc segments, rotating one way
      ctx.strokeStyle = 'rgba(53, 232, 255, 0.45)';
      ctx.lineWidth = 1.5;
      const spin = tick / 240;
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, a, a + 0.4);
        ctx.stroke();
      }

      // inner dashed ring, counter-rotating
      ctx.strokeStyle = 'rgba(233, 241, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 0.72, -spin * 1.6, -spin * 1.6 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // four bracket ticks at the diagonals - reads as a locked target
      ctx.strokeStyle = 'rgba(53, 232, 255, 0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * ringR * 1.05, Math.sin(a) * ringR * 1.05);
        ctx.lineTo(Math.cos(a) * ringR * 1.15, Math.sin(a) * ringR * 1.15);
        ctx.stroke();
      }
      ctx.restore();

      /* --- scan sweep: one pass every few seconds, never a strobe -------- */
      const sweepCycle = (tick % 340) / 340;
      if (sweepCycle < 0.5) {
        const sy = cy - scale * 0.42 + sweepCycle * 2 * scale * 0.84;
        const fade = Math.sin(sweepCycle * 2 * Math.PI) * 0.5;
        const grad = ctx.createLinearGradient(0, sy - 26, 0, sy + 2);
        grad.addColorStop(0, 'rgba(53, 232, 255, 0)');
        grad.addColorStop(1, `rgba(53, 232, 255, ${Math.max(0, fade) * 0.15})`);
        ctx.fillStyle = grad;
        ctx.fillRect(cx - scale * 0.4, sy - 26, scale * 0.8, 28);
      }

      if (!def || typeof def.draw !== 'function') {
        ctx.globalAlpha = 1;
        return;
      }

      /* --- the hull ------------------------------------------------------ */
      // a gentle bob + roll so it reads as holding station, not frozen
      const bob = Math.sin(tick / 70) * scale * 0.013;
      const roll = Math.sin(tick / 130) * 0.05;
      const shipR = scale * 0.115;
      const hullY = cy + bob;

      // Reflection in the pad: the same hull, flipped, squashed and clipped to
      // the floor. The clip is the important part — without it the mirrored
      // hull rises back through the pad and reads as a second, upside-down
      // ship rather than as a reflection.
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - padRx, padY - padRy * 0.35, padRx * 2, scale * 0.3);
      ctx.clip();
      ctx.globalAlpha = alpha * 0.1;
      ctx.translate(cx, padY + padRy * 0.15);
      ctx.scale(1, -0.24);
      ctx.rotate(roll);
      ctx.rotate(-Math.PI / 2);
      def.draw(ctx, shipR, hull, tick);
      ctx.restore();

      ctx.save();
      ctx.translate(cx, hullY);

      // engine wash below the hull, tinted by the equipped trail
      const trailColor = hue !== null ? `hsla(${hue}, 95%, 62%,` : 'rgba(53, 232, 255,';
      const thrust = 0.55 + Math.sin(tick / 9) * 0.12;
      const plumeEnd = shipR * 2.25;
      const plume = ctx.createLinearGradient(0, shipR * 0.6, 0, plumeEnd);
      plume.addColorStop(0, `${trailColor} ${0.42 * thrust})`);
      plume.addColorStop(0.6, `${trailColor} ${0.12 * thrust})`);
      plume.addColorStop(1, `${trailColor} 0)`);
      ctx.fillStyle = plume;
      ctx.beginPath();
      ctx.moveTo(-shipR * 0.5, shipR * 0.6);
      ctx.lineTo(shipR * 0.5, shipR * 0.6);
      ctx.lineTo(shipR * 0.14, plumeEnd);
      ctx.lineTo(-shipR * 0.14, plumeEnd);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(roll);
      // the engine draws hulls facing +x; the viewport shows them nose-up
      ctx.rotate(-Math.PI / 2);
      ctx.shadowColor = hull;
      ctx.shadowBlur = 26;
      def.draw(ctx, shipR, hull, tick);
      ctx.shadowBlur = 0;
      ctx.restore();

      /* --- escort drone, if one is equipped ------------------------------ */
      if (wing && typeof wing.draw === 'function') {
        const orbit = tick / 90;
        const ox = cx + Math.cos(orbit) * ringR * 0.62;
        const oy = cy + Math.sin(orbit) * ringR * 0.3 + bob;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.globalAlpha = alpha * 0.9;
        wing.draw(ctx, scale * 0.032, 'hsl(190, 100%, 70%)', tick);
        ctx.restore();
      }

      /* --- front plane: dust passing between the hull and the viewer ----- */
      drawMotes(true, alpha);

      ctx.globalAlpha = 1;
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />;
}

/*------------------------------------------------------------------------------
The hull colour arrives as whatever the engine stores — `#fff`, an `hsl(...)`
string, anything CSS accepts. The pedestal needs the same colour at several
opacities, so this re-expresses it as an rgba() the canvas can take without
having to parse every possible notation itself.
------------------------------------------------------------------------------*/
let probe: CanvasRenderingContext2D | null = null;
const rgbaCache = new Map<string, [number, number, number]>();

function rgba(color: string, alpha: number): string {
  let parts = rgbaCache.get(color);
  if (!parts) {
    if (!probe) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      probe = c.getContext('2d', { willReadFrequently: true });
    }
    if (!probe) return `rgba(120, 200, 235, ${alpha})`;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    parts = [d[0], d[1], d[2]];
    rgbaCache.set(color, parts);
  }
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}
