import type * as THREE_NS from 'three';

/*==============================================================================
The arena's objects in 3D (public/game/objects.js): rock, crate, fuel,
satellite, ice, mine, crystal. Unit radius, scaled by the object's radius.

Rocks, ice and crystals come in four variants each so a field of them does not
look stamped; the variant is chosen from the object's own id, never from a
dice roll (see arenaScene.ts on why the 3D layer may not touch Math.random).
==============================================================================*/

type Three = typeof THREE_NS;

export interface ObjectModel {
  group: THREE_NS.Group;
  /** materials that flash when the object is hit */
  flash: THREE_NS.MeshStandardMaterial[];
  /** a light that blinks when a mine or fuel canister is armed */
  warn: THREE_NS.MeshBasicMaterial | null;
  dispose(): void;
}

const PI = Math.PI;

// a small integer hash, so variants and jitter are a pure function of the id
function hash(n: number) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function objectFactory(T: Three) {
  const shared: THREE_NS.BufferGeometry[] = [];
  const keep = <G extends THREE_NS.BufferGeometry>(x: G) => { shared.push(x); return x; };

  // lumpy solids: an icosahedron with every vertex pushed in or out by a hash
  const lumps = new Map<string, THREE_NS.BufferGeometry>();
  function lumpy(kind: string, variant: number, detail: number, amount: number, stretch: [number, number, number]) {
    const k = `${kind}:${variant}`;
    let geo = lumps.get(k);
    if (geo) return geo;
    geo = new T.IcosahedronGeometry(1, detail);
    const pos = geo.attributes.position;
    const v = new T.Vector3();
    // vertices that share a position must move together, or the solid tears
    const moved = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      let f = moved.get(key);
      if (f === undefined) { f = 1 + (hash(variant * 7919 + moved.size * 31) - 0.5) * amount; moved.set(key, f); }
      v.multiplyScalar(f);
      v.set(v.x * stretch[0], v.y * stretch[1], v.z * stretch[2]);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    lumps.set(k, geo);
    shared.push(geo);
    return geo;
  }
  const box = keep(new T.BoxGeometry(1, 1, 1));
  const cyl = keep(new T.CylinderGeometry(1, 1, 1, 18));
  const sphere = keep(new T.SphereGeometry(1, 18, 12));
  const cone = keep(new T.ConeGeometry(1, 1, 8));
  const octa = keep(new T.OctahedronGeometry(1));

  function std(color: string, opts: Partial<THREE_NS.MeshStandardMaterialParameters> = {}) {
    return new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...opts });
  }

  function build(o: { kind: string; id?: number; hue?: number }): ObjectModel {
    const grp = new T.Group();
    const mats: THREE_NS.Material[] = [];
    const flash: THREE_NS.MeshStandardMaterial[] = [];
    let warn: THREE_NS.MeshBasicMaterial | null = null;
    const variant = Math.floor(hash(o.id || 0) * 4);
    const m = <X extends THREE_NS.Material>(x: X) => { mats.push(x); return x; };
    const part = (geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material) => {
      const me = new T.Mesh(geo, mat);
      me.castShadow = true;
      me.receiveShadow = true;
      grp.add(me);
      return me;
    };
    switch (o.kind) {
      case 'rock': {
        const mat = m(std('#6e5a48', { roughness: 0.9, flatShading: true }));
        flash.push(mat);
        part(lumpy('rock', variant, 1, 0.45, [1, 0.72, 0.9]), mat);
        break;
      }
      case 'ice': {
        const mat = m(std('#bfe6ff', { roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.82, emissive: '#3a88b8', emissiveIntensity: 0.35, flatShading: true }));
        flash.push(mat);
        part(lumpy('ice', variant, 0, 0.5, [1, 0.8, 0.85]), mat);
        break;
      }
      case 'crystal': {
        const mat = m(std('#b46cff', { roughness: 0.2, metalness: 0.1, emissive: '#7a2cff', emissiveIntensity: 0.7, transparent: true, opacity: 0.9, flatShading: true }));
        flash.push(mat);
        const n = 2 + (variant % 3);
        for (let i = 0; i < n; i++) {
          const c = part(octa, mat);
          const a = (i / n) * PI * 2 + variant;
          const s = i === 0 ? 1 : 0.55;
          c.scale.set(0.42 * s, 1.15 * s, 0.42 * s);
          c.position.set(i === 0 ? 0 : Math.cos(a) * 0.45, 0.2, i === 0 ? 0 : Math.sin(a) * 0.45);
          c.rotation.z = i === 0 ? 0.25 : Math.cos(a) * 0.5;
          c.rotation.x = i === 0 ? 0 : Math.sin(a) * 0.5;
        }
        break;
      }
      case 'crate': {
        const wood = m(std('#a8743c', { roughness: 0.75 }));
        const band = m(std('#5d3d1c', { roughness: 0.8 }));
        flash.push(wood);
        const b = part(box, wood);
        b.scale.set(1.35, 1.1, 1.35);
        for (const k of [-1, 1]) {
          const strap = part(box, band);
          strap.scale.set(1.4, 1.14, 0.14);
          strap.position.z = k * 0.4;
        }
        const tag = new T.Mesh(box, m(new T.MeshBasicMaterial({ color: '#5dff9a' })));
        tag.scale.set(0.18, 0.05, 0.18);
        tag.position.set(0.4, 0.58, 0);
        grp.add(tag);
        break;
      }
      case 'fuel': {
        const red = m(std('#d8352a', { roughness: 0.45, metalness: 0.35 }));
        flash.push(red);
        const can = part(cyl, red);
        can.scale.set(0.62, 1.4, 0.62);
        warn = m(new T.MeshBasicMaterial({ color: '#ffd23f' }));
        for (const y of [-0.35, 0, 0.35]) {
          const s = new T.Mesh(cyl, warn);
          s.scale.set(0.64, 0.12, 0.64);
          s.position.y = y;
          grp.add(s);
        }
        const cap = part(cyl, m(std('#3a3a3a')));
        cap.scale.set(0.28, 0.2, 0.28);
        cap.position.y = 0.8;
        break;
      }
      case 'satellite': {
        const steel = m(std('#c9d1dc', { roughness: 0.35, metalness: 0.7 }));
        const panel = m(std('#1e4f9c', { roughness: 0.3, metalness: 0.4, emissive: '#0d2d66', emissiveIntensity: 0.5 }));
        flash.push(steel);
        const b = part(box, steel);
        b.scale.set(0.7, 0.55, 0.55);
        for (const k of [-1, 1]) {
          const p = part(box, panel);
          p.scale.set(0.5, 0.05, 1.3);
          p.position.z = k * 1.05;
        }
        const dish = part(sphere, steel);
        dish.scale.set(0.32, 0.12, 0.32);
        dish.position.set(0, 0.42, 0);
        break;
      }
      case 'mine': {
        const shell = m(std('#4a4f57', { roughness: 0.35, metalness: 0.8 }));
        flash.push(shell);
        part(sphere, shell);
        const spike = m(std('#9aa3ad', { roughness: 0.3, metalness: 0.8 }));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          const s = part(cone, spike);
          s.scale.set(0.16, 0.55, 0.16);
          s.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05);
          s.rotation.z = -Math.cos(a) * PI / 2;
          s.rotation.x = Math.sin(a) * PI / 2;
        }
        const top = part(cone, spike);
        top.scale.set(0.16, 0.55, 0.16);
        top.position.y = 1.05;
        warn = m(new T.MeshBasicMaterial({ color: '#ff2b2b' }));
        const eye = new T.Mesh(sphere, warn);
        eye.scale.setScalar(0.32);
        eye.position.y = 0.82;
        grp.add(eye);
        break;
      }
      default: {
        const mat = m(std('#777'));
        flash.push(mat);
        part(sphere, mat);
      }
    }
    return { group: grp, flash, warn, dispose() { mats.forEach((x) => x.dispose()); } };
  }

  return {
    build,
    hash,
    dispose() { shared.forEach((x) => x.dispose()); lumps.clear(); },
  };
}
