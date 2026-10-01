/*==============================================================================
Pilot motion - how each pilot arrives on the pad, idles there, and test-fires

Every pilot lands its own way when it is selected, settles into its own idle,
and fires a short test burst every couple of seconds in its own pattern. All of
it is cosmetic: the bay is a showroom, and nothing here touches a run.

  land(u)   u runs 0 -> 1 over `landTime` seconds. Returns the plane's offset
            from its resting pose: position, yaw (ry), roll about the nose (rx),
            pitch (rz) and scale, plus `flicker` (0..1) for pilots that arrive
            as a signal rather than a craft. At u = 1 every field is at rest.
  idle(t)   the resting motion, in seconds since the scene started.
  fire      a burst of `burst` bolts `gap` seconds apart, every `every`
            seconds, from `guns` (z offsets across the nose), in `hue`.
  impact    how hard the landing hits the pad: 0 a whisper, 1 a slam (the pad
            flashes, and for a heavy hull the camera shakes).
==============================================================================*/

export interface Pose { x: number; y: number; z: number; ry: number; rx: number; rz: number; s: number; flicker: number }
export interface Idle { y: number; ry: number; rx: number; rz: number; jx: number; jz: number }

export interface FireStyle {
  burst: number;
  gap: number;
  every: number;
  guns: number[];
  hue: number;
  /** bolt length and speed (bay units, units per second) */
  len: number;
  speed: number;
  /** yaw fan across the guns, radians */
  fan: number;
}

export interface PilotMotion {
  landTime: number;
  impact: number;
  land(u: number, dir: number): Pose;
  idle(t: number): Idle;
  fire: FireStyle;
}

const PI = Math.PI;
const rest: Pose = { x: 0, y: 0, z: 0, ry: 0, rx: 0, rz: 0, s: 1, flicker: 0 };
const pose = (p: Partial<Pose>): Pose => ({ ...rest, ...p });
const outCubic = (u: number) => 1 - Math.pow(1 - u, 3);
const outBack = (u: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
// a settle that dips once below rest (a touchdown) and recovers
const bounce = (u: number, depth: number) => (u < 0.7 ? 0 : -Math.sin(((u - 0.7) / 0.3) * PI) * depth);
const idleBase = (t: number, amp: number, freq: number, sway: number): Idle => ({
  y: Math.sin(t * freq) * amp, ry: 0, rx: Math.sin(t * freq * 0.7) * sway, rz: Math.cos(t * freq * 0.9) * sway * 0.4, jx: 0, jz: 0,
});

// one bolt from the nose
const single = (hue: number, extra: Partial<FireStyle> = {}): FireStyle => ({ burst: 3, gap: 0.11, every: 2.2, guns: [0], hue, len: 0.55, speed: 15, fan: 0, ...extra });

export const PILOT_MOTION: Record<string, PilotMotion> = {
  // ONYIX - the balanced fighter: a clean banking swoop onto the pad
  onyix: {
    landTime: 1.1, impact: 0.45,
    land(u, dir) {
      const e = outCubic(u);
      return pose({ x: -dir * (1 - e) * 7, y: (1 - e) * 3.2 + bounce(u, 0.12), rx: dir * (1 - e) * 0.9, ry: -dir * (1 - e) * 0.6 });
    },
    idle: (t) => idleBase(t, 0.06, 1.4, 0.05),
    fire: single(190),
  },
  // NOVA - drops straight down out of the light on a column of thrust
  nova: {
    landTime: 0.95, impact: 0.6,
    land(u) {
      const e = u * u * (3 - 2 * u);
      return pose({ y: (1 - e) * 6 + bounce(u, 0.18), rz: (1 - e) * -0.25 });
    },
    idle: (t) => idleBase(t, 0.07, 1.8, 0.04),
    fire: single(200, { burst: 4, gap: 0.08, speed: 18 }),
  },
  // TANK REX - heavy: falls, slams, the pad rings and the bay shakes
  tankrex: {
    landTime: 0.8, impact: 1,
    land(u) {
      const fall = u < 0.75 ? Math.pow(u / 0.75, 2) : 1;
      const settle = u < 0.75 ? 0 : -Math.sin(((u - 0.75) / 0.25) * PI) * 0.3;
      return pose({ y: (1 - fall) * 5 + settle, rz: u < 0.75 ? 0 : Math.sin(((u - 0.75) / 0.25) * PI) * 0.08 });
    },
    idle: (t) => idleBase(t, 0.025, 0.9, 0.015),
    fire: { burst: 2, gap: 0.32, every: 2.6, guns: [0], hue: 30, len: 0.8, speed: 11, fan: 0 },
  },
  // ASTRA VANE - spirals down around the pad like a falling leaf
  astravane: {
    landTime: 1.4, impact: 0.3,
    land(u) {
      const e = outCubic(u);
      const a = (1 - e) * PI * 2.2;
      return pose({ x: Math.cos(a) * (1 - e) * 4, z: Math.sin(a) * (1 - e) * 3, y: (1 - e) * 4, ry: (1 - e) * PI * 2.2, rx: (1 - e) * 0.7 });
    },
    idle: (t) => idleBase(t, 0.08, 1.2, 0.09),
    fire: { burst: 3, gap: 0.09, every: 2.0, guns: [-0.35, 0.35], hue: 160, len: 0.45, speed: 16, fan: 0.12 },
  },
  // IRON HALO - lowers itself slowly, perfectly level, its ring spinning up
  ironhalo: {
    landTime: 1.5, impact: 0.25,
    land(u) {
      const e = outCubic(u);
      return pose({ y: (1 - e) * 3.5, s: 0.85 + e * 0.15 });
    },
    idle: (t) => ({ y: Math.sin(t * 1.0) * 0.05, ry: 0, rx: 0, rz: 0, jx: 0, jz: 0 }),
    fire: { burst: 6, gap: 0.05, every: 2.6, guns: [-0.5, 0, 0.5], hue: 210, len: 0.35, speed: 14, fan: 0.35 },
  },
  // RUNE PILOT - not flown in: summoned. Grows out of a flash, spinning
  runepilot: {
    landTime: 1.1, impact: 0.4,
    land(u) {
      const e = outBack(Math.min(1, u * 1.05));
      return pose({ s: Math.max(0.01, e), ry: (1 - u) * PI * 3, y: (1 - u) * 1.2, flicker: u < 0.6 ? 1 - u / 0.6 : 0 });
    },
    idle: (t) => ({ ...idleBase(t, 0.1, 1.1, 0.03), ry: Math.sin(t * 0.6) * 0.08 }),
    fire: { burst: 5, gap: 0.07, every: 2.4, guns: [0], hue: 280, len: 0.4, speed: 13, fan: 0.5 },
  },
  // NEBULA FOX - barrel-rolls in from the far side
  nebulafox: {
    landTime: 1.15, impact: 0.4,
    land(u, dir) {
      const e = outCubic(u);
      return pose({ x: dir * (1 - e) * 7, y: (1 - e) * 2 + bounce(u, 0.1), rx: (1 - e) * PI * 2 * dir, ry: dir * (1 - e) * 0.4 });
    },
    idle: (t) => idleBase(t, 0.07, 1.6, 0.08),
    fire: { burst: 3, gap: 0.1, every: 2.1, guns: [-0.3, 0.3], hue: 300, len: 0.5, speed: 16, fan: 0 },
  },
  // JAVELIN 9 - a streak from deep in the bay, then a hard brake
  javelin9: {
    landTime: 0.7, impact: 0.55,
    land(u) {
      const e = 1 - Math.pow(1 - u, 5);
      return pose({ z: -(1 - e) * 16, y: (1 - e) * 1.5, rz: (1 - e) * 0.15 + (u > 0.8 ? Math.sin(((u - 0.8) / 0.2) * PI) * -0.12 : 0) });
    },
    idle: (t) => idleBase(t, 0.04, 2.2, 0.03),
    fire: { burst: 1, gap: 0.1, every: 1.7, guns: [0], hue: 55, len: 1.4, speed: 26, fan: 0 },
  },
  // ATLAS BEAM - lowered in by the overhead light, like cargo on a tractor beam
  atlasbeam: {
    landTime: 1.6, impact: 0.35,
    land(u) {
      const e = u * u * (3 - 2 * u);
      return pose({ y: (1 - e) * 5, ry: (1 - e) * 0.8, flicker: (1 - u) * 0.4 });
    },
    idle: (t) => idleBase(t, 0.045, 1.0, 0.025),
    fire: { burst: 1, gap: 0.1, every: 2.4, guns: [0], hue: 45, len: 1.2, speed: 9, fan: 0 },
  },
  // GLITCH PRINCE - arrives as bad signal: snaps between positions, then locks
  glitchprince: {
    landTime: 1.0, impact: 0.3,
    land(u) {
      if (u >= 1) return rest;
      const step = Math.floor(u * 9);
      const k = 1 - u;
      const r = (n: number) => { const v = Math.sin(step * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };
      return pose({ x: r(1) * 5 * k, y: Math.abs(r(2)) * 2 * k, z: r(3) * 3 * k, ry: r(4) * 2 * k, flicker: u < 0.85 ? 0.8 : 0 });
    },
    idle: (t) => {
      const b = idleBase(t, 0.05, 1.5, 0.04);
      // the odd frame skips sideways, the way the 2D airframe jitters
      const tick = Math.floor(t * 8);
      const glitch = Math.sin(tick * 91.7) > 0.93;
      return { ...b, jx: glitch ? 0.18 : 0, jz: glitch ? -0.1 : 0 };
    },
    fire: { burst: 4, gap: 0.06, every: 2.0, guns: [0], hue: 320, len: 0.4, speed: 17, fan: 0.25 },
  },
  // SOLSTICE - rises from below the pad like a sunrise
  solstice: {
    landTime: 1.3, impact: 0.3,
    land(u) {
      const e = outCubic(u);
      return pose({ y: -(1 - e) * 2.6, s: 0.6 + e * 0.4, rz: (1 - e) * 0.5, flicker: (1 - u) * 0.3 });
    },
    idle: (t) => idleBase(t, 0.08, 1.0, 0.04),
    fire: { burst: 3, gap: 0.12, every: 2.3, guns: [-0.25, 0.25], hue: 40, len: 0.6, speed: 15, fan: 0.08 },
  },
  // CRIMSON WISP - swirls in like a blown ember
  crimsonwisp: {
    landTime: 1.25, impact: 0.25,
    land(u, dir) {
      const e = outCubic(u);
      const a = (1 - e) * PI * 1.5;
      return pose({ x: -dir * Math.sin(a) * (1 - e) * 5, z: Math.cos(a) * (1 - e) * 2, y: (1 - e) * 3 + Math.sin(u * PI * 3) * (1 - e) * 0.6, rx: Math.sin(u * PI * 4) * (1 - e) * 0.8, flicker: (1 - u) * 0.5 });
    },
    idle: (t) => ({ ...idleBase(t, 0.09, 1.9, 0.07), ry: Math.sin(t * 0.9) * 0.06 }),
    fire: { burst: 3, gap: 0.09, every: 2.0, guns: [0], hue: 8, len: 0.5, speed: 15, fan: 0.18 },
  },
  // RIDER - slides in sideways and skids to a stop, nose swinging round
  voltrider: {
    landTime: 1.0, impact: 0.5,
    land(u, dir) {
      const e = outCubic(u);
      return pose({ z: (1 - e) * 1.5, x: -dir * (1 - e) * 7, ry: -dir * (1 - e) * 1.4 + (u > 0.7 ? Math.sin(((u - 0.7) / 0.3) * PI) * dir * 0.2 : 0), rx: -dir * (1 - e) * 0.35, y: (1 - e) * 0.8 });
    },
    idle: (t) => idleBase(t, 0.05, 2.0, 0.06),
    fire: { burst: 4, gap: 0.08, every: 1.9, guns: [-0.2, 0.2], hue: 270, len: 0.5, speed: 18, fan: 0 },
  },
};

export function motionFor(pilotId: string | undefined): PilotMotion {
  return (pilotId && PILOT_MOTION[pilotId]) || PILOT_MOTION.onyix;
}
