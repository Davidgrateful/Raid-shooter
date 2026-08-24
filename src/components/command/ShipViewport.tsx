'use client';

import { useEffect, useRef } from 'react';
import type { ShipDef } from './engine';

/*==============================================================================
Ship viewport

The centrepiece of the command centre. This is deliberately NOT an image: it
runs the pilot's real `draw()` function from the engine's character
definitions, in the player's own equipped hull colour, with their trail hue and
their drone in orbit. What sits here is what launches when they hit DEPLOY -
that is the whole point of "this is MY ship".

Everything around it is instrumentation: a slow targeting ring, a scanning
sweep, thruster wash and drifting hangar dust. It idles - it never performs.
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
      const count = Math.round((width * height) / 5200);
      for (let i = 0; i < count; i++) {
        motes.push({ x: Math.random() * width, y: Math.random() * height, z: 0.3 + Math.random() * 0.7, vy: 0.1 + Math.random() * 0.35 });
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let tick = 0;
    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const { ship: def, color: hull, trailHue: hue, drone: wing, dim: damped } = propsRef.current;
      tick += 1;
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;

      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height);
      const alpha = damped ? 0.35 : 1;
      ctx.globalAlpha = alpha;

      /* --- hangar dust: parallax motes drifting up past the hull --------- */
      for (const m of motes) {
        m.y -= m.vy * m.z;
        if (m.y < -2) {
          m.y = height + 2;
          m.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(150, 210, 240, ${0.05 + m.z * 0.12})`;
        ctx.fillRect(m.x, m.y, m.z * 1.6, m.z * 1.6);
      }

      /* --- pedestal glow: the light the ship is parked in ---------------- */
      const wash = ctx.createRadialGradient(cx, cy + scale * 0.1, 0, cx, cy + scale * 0.1, scale * 0.52);
      wash.addColorStop(0, 'rgba(53, 232, 255, 0.14)');
      wash.addColorStop(0.55, 'rgba(53, 232, 255, 0.04)');
      wash.addColorStop(1, 'rgba(53, 232, 255, 0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      /* --- targeting rings: slow, opposed, unmistakably instrumentation -- */
      const ringR = scale * 0.36;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineWidth = 1;

      ctx.strokeStyle = 'rgba(53, 232, 255, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // outer arc segments, rotating one way
      ctx.strokeStyle = 'rgba(53, 232, 255, 0.5)';
      ctx.lineWidth = 1.5;
      const spin = tick / 220;
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, a, a + 0.42);
        ctx.stroke();
      }

      // inner dashed ring, counter-rotating
      ctx.strokeStyle = 'rgba(233, 241, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 0.74, -spin * 1.6, -spin * 1.6 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // four bracket ticks at the cardinals - reads as a locked target
      ctx.strokeStyle = 'rgba(53, 232, 255, 0.65)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const x1 = Math.cos(a) * ringR * 1.06;
        const y1 = Math.sin(a) * ringR * 1.06;
        const x2 = Math.cos(a) * ringR * 1.16;
        const y2 = Math.sin(a) * ringR * 1.16;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      /* --- scan sweep: one pass every few seconds, never a strobe -------- */
      const sweepCycle = (tick % 320) / 320;
      if (sweepCycle < 0.5) {
        const sy = cy - scale * 0.44 + sweepCycle * 2 * scale * 0.88;
        const fade = Math.sin(sweepCycle * 2 * Math.PI) * 0.5;
        const grad = ctx.createLinearGradient(0, sy - 26, 0, sy + 2);
        grad.addColorStop(0, 'rgba(53, 232, 255, 0)');
        grad.addColorStop(1, `rgba(53, 232, 255, ${Math.max(0, fade) * 0.16})`);
        ctx.fillStyle = grad;
        ctx.fillRect(cx - scale * 0.42, sy - 26, scale * 0.84, 28);
      }

      if (!def || typeof def.draw !== 'function') {
        ctx.globalAlpha = 1;
        return;
      }

      /* --- the hull ------------------------------------------------------ */
      // a gentle bob + roll so it reads as holding station, not frozen
      const bob = Math.sin(tick / 70) * scale * 0.012;
      const roll = Math.sin(tick / 130) * 0.05;
      const shipR = scale * 0.115;

      ctx.save();
      ctx.translate(cx, cy + bob);

      // engine wash below the hull, tinted by the equipped trail
      const trailColor = hue !== null ? `hsla(${hue}, 95%, 62%,` : 'rgba(53, 232, 255,';
      const thrust = 0.55 + Math.sin(tick / 9) * 0.12;
      const plume = ctx.createLinearGradient(0, shipR * 0.6, 0, shipR * 3.6);
      plume.addColorStop(0, `${trailColor} ${0.4 * thrust})`);
      plume.addColorStop(1, `${trailColor} 0)`);
      ctx.fillStyle = plume;
      ctx.beginPath();
      ctx.moveTo(-shipR * 0.5, shipR * 0.6);
      ctx.lineTo(shipR * 0.5, shipR * 0.6);
      ctx.lineTo(shipR * 0.16, shipR * 3.4);
      ctx.lineTo(-shipR * 0.16, shipR * 3.4);
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
