import type * as THREE_NS from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDrone, DRONE_IDS, DRONE_TINTS } from './droneModels';

/*==============================================================================
The arena's objects, rendered from real 3D models

Rock, ice, crystal, crate, satellite, fuel and mine (public/game/objects.js)
are modelled here, lit (a key light from the upper left like every 2D drawing
in the game, plus a studio environment for reflections) and rendered ONCE,
straight down, into sprite sheets. The fight itself stays 2D: the engine draws
a sheet's frame where it used to draw a flat shape, so a run costs exactly
what it did before, on any phone.

Spin without wrong light: an object that turns in the plane gets FRAMES views
baked with the model turned and the light held still. The engine picks the
nearest view and rotates it the last few degrees itself, so the highlight
always sits on the upper left however the rock turns.

Nothing here rolls Math.random (a seeded raid's dice); shapes come from a
noise function keyed on the variant, and three's own uses of Math.random are
fenced off by the caller (ArenaObjects3D.tsx).
==============================================================================*/

type Three = typeof THREE_NS;

export interface SpriteSheet {
  canvas: HTMLCanvasElement;
  /** one cell's side, backing-store pixels */
  cell: number;
  cols: number;
  variants: number;
  frames: number;
  /** the radius (CSS px) a cell was rendered for, and the cell's side in CSS px */
  ref: number;
  css: number;
}

interface KindSpec { variants: number; frames: number; ref: number; ext: number; drone?: boolean }

/** ref = the kind's largest radius; ext = the cell's half-side over the radius
 * (room for satellite panels, mine spikes and the soft shadow) */
export const KIND_SPECS: Record<string, KindSpec> = {
  rock: { variants: 3, frames: 16, ref: 40, ext: 1.5 },
  ice: { variants: 2, frames: 16, ref: 32, ext: 1.5 },
  crystal: { variants: 2, frames: 16, ref: 34, ext: 1.75 },
  crate: { variants: 2, frames: 16, ref: 19, ext: 1.8 },
  satellite: { variants: 1, frames: 16, ref: 24, ext: 2.3 },
  fuel: { variants: 1, frames: 1, ref: 15, ext: 1.95 },
  mine: { variants: 1, frames: 1, ref: 12, ext: 1.95 },
  // the equipped drone, flying beside the ship ($.droneFlightRadius = 11);
  // the Needle Finch's beak reaches 1.33 radii, hence the room
  ...Object.fromEntries(DRONE_IDS.map((id) => [id, { variants: 1, frames: 16, ref: 11, ext: 1.6, drone: true }])),
};

/*--- deterministic noise ----------------------------------------------------*/
function hash3(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  ) * 2 - 1;
}
function fbm(x: number, y: number, z: number, seed: number, oct = 4) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { a += amp * vnoise(x * f, y * f, z * f, seed + i * 17); f *= 2.03; amp *= 0.5; }
  return a;
}

/*--- textures painted on a canvas -------------------------------------------*/
function canvasTex(T: Three, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void, color = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  const t = new T.CanvasTexture(c);
  if (color) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/*--- the models (unit radius, top face toward +y = toward the camera) --------*/
function lumpy(T: Three, seed: number, detail: number, o: { amp: number; freq: number; stretch: [number, number, number]; craters: number; hue: number; sat: number; light: number; mottle: number; smooth?: boolean; grain?: number }) {
  // smooth: shared vertices, so the surface shades round with fine relief
  // (rock); otherwise every face is its own flat facet (ice)
  let geo: THREE_NS.BufferGeometry = new T.IcosahedronGeometry(1, detail);
  if (o.smooth) { geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo); }
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const v = new T.Vector3();
  const col = new T.Color();
  // a few craters: bowls pressed into the surface around fixed directions
  const craters: Array<{ d: THREE_NS.Vector3; r: number; depth: number }> = [];
  for (let i = 0; i < o.craters; i++) {
    const a = hash3(i, 1, 2, seed) * Math.PI * 2, b = Math.acos(hash3(i, 3, 4, seed) * 2 - 1);
    craters.push({ d: new T.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), r: 0.25 + hash3(i, 5, 6, seed) * 0.3, depth: 0.05 + hash3(i, 7, 8, seed) * 0.07 });
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let d = 1 + o.amp * fbm(v.x * o.freq, v.y * o.freq, v.z * o.freq, seed) + o.amp * 0.35 * fbm(v.x * o.freq * 3.1, v.y * o.freq * 3.1, v.z * o.freq * 3.1, seed + 99, 3)
      + (o.grain || 0) * fbm(v.x * 11, v.y * 11, v.z * 11, seed + 313, 3);
    for (const c of craters) {
      const t = 1 - v.distanceTo(c.d) / c.r;
      if (t > 0) d -= c.depth * Math.sin(t * Math.PI * 0.5) - (t < 0.25 ? c.depth * 0.5 * (0.25 - t) * 4 : 0);
    }
    const m = fbm(v.x * 4, v.y * 4, v.z * 4, seed + 7, 3);
    col.setHSL(o.hue / 360, o.sat, Math.max(0.05, o.light + m * o.mottle + (d - 1) * 0.35));
    cols.set([col.r, col.g, col.b], i * 3);
    v.multiplyScalar(d);
    pos.setXYZ(i, v.x * o.stretch[0], v.y * o.stretch[1], v.z * o.stretch[2]);
  }
  geo.setAttribute('color', new T.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildModel(T: Three, kind: string, variant: number, keep: <X extends { dispose(): void }>(x: X) => X): THREE_NS.Object3D {
  const tint = DRONE_TINTS[kind];
  if (tint) {
    // a drone: its own model (droneModels.ts), posed mid-motion so the motes
    // and the coil arc are in place
    const d = keep(buildDrone(T, kind, tint));
    d.anim(0.4);
    return d.group;
  }
  const g = new T.Group();
  const seed = 1000 + variant * 7919 + kind.length * 31;
  const add = (geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material) => { const m = new T.Mesh(keep(geo), keep(mat)); g.add(m); return m; };

  if (kind === 'rock') {
    const stretch: [number, number, number][] = [[1.12, 0.78, 0.92], [0.95, 0.85, 1.12], [1.05, 0.9, 1.0]];
    add(lumpy(T, seed, 6, { amp: 0.34, freq: 1.3, stretch: stretch[variant % 3], craters: 7, hue: 26, sat: 0.16, light: 0.14, mottle: 0.06, smooth: true, grain: 0.05 }),
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.25 }));
    g.rotation.set(0.5 + variant, variant * 1.7, 0.3);
  } else if (kind === 'ice') {
    add(lumpy(T, seed, 1, { amp: 0.42, freq: 1.0, stretch: [1.08, 0.8, 0.95], craters: 0, hue: 198, sat: 0.75, light: 0.5, mottle: 0.1 }),
      new T.MeshPhysicalMaterial({ vertexColors: true, flatShading: true, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.78, envMapIntensity: 1.2, emissive: new T.Color('hsl(202, 85%, 16%)') }));
    // a frosted core shows through the clear outer shell
    add(lumpy(T, seed + 3, 1, { amp: 0.3, freq: 1.4, stretch: [0.62, 0.5, 0.55], craters: 0, hue: 205, sat: 0.4, light: 0.85, mottle: 0.05 }),
      new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, transparent: true, opacity: 0.55 }));
    g.rotation.set(0.4, variant * 2.1, 0.6);
  } else if (kind === 'crystal') {
    const mat = new T.MeshPhysicalMaterial({ color: 'hsl(282, 62%, 50%)', emissive: new T.Color('hsl(288, 95%, 34%)'), emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.05, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.92, envMapIntensity: 1.4 });
    keep(mat);
    const shard = (len: number, w: number, x: number, z: number, ang: number, tilt: number) => {
      const body = new T.CylinderGeometry(w, w * 1.05, len, 6);
      const tip = new T.ConeGeometry(w, w * 1.6, 6);
      tip.translate(0, len / 2 + w * 0.8, 0);
      const base = new T.ConeGeometry(w * 1.05, w * 0.9, 6);
      base.rotateX(Math.PI); base.translate(0, -len / 2 - w * 0.45, 0);
      const s = new T.Group();
      for (const geo of [body, tip, base]) s.add(new T.Mesh(keep(geo), mat));
      // lying in the plane, pointing up the screen (-z), tipped toward the camera
      s.rotation.set(-Math.PI / 2 + tilt, 0, 0);
      const holder = new T.Group();
      holder.add(s); holder.rotation.y = ang; holder.position.set(x, 0, z);
      g.add(holder);
    };
    shard(1.5, 0.36, 0, 0.1, 0, 0.35);
    shard(0.9, 0.24, 0.42, 0.35, -0.7 - variant * 0.2, 0.25);
    shard(0.75, 0.2, -0.4, 0.4, 0.8 + variant * 0.25, 0.2);
  } else if (kind === 'crate') {
    const hue = variant ? 205 : 32;
    const panel = canvasTex(T, 256, 256, (c) => {
      c.fillStyle = `hsl(${hue}, ${variant ? 18 : 48}%, ${variant ? 40 : 36}%)`; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(0,0,0,${0.03 + (i % 7) * 0.006})`; c.fillRect((i * 97) % 256, (i * 53) % 256, 2, 1); }
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 14; c.strokeRect(7, 7, 242, 242);
      c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 3; c.strokeRect(16, 16, 224, 224);
      c.lineWidth = 16; c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.moveTo(20, 20); c.lineTo(236, 236); c.moveTo(236, 20); c.lineTo(20, 236); c.stroke();
      c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.beginPath(); c.moveTo(24, 18); c.lineTo(238, 232); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (const [x, y] of [[18, 18], [238, 18], [18, 238], [238, 238], [128, 18], [128, 238], [18, 128], [238, 128]]) { c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = variant ? 'hsl(45, 90%, 55%)' : 'rgba(20,12,4,0.7)';
      c.fillRect(150, 196, 70, 14);
    });
    const glow = canvasTex(T, 256, 256, (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256);
      const gr = c.createRadialGradient(196, 60, 0, 196, 60, 16); gr.addColorStop(0, '#9dffb8'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(170, 34, 52, 52);
    });
    keep(panel); keep(glow);
    add(new RoundedBoxGeometry(1.85, 1.15, 1.85, 4, 0.1), new T.MeshStandardMaterial({ map: panel, roughness: 0.55, metalness: 0.45, emissiveMap: glow, emissive: new T.Color('#ffffff'), emissiveIntensity: 1.2 }));
    g.rotation.set(0.28, 0.4 + variant, -0.18);
  } else if (kind === 'satellite') {
    const foil = canvasTex(T, 128, 128, (c) => {
      c.fillStyle = '#c99a3c'; c.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(${i % 2 ? 255 : 80},${i % 2 ? 220 : 50},${i % 2 ? 140 : 10},0.35)`; c.lineWidth = 1 + (i % 3); c.beginPath(); c.moveTo((i * 37) % 128, 0); c.lineTo((i * 61) % 128, 128); c.stroke(); }
    });
    const cells = canvasTex(T, 256, 128, (c) => {
      c.fillStyle = '#0d1d3d'; c.fillRect(0, 0, 256, 128);
      for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) {
        const gr = c.createLinearGradient(x * 32, y * 32, x * 32 + 32, y * 32 + 32);
        gr.addColorStop(0, '#24467f'); gr.addColorStop(1, '#0f2350');
        c.fillStyle = gr; c.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
      }
      c.strokeStyle = '#9fb3c8'; c.lineWidth = 2; c.strokeRect(1, 1, 254, 126);
    });
    keep(foil); keep(cells);
    add(new RoundedBoxGeometry(0.9, 0.75, 0.9, 2, 0.06), new T.MeshStandardMaterial({ map: foil, metalness: 1, roughness: 0.32 }));
    const panelMat = keep(new T.MeshStandardMaterial({ map: cells, metalness: 0.35, roughness: 0.4, envMapIntensity: 0.6 }));
    for (const s of [-1, 1]) {
      const p = new T.Mesh(keep(new T.BoxGeometry(1.35, 0.05, 0.74)), panelMat);
      p.position.set(s * 1.2, 0.05, 0); g.add(p);
      const strut = new T.Mesh(keep(new T.CylinderGeometry(0.04, 0.04, 0.45, 8)), keep(new T.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.3 })));
      strut.rotation.z = Math.PI / 2; strut.position.set(s * 0.6, 0.05, 0); g.add(strut);
    }
    const dish = new T.Mesh(keep(new T.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.38)), keep(new T.MeshStandardMaterial({ color: '#eef1f4', metalness: 0.2, roughness: 0.35, side: T.DoubleSide })));
    dish.rotation.x = -0.9; dish.position.set(0, 0.45, -0.42); g.add(dish);
    const beacon = new T.Mesh(keep(new T.SphereGeometry(0.07, 12, 8)), keep(new T.MeshStandardMaterial({ color: '#ff3b3b', emissive: new T.Color('#ff2020'), emissiveIntensity: 2 })));
    beacon.position.set(0, 0.42, 0.3); g.add(beacon);
    g.rotation.set(0.32, 0, 0.12);
  } else if (kind === 'fuel') {
    const paint = canvasTex(T, 512, 256, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#d8291c'); gr.addColorStop(1, '#a3150c');
      c.fillStyle = gr; c.fillRect(0, 0, 512, 256);
      // hazard bands round the canister
      for (const y0 of [36, 200]) {
        c.fillStyle = '#ffcc1f'; c.fillRect(0, y0, 512, 22);
        c.fillStyle = '#1a1a1a';
        for (let x = -30; x < 540; x += 34) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 16, y0); c.lineTo(x + 30, y0 + 22); c.lineTo(x + 14, y0 + 22); c.closePath(); c.fill(); }
      }
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.moveTo(256, 92); c.lineTo(286, 146); c.lineTo(226, 146); c.closePath(); c.fill();
      c.fillStyle = '#a3150c'; c.fillRect(252, 106, 8, 22); c.fillRect(252, 132, 8, 8);
    });
    keep(paint);
    const body = new T.Mesh(keep(new T.CylinderGeometry(0.78, 0.78, 2.3, 40, 1, false)), keep(new T.MeshStandardMaterial({ map: paint, roughness: 0.38, metalness: 0.25 })));
    g.add(body);
    const metal = keep(new T.MeshStandardMaterial({ color: '#9aa1a8', metalness: 1, roughness: 0.3 }));
    for (const s of [-1, 1]) {
      const rim = new T.Mesh(keep(new T.TorusGeometry(0.76, 0.07, 10, 40)), metal);
      rim.rotation.x = Math.PI / 2; rim.position.y = s * 1.15; g.add(rim);
    }
    const valve = new T.Mesh(keep(new T.CylinderGeometry(0.2, 0.24, 0.3, 16)), metal);
    valve.position.y = 1.3; g.add(valve);
    // lying along the screen's up axis, turned to show its hazard mark
    g.rotation.set(-Math.PI / 2, 0, 0);
    // the mark sits at the texture's middle (the canister's back): turn it up
    body.rotation.y = Math.PI;
  } else if (kind === 'mine') {
    const shell = keep(new T.MeshStandardMaterial({ color: '#3b3f46', metalness: 0.85, roughness: 0.34 }));
    g.add(new T.Mesh(keep(new T.SphereGeometry(1, 40, 24)), shell));
    const band = new T.Mesh(keep(new T.TorusGeometry(1.0, 0.08, 10, 48)), keep(new T.MeshStandardMaterial({ color: '#c9a227', metalness: 0.9, roughness: 0.3 })));
    band.rotation.x = Math.PI / 2; g.add(band);
    const spikeMat = keep(new T.MeshStandardMaterial({ color: '#8d949c', metalness: 1, roughness: 0.25 }));
    const spikeGeo = keep(new T.ConeGeometry(0.16, 0.6, 12));
    spikeGeo.translate(0, 1.2, 0);
    const n = 14, up = new T.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      // a Fibonacci sphere: spikes spread evenly all round
      const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      const d = new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const s = new T.Mesh(spikeGeo, spikeMat);
      s.quaternion.setFromUnitVectors(up, d);
      g.add(s);
    }
    const lens = new T.Mesh(keep(new T.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new T.MeshStandardMaterial({ color: '#3a0606', emissive: new T.Color('#5a0000'), roughness: 0.15, metalness: 0.2 })));
    lens.position.y = 0.9; g.add(lens);
  }
  return g;
}

/**
 * Renders every kind into its sheet. `scale` is the engine's backing-store
 * ratio ($.dpr), so a sprite is never blurrier than the canvas it lands on.
 * Built to be spread over idle moments: begin(kind) hands back a job that
 * renders one cell per next().
 */
export function createObjectBaker(T: Three, scale: number) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.32;
  // the key light: from the upper left of the screen and above, as every 2D
  // drawing in the game assumes
  // low enough that the far side of a rock falls into shadow
  const key = new T.DirectionalLight('#fff4e6', 5.2);
  key.position.set(-0.8, 0.55, -0.9);
  scene.add(key);
  scene.add(new T.HemisphereLight('#9fb8ff', '#120d0a', 0.18));
  const rim = new T.DirectionalLight('#7fd4ff', 0.8);
  rim.position.set(0.8, 0.3, 0.9);
  scene.add(rim);

  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const disposables: Array<{ dispose(): void }> = [];
  const keep = <X extends { dispose(): void }>(x: X) => { disposables.push(x); return x; };

  // the shadow pass: the object as a black silhouette, rendered small and
  // drawn back large, so the GPU's own scaling softens it. A canvas
  // shadowBlur did the same on the CPU and stalled a phone for seconds.
  const SHADOW_DOWN = 5;
  const shadowRenderer = new T.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  shadowRenderer.setPixelRatio(1);
  shadowRenderer.setClearColor(0x000000, 0);
  const black = keep(new T.MeshBasicMaterial({ color: 0x000000 }));

  /**
   * One kind's sheet, rendered a cell at a time: `next()` draws one view and
   * says whether the sheet is finished, so the caller can stop the moment its
   * idle time runs out and the game never stalls for a bake.
   */
  function begin(kind: string): { sheet: SpriteSheet; next(): boolean } | null {
    const spec = KIND_SPECS[kind];
    if (!spec) return null;
    const css = Math.ceil(spec.ref * spec.ext * 2);
    const cell = Math.ceil(css * scale);
    const count = spec.variants * spec.frames;
    const cols = Math.min(count, Math.max(1, Math.floor(4096 / cell)));
    const canvas = document.createElement('canvas');
    canvas.width = cols * cell;
    canvas.height = Math.ceil(count / cols) * cell;
    const ctx = canvas.getContext('2d')!;
    const sheet: SpriteSheet = { canvas, cell, cols, variants: spec.variants, frames: spec.frames, ref: spec.ref, css };
    // the frustum is the cell in model units (unit radius = the kind's ref)
    const half = spec.ext;
    const spinner = new T.Group();
    let i = 0;
    let model: THREE_NS.Object3D | null = null;

    return {
      sheet,
      next() {
        if (i >= count) return true;
        renderer.setSize(cell, cell, false);
        shadowRenderer.setSize(Math.max(8, Math.round(cell / SHADOW_DOWN)), Math.max(8, Math.round(cell / SHADOW_DOWN)), false);
        camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
        camera.updateProjectionMatrix();
        const v = Math.floor(i / spec.frames), f = i % spec.frames;
        // a drone is small and bright-edged; lit from higher up so its top
        // reads instead of one flank, as in the hangar
        if (spec.drone) { key.position.set(-0.75, 0.9, -0.85); key.intensity = 4.5; scene.environmentIntensity = 0.45; }
        else { key.position.set(-0.8, 0.55, -0.9); key.intensity = 5.2; scene.environmentIntensity = 0.32; }
        if (f === 0) { model = buildModel(T, kind, v, keep); spinner.add(model); }
        scene.add(spinner);
        // canvas rotate(theta) turns the picture clockwise on screen; seen
        // from above with screen-down = +z, that is a turn of -theta about +y
        spinner.rotation.y = -(f / spec.frames) * Math.PI * 2;
        scene.overrideMaterial = black;
        shadowRenderer.render(scene, camera);
        scene.overrideMaterial = null;
        renderer.render(scene, camera);
        scene.remove(spinner);
        const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, cell, cell); ctx.clip();
        // the soft shadow it would cast, down and to the right of the light
        ctx.globalAlpha = 0.5;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(shadowRenderer.domElement, x + cell * 0.045, y + cell * 0.06, cell, cell);
        ctx.globalAlpha = 1;
        ctx.drawImage(renderer.domElement, x, y, cell, cell);
        ctx.restore();
        if (f === spec.frames - 1 && model) { spinner.remove(model); model = null; }
        i++;
        return i >= count;
      },
    };
  }

  /** a whole sheet at once (tools and tests; the game uses begin()) */
  function bake(kind: string): SpriteSheet | null {
    const job = begin(kind);
    if (!job) return null;
    while (!job.next()) { /* every cell */ }
    return job.sheet;
  }

  return {
    kinds: Object.keys(KIND_SPECS),
    begin,
    bake,
    dispose() {
      disposables.forEach((d) => d.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      shadowRenderer.dispose();
    },
  };
}

/**
 * What the engine calls to draw an object from its sheet, already translated
 * to the object's centre. Returns false when there is no sheet for the kind
 * (the engine then draws its own 2D shape).
 */
export function spriteDrawer(sheets: Record<string, SpriteSheet>) {
  const TWO_PI = Math.PI * 2;
  return function draw(ctx: CanvasRenderingContext2D, o: { kind: string; id: number; rotation: number; radius: number }) {
    const s = sheets[o.kind];
    if (!s) return false;
    const v = (o.id >>> 0) % s.variants;
    let f = 0;
    ctx.save();
    if (s.frames > 1) {
      const step = TWO_PI / s.frames;
      const a = ((o.rotation % TWO_PI) + TWO_PI) % TWO_PI;
      const n = Math.round(a / step);
      f = n % s.frames;
      // the last few degrees by hand: the light stays put, the shape turns smoothly
      ctx.rotate(a - n * step);
    }
    const i = v * s.frames + f;
    const size = s.css * (o.radius / s.ref);
    ctx.drawImage(s.canvas, (i % s.cols) * s.cell, Math.floor(i / s.cols) * s.cell, s.cell, s.cell, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  };
}
