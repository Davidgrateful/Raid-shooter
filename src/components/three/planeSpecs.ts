/*==============================================================================
Plane specs - the 13 pilots as 3D part lists

The same airframes as the 2D art (public/game/art.js), described as parts the
3D bay extrudes and assembles. Units are the hull radius; +x is the nose and
+z is the plane's left side in the bay (the 2D art's +y).

  plate   a flat outline (half-points, nose -> tail, mirrored) extruded to h
  path    the same, for an outline with curves (Crimson Wisp's gull wing)
  fin     a vertical tail fin from x0 to x1, h tall, at z (cant tilts it)
  pod     an ellipsoid - engine nacelles, wingtip pods, tail booms
  barrel  a gun barrel along x
  canopy  the glass dome over the cockpit (glow tints it)
  nozzle  an engine exhaust with a glow sprite
  muzzle  a charge glow at a gun's tip
  ring    Iron Halo's annular wing, and struts brace it
  prop    a propeller disc and blade
  glyphs  Rune Pilot's orbiting glyphs
  shard   Glitch Prince's jumping sliver
  flame   a trailing flame cone (Crimson Wisp, Rider)
==============================================================================*/

export type Pt = [number, number];

export interface ShapeLike {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
}

export type Part =
  | { t: 'plate'; p: Pt[]; h: number; y: number; m: 'hull' | 'wing'; round?: number; facet?: number }
  | { t: 'path'; h: number; y: number; m: 'hull' | 'wing'; draw: (s: ShapeLike) => void }
  | { t: 'fin'; x0: number; x1: number; h: number; z: number; y?: number; cant?: number }
  | { t: 'pod'; x: number; z: number; y?: number; len: number; rad: number; m?: 'hull' | 'wing' | 'grey' | 'dark' }
  | { t: 'barrel'; x0: number; x1: number; rad: number; y?: number; m?: 'hull' | 'wing' | 'grey' | 'dark' }
  | { t: 'canopy'; x: number; len: number; w: number; ht: number; glow?: string }
  | { t: 'nozzle'; x: number; z: number; y?: number; s: number; hue: number }
  | { t: 'muzzle'; x: number; y: number; s: number }
  | { t: 'ring'; x: number; R: number; tube: number; y: number }
  | { t: 'struts'; x: number; R: number; y: number }
  | { t: 'prop'; x: number; z: number; y: number; R: number }
  | { t: 'glyphs'; R: number }
  | { t: 'shard' }
  | { t: 'flame'; x: number; len: number; w: number; hue: number };

// Crimson Wisp's gull wing has real curves, so it is a path, not a plate
const CRIMSON_WING: Part = {
  t: 'path', h: 0.12, y: 0.08, m: 'wing',
  draw(s) {
    s.moveTo(1.75, 0);
    for (const k of [1, -1]) {
      s.lineTo(0.9, k * 0.24);
      s.lineTo(0.35, k * 0.3);
      s.quadraticCurveTo(0.3, k * 1.15, -0.85, k * 1.5);
      s.quadraticCurveTo(-0.55, k * 0.85, -0.75, k * 0.32);
      s.lineTo(-1.15, k * 0.26);
      s.lineTo(-1.25, 0);
    }
  },
};

export const PLANE_SPECS: Record<string, Part[]> = {
  onyix: [
    { t: 'plate', p: [[2, 0], [1.7, 0.1], [1.15, 0.2], [0.4, 0.27], [-0.9, 0.3], [-1.6, 0.22], [-1.78, 0.17], [-1.78, 0]], h: 0.42, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.25, 0.28], [-0.55, 1.3], [-0.85, 1.3], [-0.8, 0.28], [-0.8, 0]], h: 0.08, y: 0.12, m: 'wing' },
    { t: 'plate', p: [[-1.25, 0.25], [-1.45, 0.75], [-1.68, 0.75], [-1.62, 0.2], [-1.62, 0]], h: 0.06, y: 0.14, m: 'wing' },
    { t: 'fin', x0: -0.95, x1: -1.72, h: 0.75, z: 0 },
    { t: 'canopy', x: 1.05, len: 0.42, w: 0.15, ht: 0.2, glow: 'hsl(45, 100%, 62%)' },
    { t: 'nozzle', x: -1.82, z: 0, s: 0.15, hue: 35 },
  ],
  nova: [
    { t: 'plate', p: [[2.4, 0], [1.5, 0.12], [0.5, 0.2], [-1.3, 0.2], [-1.52, 0.12], [-1.52, 0]], h: 0.34, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.5, 0.2], [-0.55, 1.05], [-0.85, 1.05], [-0.8, 0.22], [-0.8, 0]], h: 0.07, y: 0.1, m: 'wing' },
    { t: 'plate', p: [[-1.2, 0.2], [-1.35, 0.5], [-1.55, 0.5], [-1.5, 0.12], [-1.5, 0]], h: 0.05, y: 0.12, m: 'wing' },
    { t: 'fin', x0: -0.95, x1: -1.55, h: 0.55, z: 0.17, cant: 0.25 },
    { t: 'fin', x0: -0.95, x1: -1.55, h: 0.55, z: -0.17, cant: -0.25 },
    { t: 'canopy', x: 1.25, len: 0.38, w: 0.11, ht: 0.17 },
    { t: 'nozzle', x: -1.58, z: 0.1, s: 0.1, hue: 195 },
    { t: 'nozzle', x: -1.58, z: -0.1, s: 0.1, hue: 195 },
  ],
  tankrex: [
    { t: 'plate', p: [[1.55, 0], [1.4, 0.22], [0.9, 0.34], [-0.9, 0.3], [-1.45, 0.18], [-1.5, 0]], h: 0.5, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.45, 0.3], [0.38, 1.6], [0, 1.62], [-0.15, 0.3], [-0.15, 0]], h: 0.1, y: 0.1, m: 'wing' },
    { t: 'plate', p: [[-1.05, 0.2], [-1.05, 0.95], [-1.35, 0.95], [-1.35, 0.2], [-1.35, 0]], h: 0.07, y: 0.3, m: 'wing' },
    { t: 'fin', x0: -1, x1: -1.48, h: 0.6, z: 0.95, y: 0.3 },
    { t: 'fin', x0: -1, x1: -1.48, h: 0.6, z: -0.95, y: 0.3 },
    { t: 'pod', x: -0.6, z: 0.5, y: 0.62, len: 0.45, rad: 0.21, m: 'grey' },
    { t: 'pod', x: -0.6, z: -0.5, y: 0.62, len: 0.45, rad: 0.21, m: 'grey' },
    { t: 'barrel', x0: 1.45, x1: 1.88, rad: 0.05, y: 0.12, m: 'dark' },
    { t: 'canopy', x: 0.95, len: 0.3, w: 0.16, ht: 0.22 },
    { t: 'nozzle', x: -1.07, z: 0.5, y: 0.62, s: 0.12, hue: 30 },
    { t: 'nozzle', x: -1.07, z: -0.5, y: 0.62, s: 0.12, hue: 30 },
  ],
  astravane: [
    { t: 'plate', p: [[2, 0], [1.4, 0.14], [0.6, 0.22], [-1.2, 0.26], [-1.62, 0.14], [-1.62, 0]], h: 0.36, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[-0.2, 0.26], [0.15, 1.25], [-0.15, 1.32], [-0.95, 0.28], [-0.95, 0]], h: 0.07, y: 0.11, m: 'wing' },
    { t: 'plate', p: [[0.95, 0.18], [0.7, 0.52], [0.5, 0.52], [0.55, 0.18], [0.55, 0]], h: 0.05, y: 0.14, m: 'wing' },
    { t: 'plate', p: [[-1.2, 0.26], [-1.5, 0.55], [-1.7, 0.55], [-1.62, 0.14], [-1.62, 0]], h: 0.05, y: 0.12, m: 'wing' },
    { t: 'fin', x0: -1, x1: -1.66, h: 0.6, z: 0 },
    { t: 'canopy', x: 1.15, len: 0.36, w: 0.12, ht: 0.17 },
    { t: 'nozzle', x: -1.68, z: 0, s: 0.12, hue: 190 },
  ],
  ironhalo: [
    { t: 'plate', p: [[1.9, 0], [1.5, 0.2], [0.8, 0.32], [-1, 0.3], [-1.45, 0.2], [-1.55, 0]], h: 0.46, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[-0.9, 0.25], [-1.25, 0.62], [-1.5, 0.62], [-1.35, 0.22], [-1.35, 0]], h: 0.06, y: 0.15, m: 'wing' },
    { t: 'fin', x0: -0.9, x1: -1.52, h: 0.6, z: 0 },
    { t: 'ring', x: -0.05, R: 1.02, tube: 0.13, y: 0.2 },
    { t: 'struts', x: -0.05, R: 1, y: 0.2 },
    { t: 'canopy', x: 1.05, len: 0.38, w: 0.17, ht: 0.22 },
    { t: 'nozzle', x: -1.6, z: 0, s: 0.15, hue: 200 },
  ],
  runepilot: [
    { t: 'plate', p: [[1.15, 0], [0.9, 0.18], [-0.45, 1.55], [-0.72, 1.5], [-0.55, 1.1], [-0.82, 0.78], [-0.58, 0.46], [-0.86, 0.16], [-0.75, 0]], h: 0.16, y: 0.05, m: 'wing', round: 1 },
    { t: 'plate', p: [[1, 0], [0.6, 0.2], [-0.6, 0.26], [-0.8, 0]], h: 0.36, y: 0, m: 'hull', round: 1 },
    { t: 'canopy', x: 0.55, len: 0.26, w: 0.1, ht: 0.17 },
    { t: 'nozzle', x: -0.72, z: 0.3, s: 0.09, hue: 270 },
    { t: 'nozzle', x: -0.72, z: -0.3, s: 0.09, hue: 270 },
    { t: 'glyphs', R: 1.9 },
  ],
  nebulafox: [
    { t: 'plate', p: [[0.35, 0.2], [0.25, 1.45], [-0.12, 1.5], [-0.15, 0.2], [-0.15, 0]], h: 0.08, y: 0.14, m: 'wing' },
    { t: 'plate', p: [[1.55, 0], [1.2, 0.2], [0.4, 0.26], [-0.55, 0.2], [-0.7, 0]], h: 0.4, y: 0, m: 'hull', round: 1 },
    { t: 'pod', x: -0.35, z: 0.62, y: 0.17, len: 1.25, rad: 0.15, m: 'hull' },
    { t: 'pod', x: -0.35, z: -0.62, y: 0.17, len: 1.25, rad: 0.15, m: 'hull' },
    { t: 'plate', p: [[-1.28, 0], [-1.28, 0.7], [-1.5, 0.7], [-1.5, 0]], h: 0.05, y: 0.22, m: 'wing' },
    { t: 'fin', x0: -1.15, x1: -1.62, h: 0.55, z: 0.62, y: 0.2 },
    { t: 'fin', x0: -1.15, x1: -1.62, h: 0.55, z: -0.62, y: 0.2 },
    { t: 'prop', x: 0.92, z: 0.62, y: 0.17, R: 0.42 },
    { t: 'prop', x: 0.92, z: -0.62, y: 0.17, R: 0.42 },
    { t: 'canopy', x: 0.95, len: 0.34, w: 0.14, ht: 0.2 },
  ],
  javelin9: [
    { t: 'plate', p: [[2.7, 0], [1.7, 0.1], [0.3, 0.17], [-1.58, 0.13], [-1.66, 0.1], [-1.66, 0]], h: 0.3, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.15, 0.16], [-0.1, 0.78], [-0.38, 0.78], [-0.42, 0.16], [-0.42, 0]], h: 0.05, y: 0.1, m: 'wing' },
    { t: 'fin', x0: -1.05, x1: -1.62, h: 0.62, z: 0 },
    { t: 'plate', p: [[-1.3, 0], [-1.4, 0.52], [-1.62, 0.52], [-1.55, 0]], h: 0.04, y: 0.86, m: 'wing' },
    { t: 'barrel', x0: 2.6, x1: 3.05, rad: 0.022, y: 0.15, m: 'hull' },
    { t: 'canopy', x: 1.1, len: 0.32, w: 0.09, ht: 0.15 },
    { t: 'nozzle', x: -1.7, z: 0, s: 0.11, hue: 205 },
  ],
  atlasbeam: [
    { t: 'plate', p: [[1.45, 0], [1.3, 0.3], [0.6, 0.4], [-1.1, 0.34], [-1.55, 0.15], [-1.6, 0]], h: 0.56, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.4, 0.32], [0.22, 1.75], [-0.12, 1.75], [-0.25, 0.32], [-0.25, 0]], h: 0.1, y: 0.42, m: 'wing' },
    { t: 'plate', p: [[-1.1, 0.25], [-1.25, 0.9], [-1.5, 0.9], [-1.45, 0.2], [-1.45, 0]], h: 0.06, y: 0.4, m: 'wing' },
    { t: 'fin', x0: -0.95, x1: -1.58, h: 0.8, z: 0, y: 0.35 },
    { t: 'pod', x: 0.4, z: 0.72, y: 0.36, len: 0.32, rad: 0.12, m: 'grey' },
    { t: 'pod', x: 0.4, z: -0.72, y: 0.36, len: 0.32, rad: 0.12, m: 'grey' },
    { t: 'pod', x: 0.4, z: 1.25, y: 0.36, len: 0.32, rad: 0.12, m: 'grey' },
    { t: 'pod', x: 0.4, z: -1.25, y: 0.36, len: 0.32, rad: 0.12, m: 'grey' },
    { t: 'barrel', x0: 1.3, x1: 1.94, rad: 0.09, y: 0.22, m: 'dark' },
    { t: 'muzzle', x: 2, y: 0.22, s: 0.17 },
    { t: 'canopy', x: 0.95, len: 0.26, w: 0.2, ht: 0.25 },
  ],
  glitchprince: [
    { t: 'plate', p: [[1.75, 0], [-0.75, 1.2], [-0.95, 1.05], [-0.72, 0.55], [-1.05, 0.42], [-1.3, 0.7], [-1.42, 0.62], [-1.12, 0.18], [-1.18, 0]], h: 0.14, y: 0.06, m: 'wing', facet: 1 },
    { t: 'plate', p: [[1.45, 0], [0.3, 0.36], [-0.9, 0.3], [-1.1, 0]], h: 0.24, y: 0.12, m: 'hull', facet: 1 },
    { t: 'fin', x0: -0.85, x1: -1.38, h: 0.5, z: 0.32, cant: 0.6 },
    { t: 'fin', x0: -0.85, x1: -1.38, h: 0.5, z: -0.32, cant: -0.6 },
    { t: 'canopy', x: 0.75, len: 0.3, w: 0.11, ht: 0.12, glow: 'hsl(220, 60%, 55%)' },
    { t: 'shard' },
  ],
  solstice: [
    { t: 'plate', p: [[2.15, 0], [1.6, 0.13], [1, 0.2], [-1.2, 0.27], [-1.42, 0.24], [-1.46, 0]], h: 0.36, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.2, 0.26], [-1, 1.28], [-1.22, 1.28], [-1.1, 0.3], [-1.1, 0]], h: 0.07, y: 0.1, m: 'wing' },
    { t: 'plate', p: [[1.1, 0.18], [0.9, 0.5], [0.72, 0.5], [0.78, 0.18], [0.78, 0]], h: 0.05, y: 0.15, m: 'wing' },
    { t: 'fin', x0: -0.75, x1: -1.42, h: 0.65, z: 0 },
    { t: 'canopy', x: 1.3, len: 0.38, w: 0.12, ht: 0.17 },
    { t: 'nozzle', x: -1.5, z: 0.12, s: 0.11, hue: 35 },
    { t: 'nozzle', x: -1.5, z: -0.12, s: 0.11, hue: 35 },
  ],
  crimsonwisp: [
    CRIMSON_WING,
    { t: 'plate', p: [[1.75, 0], [0.9, 0.22], [-0.9, 0.24], [-1.22, 0]], h: 0.34, y: 0, m: 'hull', round: 1 },
    { t: 'fin', x0: -0.7, x1: -1.2, h: 0.5, z: 0 },
    { t: 'canopy', x: 0.95, len: 0.34, w: 0.13, ht: 0.18 },
    { t: 'flame', x: -1.25, len: 0.8, w: 0.32, hue: 10 },
  ],
  voltrider: [
    { t: 'plate', p: [[1.95, 0], [1.75, 0.2], [1.1, 0.33], [0.2, 0.32], [-1, 0.17], [-1.32, 0]], h: 0.44, y: 0, m: 'hull', round: 1 },
    { t: 'plate', p: [[0.55, 0.28], [0.35, 1.18], [0, 1.2], [-0.25, 0.28], [-0.25, 0]], h: 0.08, y: 0.04, m: 'wing' },
    { t: 'plate', p: [[-0.95, 0.18], [-1.1, 0.55], [-1.3, 0.55], [-1.25, 0.15], [-1.25, 0]], h: 0.05, y: 0.16, m: 'wing' },
    { t: 'fin', x0: -0.85, x1: -1.32, h: 0.55, z: 0 },
    { t: 'pod', x: 0.2, z: 1.2, y: 0.08, len: 0.34, rad: 0.12, m: 'hull' },
    { t: 'pod', x: 0.2, z: -1.2, y: 0.08, len: 0.34, rad: 0.12, m: 'hull' },
    { t: 'prop', x: 2, z: 0, y: 0.22, R: 0.62 },
    { t: 'canopy', x: 0.15, len: 0.3, w: 0.13, ht: 0.22, glow: 'hsl(275, 100%, 78%)' },
    { t: 'flame', x: -1.32, len: 0.85, w: 0.45, hue: 275 },
  ],
};
