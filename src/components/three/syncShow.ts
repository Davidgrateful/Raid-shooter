import type * as THREE_NS from 'three';
import { DRONE_TINTS } from './droneModels';

/*==============================================================================
The hangar sync show - a pilot and its drone, together

Plays on the bay pad when a drone is equipped, or when a pilot lands with one
riding along. Two halves, so every pilot + drone pair is its own show:

  the DRONE's move   a 3D take on its raid combo move (BULWARK's hex shield,
                     BLIZZARD's snow, MIRAGE's ghost planes...), tinted toward
                     the pilot's colour
  the PILOT's touch  its signature flourish (Nova's afterimages, Tank Rex's
                     quake, Glitch Prince's slices...) in its own colour - the
                     hue it test-fires in (pilotMotion.ts)

13 pilots x 12 drones = 156 different shows from 25 parts. Everything is drawn
from small pools of glow sprites, bars and rings built once, so a show costs
no allocation while it plays. Bay only: nothing here touches a raid.
==============================================================================*/

type Three = typeof THREE_NS;
type V3 = THREE_NS.Vector3;

export const SHOW_TIME = 1.9;

interface Kit {
  /** plane centre, nose direction, right, up - world space */
  P: V3; F: V3; R: V3; U: V3;
  nose: number;
  /** the pilot's colour, a hot version of it, and the drone's tint pulled toward the pilot's */
  pc: THREE_NS.Color; hot: THREE_NS.Color; dc: THREE_NS.Color;
  spr(i: number, at: V3, size: number, c: THREE_NS.Color, a: number, rot?: number, sx?: number): void;
  rune(i: number, at: V3, size: number, c: THREE_NS.Color, a: number): void;
  bar(i: number, from: V3, to: V3, thick: number, c: THREE_NS.Color, a: number): void;
  ring(i: number, at: V3, r: number, c: THREE_NS.Color, a: number, upright?: boolean): void;
  hex(i: number, at: V3, r: number, c: THREE_NS.Color, a: number, face: V3): void;
  ghost(i: number, offset: V3, a: number, c: THREE_NS.Color): void;
  v(i: number): V3;
  out: { drone: V3 | null; jitter: number; shake: number };
}

const TWO = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const bell = (u: number) => Math.sin(clamp01(u) * Math.PI);

/*--- the drones' moves (u = 0..1 over the move) ----------------------------*/
const DRONE_MOVES: Record<string, (u: number, k: Kit) => void> = {
  // BULWARK: a dome of hex plates closes round the plane, then fades
  drone_aegis(u, k) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TWO + u * 1.2, tier = i % 2;
      const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * 2.3).addScaledVector(k.R, Math.sin(a) * 2.3).addScaledVector(k.U, tier ? 0.75 : 0.05);
      k.hex(i, at, 0.32 + bell(u) * 0.05, k.dc, bell(u) * 0.9, k.P);
    }
  },
  // STORM CROWN: six crackling arcs out from the hull
  drone_voltmite(u, k) {
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * TWO + u * 2, r2 = 1.0 + 1.6 * (0.6 + 0.4 * u);
      let prev = k.v(1).copy(k.P).addScaledVector(k.F, Math.cos(a) * 0.7).addScaledVector(k.R, Math.sin(a) * 0.7);
      for (let s = 1; s <= 3; s++) {
        const r = 0.7 + ((r2 - 0.7) * s) / 3, j = (Math.random() - 0.5) * 0.5;
        const next = k.v(2 + s).copy(k.P).addScaledVector(k.F, Math.cos(a + j * 0.4) * r).addScaledVector(k.R, Math.sin(a + j * 0.4) * r).addScaledVector(k.U, j * 0.4);
        k.bar(b * 3 + s - 1, prev, next, 0.04, k.hot, (1 - u) * 0.95);
        prev = next;
      }
      k.spr(b, prev, 0.5, k.dc, 1 - u);
    }
  },
  // STRAFE: the finch whips a loop round the plane, leaving a streak
  drone_needlefinch(u, k) {
    const th = u * TWO * 1.25;
    k.out.drone = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(th) * 2.4).addScaledVector(k.R, Math.sin(th) * 2.4).addScaledVector(k.U, 0.5);
    for (let j = 0; j < 18; j++) {
      const t = th - j * 0.13;
      if (t < 0) continue;
      const at = k.v(1).copy(k.P).addScaledVector(k.F, Math.cos(t) * 2.4).addScaledVector(k.R, Math.sin(t) * 2.4).addScaledVector(k.U, 0.5);
      k.spr(j, at, 0.45 - j * 0.02, k.dc, (1 - j / 18) * (1 - u * 0.6));
    }
  },
  // COLLAPSE: rings rush inward, then a bloom
  drone_gravbeetle(u, k) {
    if (u < 0.55) {
      for (let j = 0; j < 4; j++) { const g = (u / 0.55 + j / 4) % 1; k.ring(j, k.P, 3.6 * (1 - g) + 0.3, k.dc, g * 0.9); }
    } else {
      const b = (u - 0.55) / 0.45;
      k.spr(0, k.P, 1 + b * 7, k.dc, (1 - b) * 0.8);
    }
  },
  // BLOOM: petals open round the hull, a halo over it
  drone_medicwisp(u, k) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TWO + u, r = 0.8 + u * 1.6;
      const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * r).addScaledVector(k.R, Math.sin(a) * r).addScaledVector(k.U, 0.3);
      k.spr(i, at, 0.55, k.dc, bell(u), a, 0.35);
    }
    k.ring(0, k.v(1).copy(k.P).addScaledVector(k.U, 1.3), 0.7, k.hot, bell(u));
  },
  // CROWNED: gold rays burst out, a crown of sparks above
  drone_champion(u, k) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TWO;
      const d = k.v(0).copy(k.F).multiplyScalar(Math.cos(a)).addScaledVector(k.R, Math.sin(a));
      k.bar(i, k.v(1).copy(k.P).addScaledVector(d, 0.8 + u * 0.8), k.v(2).copy(k.P).addScaledVector(d, 1.6 + u * 3), 0.06, k.dc, (1 - u) * 0.9);
    }
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * TWO + u * 2;
      k.spr(s, k.v(3).copy(k.P).addScaledVector(k.U, 1.4 + Math.sin(u * 6 + s) * 0.1).addScaledVector(k.F, Math.cos(a) * 0.6).addScaledVector(k.R, Math.sin(a) * 0.6), 0.4, k.hot, bell(u));
    }
  },
  // BLIZZARD: snow spirals out and up
  drone_frostsprite(u, k) {
    for (let j = 0; j < 26; j++) {
      const a = (j / 26) * TWO + u * 3, r = 0.5 + u * 2.6 * (0.6 + (j % 4) * 0.14);
      const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * r).addScaledVector(k.R, Math.sin(a) * r).addScaledVector(k.U, (j % 3) * 0.3 + u * 1.2 - 0.3);
      k.spr(j, at, 0.22 + (j % 3) * 0.06, k.hot, (1 - u) * 0.95);
    }
  },
  // HAUL: the magnet throws out a pulse of rings
  drone_salvagecrab(u, k) {
    for (let j = 0; j < 3; j++) { const h = (u * 1.6 + j / 3) % 1; k.ring(j, k.P, 0.4 + h * 3.4, k.dc, (1 - h) * (1 - u)); }
    k.spr(0, k.P, 1.4, k.dc, bell(u) * 0.4);
  },
  // WILDFIRE: petals of flame spiral out
  drone_embermoth(u, k) {
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * TWO + u * 2.4, r = 0.5 + u * 2.3;
      const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * r).addScaledVector(k.R, Math.sin(a) * r).addScaledVector(k.U, Math.sin(u * 8 + j) * 0.3);
      k.spr(j, at, 0.5, j % 2 ? k.dc : k.hot, bell(u), a + 0.9, 0.4);
    }
  },
  // ECHO: sonar rings roll out, glinting with mirror shards
  drone_mirrorbat(u, k) {
    for (let r = 0; r < 3; r++) {
      const e = clamp01((u - r * 0.15) / (1 - r * 0.15));
      if (e <= 0) continue;
      const rad = 0.5 + e * 3.4;
      k.ring(r, k.P, rad, k.hot, (1 - e) * 0.85);
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * TWO + r;
        k.spr(r * 6 + s, k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * rad).addScaledVector(k.R, Math.sin(a) * rad), 0.3, k.dc, 1 - e);
      }
    }
  },
  // MIRAGE: three ghost planes fan out behind and fade
  drone_decoygecko(u, k) {
    for (let g = 0; g < 3; g++) {
      k.ghost(g, k.v(0).copy(k.F).multiplyScalar(-u * 2.6).addScaledVector(k.R, (g - 1) * u * 2.0), (1 - u) * 0.55, k.dc);
    }
  },
  // NIGHT SIGHT: a radar sweep turns round the plane, lighting brackets as it passes
  drone_scoutowl(u, k) {
    const a = u * TWO * 1.2;
    const d = k.v(0).copy(k.F).multiplyScalar(Math.cos(a)).addScaledVector(k.R, Math.sin(a));
    k.bar(0, k.P, k.v(1).copy(k.P).addScaledVector(d, 3.4), 0.05, k.hot, (1 - u) * 0.95);
    k.bar(1, k.P, k.v(2).copy(k.P).addScaledVector(k.v(3).copy(k.F).multiplyScalar(Math.cos(a - 0.25)).addScaledVector(k.R, Math.sin(a - 0.25)), 3.2), 0.03, k.dc, (1 - u) * 0.5);
    for (let s = 0; s < 8; s++) {
      const sa = (s / 8) * TWO, lit = ((a - sa) % TWO + TWO) % TWO < 1.2 ? 1 : 0.15;
      k.spr(s, k.v(4).copy(k.P).addScaledVector(k.F, Math.cos(sa) * 2.8).addScaledVector(k.R, Math.sin(sa) * 2.8), 0.35, k.dc, lit * (1 - u));
    }
  },
};

/*--- the pilots' touches (u = 0..1 over the flourish), in the pilot's colour --*/
const PILOT_TOUCH: Record<string, (u: number, k: Kit) => void> = {
  // CHEVRONS sweep forward off the nose
  onyix(u, k) {
    for (let c = 0; c < 3; c++) {
      const cu = clamp01(u * 1.5 - c * 0.18), d = k.nose + 0.4 + cu * 4;
      const tip = k.v(0).copy(k.P).addScaledVector(k.F, d);
      const back = k.v(1).copy(tip).addScaledVector(k.F, -0.6);
      k.bar(20 + c * 2, k.v(2).copy(back).addScaledVector(k.R, 0.6), tip, 0.05, k.pc, bell(cu));
      k.bar(21 + c * 2, k.v(3).copy(back).addScaledVector(k.R, -0.6), tip, 0.05, k.pc, bell(cu));
    }
  },
  // AFTERIMAGES strung out behind, and a starburst
  nova(u, k) {
    for (let g = 0; g < 3; g++) k.ghost(3 + g, k.v(0).copy(k.F).multiplyScalar(-(g + 1) * 0.8 * (0.4 + u)), (1 - u) * (0.45 - g * 0.12), k.pc);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TWO, d = k.v(1).copy(k.U).multiplyScalar(Math.cos(a)).addScaledVector(k.R, Math.sin(a));
      k.bar(20 + i, k.v(2).copy(k.P).addScaledVector(d, 0.5), k.v(3).copy(k.P).addScaledVector(d, 0.9 + u * 1.6), 0.04, k.hot, clamp01(1 - u * 2));
    }
  },
  // QUAKE: a heavy ring across the pad, cracks running out, the bay shakes
  tankrex(u, k) {
    const pad = k.v(0).set(k.P.x, 0.42, k.P.z);
    k.ring(10, pad, 0.8 + u * 3.6, k.pc, (1 - u) * 0.95);
    k.ring(11, pad, 0.7 + u * 3.4, k.hot, (1 - u) * 0.6);
    for (let c = 0; c < 7; c++) {
      let a = (c / 7) * TWO + 0.3, r = 0.7;
      let prev = k.v(1).set(pad.x + Math.cos(a) * r, 0.42, pad.z + Math.sin(a) * r);
      for (let s = 1; s <= 2; s++) {
        r = 0.7 + s * u * 1.4; a += s % 2 ? 0.2 : -0.2;
        const next = k.v(2 + s).set(pad.x + Math.cos(a) * r, 0.42, pad.z + Math.sin(a) * r);
        k.bar(20 + c * 2 + s - 1, prev, next, 0.05, k.hot, (1 - u) * 0.9);
        prev = next;
      }
    }
    if (u < 0.05) k.out.shake = 1;
  },
  // TAILWIND: three ribbons helix round the hull
  astravane(u, k) {
    for (let s = 0; s < 3; s++) {
      for (let j = 0; j < 6; j++) {
        const a = (s / 3) * TWO + u * 7 - j * 0.28;
        const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * 1.7).addScaledVector(k.R, Math.sin(a) * 1.7).addScaledVector(k.U, -0.4 + j * 0.12 + u * 0.6);
        k.spr(30 + s * 6 + j, at, 0.32 - j * 0.03, k.pc, bell(u) * (1 - j / 7));
      }
    }
  },
  // HALO GEAR: a toothed ring turns over the hull
  ironhalo(u, k) {
    const c = k.v(0).copy(k.P).addScaledVector(k.U, 1.1);
    k.ring(10, c, 1.3, k.pc, bell(u));
    for (let t = 0; t < 12; t++) {
      const a = (t / 12) * TWO + u * 2.4;
      const o = k.v(1).copy(c).addScaledVector(k.F, Math.cos(a) * 1.3).addScaledVector(k.R, Math.sin(a) * 1.3);
      k.bar(20 + t, o, k.v(2).copy(o).addScaledVector(k.U, 0.18), 0.14, k.hot, bell(u));
    }
  },
  // RUNE RING: glyphs circle the hull, rising and falling
  runepilot(u, k) {
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * TWO - u * 1.8;
      const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * 2.1).addScaledVector(k.R, Math.sin(a) * 2.1).addScaledVector(k.U, 0.4 + Math.sin(u * 6 + r) * 0.25);
      k.rune(r, at, 0.55, k.pc, bell(u));
    }
  },
  // TWIN TAILS sweep round behind
  nebulafox(u, k) {
    for (let side = -1; side <= 1; side += 2) {
      for (let j = 0; j < 9; j++) {
        const a = Math.PI + side * (0.3 + u * 1.3) - side * j * 0.11;
        const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * 1.9).addScaledVector(k.R, Math.sin(a) * 1.9).addScaledVector(k.U, 0.2);
        k.spr(30 + (side > 0 ? 9 : 0) + j, at, 0.5 - j * 0.03, k.pc, bell(u) * (1 - j / 10));
      }
    }
  },
  // LANCES thrown out along the nose
  javelin9(u, k) {
    for (let l = 0; l < 5; l++) {
      const spread = (l - 2) * 0.12;
      const d = k.v(0).copy(k.F).addScaledVector(k.R, spread).normalize();
      const s0 = k.nose + 0.3 + u * 9;
      k.bar(20 + l, k.v(1).copy(k.P).addScaledVector(d, s0), k.v(2).copy(k.P).addScaledVector(d, s0 + 1.6), 0.035, k.hot, 1 - u);
    }
  },
  // CANNON: a beam straight off the nose
  atlasbeam(u, k) {
    const a = clamp01(1 - u * 1.3);
    const from = k.v(0).copy(k.P).addScaledVector(k.F, k.nose + 0.2), to = k.v(1).copy(k.P).addScaledVector(k.F, k.nose + 14);
    k.bar(20, from, to, 0.32 * a, k.pc, a * 0.6);
    k.bar(21, from, to, 0.1 * a, k.hot, a);
    k.spr(30, from, 1.2 * a + 0.2, k.hot, a);
  },
  // GLITCH: slices flicker round the hull, and the hull itself jitters
  glitchprince(u, k) {
    for (let g = 0; g < 9; g++) {
      const y = -0.5 + Math.random() * 1.6, off = (Math.random() - 0.5) * 2.4, len = 0.5 + Math.random() * 1.4;
      const a = k.v(0).copy(k.P).addScaledVector(k.U, y).addScaledVector(k.F, off);
      k.bar(20 + g, a, k.v(1).copy(a).addScaledVector(k.R, len * (g % 2 ? 1 : -1)), 0.06, g % 2 ? k.pc : k.hot, (1 - u) * 0.8);
    }
    k.out.jitter = (1 - u) * 0.12;
  },
  // CORONA: a sun behind the hull, rays turning
  solstice(u, k) {
    k.spr(30, k.v(0).copy(k.P).addScaledVector(k.U, 0.2), 3 + u, k.pc, bell(u) * 0.35);
    for (let r = 0; r < 16; r++) {
      const a = (r / 16) * TWO + u, d = k.v(1).copy(k.U).multiplyScalar(Math.cos(a)).addScaledVector(k.R, Math.sin(a));
      const len = r % 2 ? 1.6 : 2.1;
      k.bar(20 + r, k.v(2).copy(k.P).addScaledVector(d, 1.2), k.v(3).copy(k.P).addScaledVector(d, len + u * 0.5), 0.04, k.hot, bell(u) * 0.9);
    }
  },
  // WISPS drift up off the hull
  crimsonwisp(u, k) {
    for (let w = 0; w < 10; w++) {
      const a = (w / 10) * TWO, rise = clamp01(u * 1.3 - (w % 3) * 0.1);
      const at = k.v(0).copy(k.P).addScaledVector(k.F, Math.cos(a) * (0.8 + rise * 0.6) + Math.sin(u * 8 + w) * 0.15).addScaledVector(k.R, Math.sin(a) * (0.8 + rise * 0.6)).addScaledVector(k.U, rise * 2.4);
      k.spr(30 + w, at, 0.45, w % 2 ? k.pc : k.hot, (1 - rise) * 0.9, 0, 0.55);
    }
  },
  // NEON: rings and speed lines streaking back
  voltrider(u, k) {
    k.ring(10, k.P, 1 + u * 2.4, k.pc, (1 - u) * 0.9);
    k.ring(11, k.P, 1.4 + u * 3.4, k.hot, (1 - u) * 0.6);
    for (let s = 0; s < 5; s++) {
      const off = (s - 2) * 0.28;
      const a = k.v(0).copy(k.P).addScaledVector(k.R, off).addScaledVector(k.U, (s % 2) * 0.2).addScaledVector(k.F, -0.8);
      k.bar(20 + s, a, k.v(1).copy(a).addScaledVector(k.F, -(1.2 + u * 3)), 0.035, k.hot, 1 - u);
    }
  },
};

export const SHOW_DRONES = Object.keys(DRONE_MOVES);
export const SHOW_PILOTS = Object.keys(PILOT_TOUCH);

/** three little glyphs for the Rune Pilot */
function runeTextures(T: Three) {
  const glyphs: Array<(c: CanvasRenderingContext2D) => void> = [
    (c) => { c.moveTo(32, 10); c.lineTo(32, 54); c.moveTo(18, 24); c.lineTo(46, 12); },
    (c) => { c.moveTo(16, 52); c.lineTo(32, 12); c.lineTo(48, 52); c.moveTo(22, 38); c.lineTo(42, 38); },
    (c) => { c.moveTo(18, 12); c.lineTo(46, 32); c.lineTo(18, 52); c.moveTo(18, 32); c.lineTo(34, 32); },
  ];
  return glyphs.map((g) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d')!;
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = '#ffffff'; c.shadowBlur = 8;
    c.beginPath(); g(c); c.stroke();
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  });
}

export function createSyncShow(T: Three, scene: THREE_NS.Scene, glowTex: THREE_NS.Texture) {
  const trash: Array<{ dispose(): void }> = [];
  const keep = <X extends { dispose(): void }>(x: X) => { trash.push(x); return x; };
  const add = (o: THREE_NS.Object3D) => { o.visible = false; scene.add(o); return o; };
  const additive = { transparent: true, depthWrite: false, blending: T.AdditiveBlending } as const;

  const sprites: THREE_NS.Sprite[] = [];
  for (let i = 0; i < 48; i++) sprites.push(add(new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, ...additive })))) as THREE_NS.Sprite);
  const runeTex = runeTextures(T).map(keep);
  const runes: THREE_NS.Sprite[] = [];
  for (let i = 0; i < 8; i++) runes.push(add(new T.Sprite(keep(new T.SpriteMaterial({ map: runeTex[i % runeTex.length], ...additive })))) as THREE_NS.Sprite);
  const barGeo = keep(new T.BoxGeometry(1, 1, 1));
  const bars: THREE_NS.Mesh[] = [];
  for (let i = 0; i < 36; i++) bars.push(add(new T.Mesh(barGeo, keep(new T.MeshBasicMaterial({ ...additive })))) as THREE_NS.Mesh);
  const ringGeo = keep(new T.TorusGeometry(1, 0.035, 6, 72));
  const rings: THREE_NS.Mesh[] = [];
  for (let i = 0; i < 12; i++) rings.push(add(new T.Mesh(ringGeo, keep(new T.MeshBasicMaterial({ ...additive, side: T.DoubleSide })))) as THREE_NS.Mesh);
  // a torus with six sides is a hexagon
  const hexGeo = keep(new T.TorusGeometry(1, 0.09, 3, 6));
  const hexes: THREE_NS.Mesh[] = [];
  for (let i = 0; i < 14; i++) hexes.push(add(new T.Mesh(hexGeo, keep(new T.MeshBasicMaterial({ ...additive, side: T.DoubleSide })))) as THREE_NS.Mesh);
  // ghost planes: clones of the plane in one see-through material each
  const ghosts: Array<{ g: THREE_NS.Object3D; mat: THREE_NS.MeshBasicMaterial } | null> = [null, null, null, null, null, null];
  let ghostSource: THREE_NS.Object3D | null = null;

  const vs = Array.from({ length: 12 }, () => new T.Vector3());
  const P = new T.Vector3(), F = new T.Vector3(), R = new T.Vector3(), U = new T.Vector3(0, 1, 0);
  const q = new T.Quaternion();
  const yAxis = new T.Vector3(0, 1, 0);
  const tmp = new T.Vector3();
  const pc = new T.Color(), hot = new T.Color(), dc = new T.Color();

  let move: ((u: number, k: Kit) => void) | null = null;
  let touch: ((u: number, k: Kit) => void) | null = null;
  let t = -1;

  function clearGhosts() {
    ghosts.forEach((gh, i) => { if (gh) { scene.remove(gh.g); gh.mat.dispose(); ghosts[i] = null; } });
  }

  const kit: Kit = {
    P, F, R, U, nose: 2, pc, hot, dc,
    out: { drone: null, jitter: 0, shake: 0 },
    v: (i) => vs[i],
    spr(i, at, size, c, a, rot = 0, sx = 1) {
      const s = sprites[i]; if (!s || a <= 0.01) return;
      s.visible = true; s.position.copy(at); s.scale.set(size, size * sx, 1);
      const m = s.material as THREE_NS.SpriteMaterial; m.color.copy(c); m.opacity = Math.min(1, a); m.rotation = rot;
    },
    rune(i, at, size, c, a) {
      const s = runes[i]; if (!s || a <= 0.01) return;
      s.visible = true; s.position.copy(at); s.scale.set(size, size, 1);
      const m = s.material as THREE_NS.SpriteMaterial; m.color.copy(c); m.opacity = Math.min(1, a);
    },
    bar(i, from, to, thick, c, a) {
      const b = bars[i]; if (!b || a <= 0.01 || thick <= 0.001) return;
      tmp.copy(to).sub(from);
      const len = tmp.length(); if (len < 1e-4) return;
      b.visible = true;
      b.position.copy(from).addScaledVector(tmp, 0.5);
      b.quaternion.setFromUnitVectors(yAxis, tmp.divideScalar(len));
      b.scale.set(thick, len, thick);
      const m = b.material as THREE_NS.MeshBasicMaterial; m.color.copy(c); m.opacity = Math.min(1, a);
    },
    ring(i, at, r, c, a, upright = false) {
      const o = rings[i]; if (!o || a <= 0.01) return;
      o.visible = true; o.position.copy(at); o.scale.setScalar(r);
      o.rotation.set(upright ? 0 : Math.PI / 2, 0, 0);
      const m = o.material as THREE_NS.MeshBasicMaterial; m.color.copy(c); m.opacity = Math.min(1, a);
    },
    hex(i, at, r, c, a, face) {
      const o = hexes[i]; if (!o || a <= 0.01) return;
      o.visible = true; o.position.copy(at); o.scale.setScalar(r); o.lookAt(face);
      const m = o.material as THREE_NS.MeshBasicMaterial; m.color.copy(c); m.opacity = Math.min(1, a);
    },
    ghost(i, offset, a, c) {
      if (!ghostSource || a <= 0.01) return;
      let gh = ghosts[i];
      if (!gh) {
        const mat = new T.MeshBasicMaterial({ ...additive, color: c, opacity: 0.4 });
        const g = ghostSource.clone(true);
        g.traverse((o) => { const m = o as THREE_NS.Mesh; if (m.isMesh) m.material = mat; if ((o as THREE_NS.Sprite).isSprite) o.visible = false; });
        g.matrixAutoUpdate = false;
        scene.add(g);
        gh = ghosts[i] = { g, mat };
      }
      gh.g.visible = true;
      gh.g.matrix.copy(ghostSource.matrixWorld);
      gh.g.matrix.elements[12] += offset.x; gh.g.matrix.elements[13] += offset.y; gh.g.matrix.elements[14] += offset.z;
      // additive copies of a lit hull stack to white where they overlap it,
      // so a ghost is a dim, tinted echo rather than a second plane
      gh.mat.color.copy(c).multiplyScalar(0.55); gh.mat.opacity = Math.min(0.35, a);
    },
  };

  function hideAll() {
    sprites.forEach((s) => { s.visible = false; });
    runes.forEach((s) => { s.visible = false; });
    bars.forEach((b) => { b.visible = false; });
    rings.forEach((r) => { r.visible = false; });
    hexes.forEach((h) => { h.visible = false; });
    ghosts.forEach((g) => { if (g) g.g.visible = false; });
  }

  return {
    /** start the show for this pair; false when either half is unknown */
    play(pilotId: string, droneId: string, pilotHue: number) {
      move = DRONE_MOVES[droneId] || null;
      touch = PILOT_TOUCH[pilotId] || null;
      if (!move && !touch) return false;
      pc.setHSL(pilotHue / 360, 1, 0.6);
      hot.setHSL(pilotHue / 360, 1, 0.82);
      dc.set(DRONE_TINTS[droneId] || '#35e8ff').lerp(pc, 0.3);
      clearGhosts();
      t = 0;
      return true;
    },
    /** advance the show; returns what the bay should do with the drone and the hull */
    update(dt: number, plane: THREE_NS.Object3D, nose: number) {
      kit.out.drone = null; kit.out.jitter = 0; kit.out.shake = 0;
      hideAll();
      if (t < 0) return null;
      t += dt;
      if (t > SHOW_TIME) { t = -1; clearGhosts(); return null; }
      plane.updateWorldMatrix(true, false);
      plane.getWorldPosition(P);
      plane.getWorldQuaternion(q);
      F.set(1, 0, 0).applyQuaternion(q); F.y = 0; F.normalize();
      R.crossVectors(F, U).normalize();
      kit.nose = nose;
      ghostSource = plane;
      if (move) move(clamp01(t / 1.6), kit);
      if (touch) touch(clamp01((t - 0.25) / 1.6), kit);
      return kit.out;
    },
    active: () => t >= 0,
    stop() { t = -1; hideAll(); clearGhosts(); },
    dispose() { hideAll(); clearGhosts(); trash.forEach((d) => d.dispose()); },
  };
}
