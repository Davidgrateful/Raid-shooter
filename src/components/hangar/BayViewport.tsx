'use client';

import { useEffect, useRef } from 'react';
import { rgba } from '@/components/command/color';
import type { ShipDef } from '@/components/command/engine';

/*==============================================================================
THE BAY

This is not the command deck's viewport made bigger. The deck shows a hull
holding station in open space with instrumentation around it; the bay is a
PLACE - it has a floor, a ceiling, walls, service gantries, and a docking
cradle the hull is physically sitting in. That difference is what makes this
screen read as somewhere the player has gone rather than a larger version of
where they were.

  FLOOR      a perspective grid running to a horizon, so there is a ground
             plane and the hull has somewhere to stand
  GANTRIES   two service towers with lit deck lines, framing the cradle
  CRADLE     a raised pad with four clamp arms reaching toward the hull
  CEILING    a bank of bay lights washing down in the hull's own accent
  HULL       roughly 1.55x the deck's size, bobbing on its cradle

A LOCKED hull is drawn on a dark, unpowered cradle behind a containment field:
no wash, no clamp glow, the hull itself desaturated to a silhouette. Locked is
a state of the bay, not a dialog thrown over it.

Changing hull runs a short swap: the outgoing hull slides and spins out, the
bay lights flare, the incoming one settles in. The engine's canvas hangar has
always done this ($.hangarAnim); keeping it means switching pilots still feels
like a choose-your-fighter moment rather than a list selection.
==============================================================================*/

interface Props {
  ship: ShipDef | null;
  /** The player's equipped hull colour. */
  color: string;
  /** The pilot's signature hue, from $.pilotAccentHue - drives the bay light. */
  accentHue: number;
  trailHue: number | null;
  drone?: ShipDef | null;
  unlocked: boolean;
  /** Bumped on every hull change; direction of travel drives the swap. */
  swapKey: number;
  swapDir: number;
  compact?: boolean;
  /**
   * What is on the cradle. A `hull` is drawn nose-up with an engine wash,
   * because that is how a ship parks. An `object` - a drone on the armory's
   * inspection cradle - has no engine and no facing, so it gets neither.
   */
  subject?: 'hull' | 'object';
}

interface Mote {
  x: number;
  y: number;
  z: number;
  vy: number;
  front: boolean;
}

export function BayViewport({
  ship,
  color,
  accentHue,
  trailHue,
  drone,
  unlocked,
  swapKey,
  swapDir,
  compact = false,
  subject = 'hull',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const propsRef = useRef({ ship, color, accentHue, trailHue, drone, unlocked, compact, subject });
  const swapRef = useRef({ t: 0, dir: 1 });

  useEffect(() => {
    propsRef.current = { ship, color, accentHue, trailHue, drone, unlocked, compact, subject };
  }, [ship, color, accentHue, trailHue, drone, unlocked, compact, subject]);

  // a hull change arms the swap; the loop eases it back to rest
  useEffect(() => {
    if (swapKey === 0) return;
    swapRef.current = { t: 1, dir: swapDir || 1 };
  }, [swapKey, swapDir]);

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
      const nextDpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.max(1, Math.round(rect.width * nextDpr));
      const bh = Math.max(1, Math.round(rect.height * nextDpr));
      // Nothing actually changed - bail before touching the backing store.
      // Writing canvas.width/height clears the bitmap and, on a resize
      // observer, re-entering here on every callback both restarts the mote
      // field mid-flight and invites a layout feedback loop.
      if (bw === canvas.width && bh === canvas.height && motes.length) return;
      dpr = nextDpr;
      width = rect.width;
      height = rect.height;
      canvas.width = bw;
      canvas.height = bh;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes.length = 0;
      const count = Math.round((width * height) / 5200);
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: 0.3 + Math.random() * 0.7,
          vy: 0.08 + Math.random() * 0.3,
          front: Math.random() < 0.22,
        });
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const drawMotes = (front: boolean) => {
      for (const m of motes) {
        if (m.front !== front) continue;
        m.y -= m.vy * m.z;
        if (m.y < -2) {
          m.y = height + 2;
          m.x = Math.random() * width;
        }
        const size = front ? m.z * 2.2 : m.z * 1.4;
        ctx.fillStyle = `rgba(170, 220, 248, ${(front ? 0.08 + m.z * 0.14 : 0.035 + m.z * 0.08)})`;
        ctx.fillRect(m.x, m.y, size, size);
      }
    };

    let tick = 0;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      const {
        ship: def, color: hull, accentHue: hue, trailHue: trail, drone: wing,
        unlocked: live, compact: small, subject: kind,
      } = propsRef.current;
      tick += 1;
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;

      const swap = swapRef.current;
      if (swap.t > 0) swap.t = Math.max(0, swap.t - 0.055);
      const ease = swap.t * swap.t;

      const cx = width / 2;
      const scale = Math.min(width, height * 1.15);
      // the hull rides above the cradle; the cradle sits on the floor plane
      const cy = height * (small ? 0.45 : 0.44);
      const floorY = height * 0.80;
      const horizonY = height * 0.42;
      const cradleY = floorY - height * 0.06;

      const lit = live ? 1 : 0.28;
      const accent = (l: number, a: number) => `hsla(${hue}, 85%, ${l}%, ${a})`;

      /*--- CEILING: the bay's overhead light bank ------------------------*/
      const ceiling = ctx.createLinearGradient(0, 0, 0, horizonY);
      ceiling.addColorStop(0, accent(58, 0));
      ceiling.addColorStop(0.16, accent(58, (0.17 + ease * 0.2) * lit));
      ceiling.addColorStop(1, accent(58, 0));
      ctx.fillStyle = ceiling;
      ctx.fillRect(0, 0, width, horizonY);

      // the light bank itself: a row of hard-edged strips at the very top
      const strips = small ? 5 : 8;
      const stripY = height * 0.08;
      for (let i = 0; i < strips; i++) {
        const sw = width / (strips * 2.1);
        const sx = ((i + 0.5) / strips) * width - sw / 2;
        // fade the outermost strips so the bank does not stop at a hard edge
        const edge = 1 - Math.abs((i + 0.5) / strips - 0.5) * 1.5;
        ctx.fillStyle = accent(72, (0.22 + Math.sin(tick / 90 + i) * 0.05 + ease * 0.35) * lit * edge);
        ctx.fillRect(sx, stripY, sw, 2);
      }

      drawMotes(false);

      /*--- FLOOR: a perspective grid running back to the horizon ---------*/
      // Lines converge on a vanishing point above the horizon, and the
      // spacing of the depth lines compresses toward it, so the ground
      // reads as receding rather than as a flat lattice.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizonY, width, height - horizonY);
      ctx.clip();

      const vpY = horizonY - height * 0.06;
      const lanes = small ? 9 : 15;
      for (let i = -lanes; i <= lanes; i++) {
        const fx = cx + (i / lanes) * width * 1.6;
        const edge = Math.abs(i) / lanes;
        ctx.strokeStyle = `rgba(120, 190, 225, ${0.12 * (1 - edge * 0.7) * lit})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, vpY);
        ctx.lineTo(fx, height);
        ctx.stroke();
      }
      const depths = 9;
      for (let i = 1; i <= depths; i++) {
        const t = i / depths;
        const y = vpY + (height - vpY) * t * t;
        ctx.strokeStyle = `rgba(120, 190, 225, ${0.06 + t * 0.1 * lit})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      // horizon haze so the grid dies into the back wall instead of stopping
      const haze = ctx.createLinearGradient(0, horizonY - height * 0.1, 0, horizonY + height * 0.12);
      haze.addColorStop(0, 'rgba(6, 12, 22, 0)');
      haze.addColorStop(0.5, 'rgba(6, 12, 22, 0.75)');
      haze.addColorStop(1, 'rgba(6, 12, 22, 0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, horizonY - height * 0.1, width, height * 0.22);

      /*--- GANTRIES: two service towers framing the cradle ---------------*/
      const gantry = (side: number) => {
        const gx = cx + side * width * (small ? 0.36 : 0.33);
        const topY = horizonY - height * 0.06;
        const botY = floorY + height * 0.04;
        ctx.strokeStyle = `rgba(150, 200, 232, ${0.34 * lit})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, topY);
        ctx.lineTo(gx, botY);
        ctx.stroke();
        // service decks: short arms reaching in toward the cradle, spaced
        // wider as they come forward so they sit on the same perspective
        const decks = small ? 3 : 4;
        for (let i = 0; i < decks; i++) {
          const t = (i + 1) / (decks + 1);
          const y = topY + (botY - topY) * t * t;
          const reach = width * 0.05 * (0.5 + t);
          ctx.strokeStyle = `rgba(150, 200, 232, ${(0.16 + t * 0.22) * lit})`;
          ctx.beginPath();
          ctx.moveTo(gx, y);
          ctx.lineTo(gx - side * reach, y);
          ctx.stroke();
          // a lit status pip at the end of each deck
          ctx.fillStyle = accent(66, (0.35 + Math.sin(tick / 40 + i * 2) * 0.2) * lit);
          ctx.fillRect(gx - side * reach - 1.5, y - 1.5, 3, 3);
        }
      };
      gantry(-1);
      gantry(1);

      /*--- CRADLE: the raised pad the hull is docked on ------------------*/
      const padRx = scale * (small ? 0.34 : 0.32);
      const padRy = padRx * 0.19;

      // pool of light on the pad, in the hull's own colour
      const pool = ctx.createRadialGradient(cx, cradleY, 0, cx, cradleY, padRx);
      pool.addColorStop(0, rgba(hull, 0.32 * lit + ease * 0.2));
      pool.addColorStop(0.45, rgba(hull, 0.1 * lit));
      pool.addColorStop(1, rgba(hull, 0));
      ctx.save();
      ctx.translate(cx, cradleY);
      ctx.scale(1, padRy / padRx);
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(0, 0, padRx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // pad rim, brighter along the front edge where the light catches
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cradleY, padRx * 0.86, padRy * 0.86, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(hull, 0.22 * lit);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cradleY, padRx * 0.86, padRy * 0.86, 0, 0.12, Math.PI - 0.12);
      ctx.strokeStyle = rgba(hull, 0.55 * lit);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();

      // four clamp arms rising off the pad toward the hull
      const shipR = scale * (small ? 0.12 : 0.135);
      const hullY = cy + Math.sin(tick / 70) * scale * 0.012;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const bx = cx + Math.cos(a) * padRx * 0.72;
        const by = cradleY + Math.sin(a) * padRy * 0.72;
        const tipX = cx + Math.cos(a) * shipR * 1.5;
        const tipY = hullY + Math.sin(a) * shipR * 0.55 + shipR * 0.35;
        ctx.strokeStyle = `rgba(160, 205, 235, ${0.3 * lit})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.fillStyle = accent(70, 0.55 * lit);
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!def || typeof def.draw !== 'function') return;

      /*--- the hull ------------------------------------------------------*/
      const slideX = swap.dir * ease * width * 0.32;
      const spin = swap.dir * ease * Math.PI;
      const roll = Math.sin(tick / 130) * 0.045;

      // reflection on the pad, clipped to the floor so it cannot rise back
      // through the cradle and read as a second, upside-down ship
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cradleY, padRx * 0.88, padRy * 0.95, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.09 * lit;
      ctx.translate(cx + slideX, cradleY + padRy * 0.1);
      ctx.scale(1, -0.16);
      ctx.rotate(roll + spin);
      if (kind === 'hull') ctx.rotate(-Math.PI / 2);
      def.draw(ctx, shipR, hull, tick);
      ctx.restore();

      ctx.save();
      ctx.translate(cx + slideX, hullY);

      // engine wash, tinted by the equipped trail when there is one
      if (live && kind === 'hull') {
        const trailColor = trail !== null ? `hsla(${trail}, 95%, 62%,` : 'rgba(53, 232, 255,';
        const thrust = 0.5 + Math.sin(tick / 9) * 0.12;
        // never past the cradle - exhaust that overshoots the pad stops
        // reading as exhaust and becomes a bright spike hanging in the bay
        const plumeEnd = Math.max(shipR * 1.1, Math.min(shipR * 2.1, cradleY - hullY - padRy * 0.4));
        const plume = ctx.createLinearGradient(0, shipR * 0.6, 0, plumeEnd);
        plume.addColorStop(0, `${trailColor} ${0.4 * thrust})`);
        plume.addColorStop(0.6, `${trailColor} ${0.11 * thrust})`);
        plume.addColorStop(1, `${trailColor} 0)`);
        ctx.fillStyle = plume;
        ctx.beginPath();
        ctx.moveTo(-shipR * 0.5, shipR * 0.6);
        ctx.lineTo(shipR * 0.5, shipR * 0.6);
        ctx.lineTo(shipR * 0.14, plumeEnd);
        ctx.lineTo(-shipR * 0.14, plumeEnd);
        ctx.closePath();
        ctx.fill();
      }

      ctx.rotate(roll + spin);
      // the engine draws hulls facing +x; the bay presents them nose-up. An
      // object on the cradle has no facing, so it is left as it is drawn.
      if (kind === 'hull') ctx.rotate(-Math.PI / 2);
      if (live) {
        ctx.shadowColor = hull;
        ctx.shadowBlur = 30;
      } else {
        ctx.globalAlpha = 0.4;
      }
      def.draw(ctx, shipR, live ? hull : 'hsl(210, 12%, 46%)', tick);
      ctx.shadowBlur = 0;
      ctx.restore();

      /*--- containment field over a hull that is not yours ---------------*/
      if (!live) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = 'rgba(150, 175, 200, 0.16)';
        ctx.lineWidth = 1;
        const fieldR = shipR * 2.1;
        for (let i = 0; i < 5; i++) {
          const y = hullY - fieldR + (i / 4) * fieldR * 2;
          const half = Math.sqrt(Math.max(0, fieldR * fieldR - (y - hullY) * (y - hullY)));
          ctx.beginPath();
          ctx.moveTo(cx - half, y);
          ctx.lineTo(cx + half, y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, hullY, fieldR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150, 175, 200, 0.28)';
        ctx.setLineDash([4, 7]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      /*--- escort drone, if one is equipped ------------------------------*/
      if (live && wing && typeof wing.draw === 'function') {
        const orbit = tick / 100;
        const ox = cx + Math.cos(orbit) * shipR * 2.6 + slideX;
        const oy = hullY + Math.sin(orbit) * shipR * 1.1;
        ctx.save();
        ctx.translate(ox, oy);
        wing.draw(ctx, scale * 0.036, wing.color || 'hsl(190, 100%, 70%)', tick);
        ctx.restore();
      }

      drawMotes(true);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />;
}
