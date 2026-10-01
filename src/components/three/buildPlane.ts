import type * as THREE_NS from 'three';
import { PLANE_SPECS, type Part } from './planeSpecs';

/*==============================================================================
buildPlane - one pilot's airframe as a lit three.js group

Every part in planeSpecs is extruded or primitive geometry with three shared
materials (hull, a slightly darker wing, grey/dark metal), so a ship colour
reads in depth the same way the 2D art does. Animated parts (nozzle glow,
propellers, glyphs, the glitch shard, flames) register a callback in `anim`;
the caller runs them every frame with the time in seconds.

`dispose()` frees every geometry and material this made - the bays swap
planes often, and WebGL does not garbage-collect GPU memory.
==============================================================================*/

type Three = typeof THREE_NS;

export interface BuiltPlane {
  group: THREE_NS.Group;
  anim: Array<(t: number) => void>;
  /** materials whose colour follows the hull (re-tinted for a locked hull) */
  mats: Record<'hull' | 'wing' | 'grey' | 'dark', THREE_NS.MeshStandardMaterial>;
  /** the engine glows, so a trail colour can tint them */
  glows: THREE_NS.Sprite[];
  /** the rearmost x of the airframe (plane-local), where a trail plume starts */
  tailX: number;
  dispose(): void;
}

const TWO_PI = Math.PI * 2;

export function glowTexture(T: Three): THREE_NS.Texture {
  const sc = document.createElement('canvas');
  sc.width = sc.height = 64;
  const sg = sc.getContext('2d')!;
  const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(sc);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function buildPlane(T: Three, glowTex: THREE_NS.Texture, pilotId: string, colorStr: string): BuiltPlane {
  const specs = PLANE_SPECS[pilotId] || PLANE_SPECS.onyix;
  const g = new T.Group();
  const anim: Array<(t: number) => void> = [];
  const glows: THREE_NS.Sprite[] = [];
  const col = new T.Color(colorStr);
  const mats = {
    hull: new T.MeshStandardMaterial({ color: col, metalness: 0.45, roughness: 0.32 }),
    wing: new T.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.78), metalness: 0.45, roughness: 0.4 }),
    grey: new T.MeshStandardMaterial({ color: '#6b7380', metalness: 0.6, roughness: 0.45 }),
    dark: new T.MeshStandardMaterial({ color: '#2a303a', metalness: 0.7, roughness: 0.4 }),
  };

  function shapeFrom(pts: Array<[number, number]>) {
    const s = new T.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    for (let j = pts.length - 1; j >= 0; j--) s.lineTo(pts[j][0], -pts[j][1]);
    return s;
  }
  function extrude(shape: THREE_NS.Shape, part: { h: number; y: number; m: 'hull' | 'wing'; round?: number; facet?: number }) {
    const bevel = part.round ? Math.min(0.12, part.h * 0.35) : part.facet ? 0.03 : 0.012;
    const geo = new T.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, part.h - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: part.round ? bevel * 0.8 : bevel,
      bevelSegments: part.round ? 4 : 1,
      curveSegments: 12,
    });
    geo.rotateX(-Math.PI / 2); // shape y -> -z, extrusion -> up
    geo.translate(0, (part.y || 0) + bevel, 0);
    const m = new T.Mesh(geo, mats[part.m || 'hull']);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  function glowSprite(hue: number, size: number, x: number, y: number, z: number) {
    const sp = new T.Sprite(new T.SpriteMaterial({
      map: glowTex, color: new T.Color(`hsl(${hue}, 100%, 65%)`), transparent: true,
      blending: T.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(size, size, size);
    sp.position.set(x, y, z);
    return sp;
  }

  for (const part of specs as Part[]) {
    switch (part.t) {
      case 'plate':
        g.add(extrude(shapeFrom(part.p), part));
        break;
      case 'path': {
        const s = new T.Shape();
        part.draw(s);
        g.add(extrude(s, part));
        break;
      }
      case 'fin': {
        const fs = new T.Shape();
        fs.moveTo(part.x0, 0);
        fs.lineTo(part.x1 + (part.x0 - part.x1) * 0.15, part.h);
        fs.lineTo(part.x1, part.h);
        fs.lineTo(part.x1 - 0.05, 0);
        const fg = new T.ExtrudeGeometry(fs, { depth: 0.05, bevelEnabled: false });
        fg.translate(0, 0, -0.025);
        const fin = new T.Mesh(fg, mats.wing);
        fin.position.set(0, (part.y || 0) + 0.25, -(part.z || 0));
        if (part.cant) fin.rotation.x = part.cant;
        fin.castShadow = true;
        g.add(fin);
        break;
      }
      case 'pod': {
        const pod = new T.Mesh(new T.SphereGeometry(1, 24, 14), mats[part.m || 'grey']);
        pod.scale.set(part.len, part.rad, part.rad);
        pod.position.set(part.x, part.y || 0.2, -part.z);
        pod.castShadow = true;
        g.add(pod);
        break;
      }
      case 'barrel': {
        const bl = new T.Mesh(new T.CylinderGeometry(part.rad, part.rad, part.x1 - part.x0, 12), mats[part.m || 'dark']);
        bl.rotation.z = Math.PI / 2;
        bl.position.set((part.x0 + part.x1) / 2, part.y || 0.15, 0);
        bl.castShadow = true;
        g.add(bl);
        break;
      }
      case 'canopy': {
        const glass = new T.MeshStandardMaterial({
          color: part.glow || '#bdefff', emissive: part.glow || '#5fd8ff', emissiveIntensity: part.glow ? 0.9 : 0.55,
          metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.9,
        });
        const cp = new T.Mesh(new T.SphereGeometry(1, 28, 16), glass);
        cp.scale.set(part.len, part.ht, part.w);
        cp.position.set(part.x, 0.38, 0);
        g.add(cp);
        break;
      }
      case 'nozzle': {
        const nz = new T.Mesh(
          new T.CylinderGeometry(part.s * 0.9, part.s * 1.1, 0.12, 16),
          new T.MeshBasicMaterial({ color: new T.Color(`hsl(${part.hue}, 100%, 70%)`) }),
        );
        nz.rotation.z = Math.PI / 2;
        nz.position.set(part.x, part.y || 0.22, -(part.z || 0));
        g.add(nz);
        const gl = glowSprite(part.hue, part.s * 7, part.x - 0.12, part.y || 0.22, -(part.z || 0));
        g.add(gl);
        glows.push(gl);
        const phase = part.x * 3;
        anim.push((t) => { gl.material.opacity = 0.65 + Math.sin(t * 9 + phase) * 0.2; });
        break;
      }
      case 'muzzle': {
        const mz = glowSprite(35, part.s * 6, part.x, part.y, 0);
        g.add(mz);
        anim.push((t) => { mz.material.opacity = 0.5 + Math.cos(t * 4) * 0.35; });
        break;
      }
      case 'ring': {
        const ring = new T.Mesh(new T.TorusGeometry(part.R, part.tube, 14, 64), mats.hull);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(part.x, part.y + 0.1, 0);
        ring.castShadow = true;
        g.add(ring);
        break;
      }
      case 'struts':
        for (let k = 0; k < 4; k++) {
          const aa = Math.PI / 4 + (k * Math.PI) / 2;
          const st = new T.Mesh(new T.BoxGeometry(part.R * 0.78, 0.08, 0.1), mats.wing);
          st.position.set(part.x + Math.cos(aa) * part.R * 0.55, part.y + 0.1, Math.sin(aa) * part.R * 0.55);
          st.rotation.y = -aa;
          g.add(st);
        }
        break;
      case 'prop': {
        const disc = new T.Mesh(
          new T.CircleGeometry(part.R, 40),
          new T.MeshBasicMaterial({ color: '#dff0ff', transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false }),
        );
        disc.rotation.y = Math.PI / 2;
        disc.position.set(part.x, part.y, -part.z);
        g.add(disc);
        const blade = new T.Mesh(new T.BoxGeometry(0.03, part.R * 2, 0.07), mats.dark);
        blade.position.copy(disc.position);
        g.add(blade);
        anim.push((t) => {
          blade.rotation.x = t * 30;
          (disc.material as THREE_NS.MeshBasicMaterial).opacity = 0.12 + Math.abs(Math.sin(t * 20)) * 0.08;
        });
        break;
      }
      case 'glyphs': {
        const glyphMat = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 });
        const geo = new T.OctahedronGeometry(0.2);
        const gs = [0, 1, 2].map(() => {
          const o = new T.Mesh(geo, glyphMat);
          o.castShadow = true;
          g.add(o);
          return o;
        });
        anim.push((t) => {
          gs.forEach((o, i) => {
            const a = t * 1.2 + (i * TWO_PI) / 3;
            o.position.set(Math.cos(a) * part.R, 0.4 + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * part.R);
            o.rotation.y = t * 2;
            o.rotation.x = t;
          });
        });
        break;
      }
      case 'shard': {
        const sh = new T.Mesh(
          new T.TetrahedronGeometry(0.28),
          new T.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.55, metalness: 0.3, roughness: 0.3 }),
        );
        g.add(sh);
        anim.push((t) => {
          const on = Math.floor(t * 3) % 2;
          sh.position.set(on ? 0.7 : -1.0, 0.45, on ? -0.5 : 0.45);
          sh.rotation.set(t, t * 1.3, 0);
        });
        break;
      }
      case 'flame': {
        const fl = new T.Mesh(
          new T.ConeGeometry(part.w, part.len, 20, 1, true),
          new T.MeshBasicMaterial({
            color: new T.Color(`hsl(${part.hue}, 100%, 60%)`), transparent: true, opacity: 0.55,
            blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
          }),
        );
        fl.rotation.z = Math.PI / 2;
        fl.position.set(part.x - part.len / 2, 0.2, 0);
        g.add(fl);
        const fg = glowSprite(part.hue, part.w * 4, part.x - 0.1, 0.2, 0);
        g.add(fg);
        anim.push((t) => {
          fl.scale.y = 0.9 + Math.sin(t * 23) * 0.12;
          (fl.material as THREE_NS.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 12) * 0.1;
        });
        break;
      }
    }
  }

  let tailX = 0;
  for (const part of specs as Part[]) {
    if (part.t === 'plate') for (const pt of part.p) tailX = Math.min(tailX, pt[0]);
    if (part.t === 'nozzle') tailX = Math.min(tailX, part.x);
  }

  return {
    group: g,
    anim,
    mats,
    glows,
    tailX,
    dispose() {
      g.traverse((o) => {
        const mesh = o as THREE_NS.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = (mesh as unknown as { material?: THREE_NS.Material | THREE_NS.Material[] }).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) m.dispose();
      });
    },
  };
}
