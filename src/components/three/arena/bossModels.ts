import type * as THREE_NS from 'three';

/*==============================================================================
Bosses in 3D - every boss in the pool, built at unit radius (scaled by the
boss's 90px radius), nose on +x.

Each model is a set of parts. A part with `breakAt` N falls away once the boss
reaches phase N - the 75% / 50% / 25% marks where its attacks already step up
(sectors.js), the same marks the 2D art breaks at. Broken parts tumble off and
fade over a second rather than vanishing, so the hit reads.
==============================================================================*/

type Three = typeof THREE_NS;

export interface BossModel {
  group: THREE_NS.Group;
  flash: THREE_NS.MeshStandardMaterial[];
  /** advance the idle animation; phase is the boss's current phase (0-3) */
  tick(t: number, dt: number, phase: number): void;
  dispose(): void;
}

const PI = Math.PI;

export function buildBoss(T: Three, title: string, hue: number): BossModel {
  const grp = new T.Group();
  const geos: THREE_NS.BufferGeometry[] = [];
  const mats: THREE_NS.Material[] = [];
  const flash: THREE_NS.MeshStandardMaterial[] = [];
  const anims: Array<(t: number) => void> = [];
  type Part = { obj: THREE_NS.Object3D; breakAt: number; gone: number; vel: THREE_NS.Vector3; spin: THREE_NS.Vector3 };
  const parts: Part[] = [];
  const g = <G extends THREE_NS.BufferGeometry>(x: G) => { geos.push(x); return x; };
  const std = (color: string, emissive: string, ei: number, extra: Partial<THREE_NS.MeshStandardMaterialParameters> = {}) => {
    const mat = new T.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.45, metalness: 0.45, ...extra });
    mats.push(mat);
    flash.push(mat);
    return mat;
  };
  const basic = (color: string, extra: Partial<THREE_NS.MeshBasicMaterialParameters> = {}) => {
    const mat = new T.MeshBasicMaterial({ color, ...extra });
    mats.push(mat);
    return mat;
  };
  const H = (l: number, s = 80) => `hsl(${hue}, ${s}%, ${l}%)`;
  function mesh(geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material, parent: THREE_NS.Object3D = grp) {
    const me = new T.Mesh(geo, mat);
    me.castShadow = true;
    parent.add(me);
    return me;
  }
  // a part that breaks off at a phase
  function breakable(breakAt: number, build: (p: THREE_NS.Group) => void) {
    const p = new T.Group();
    build(p);
    grp.add(p);
    parts.push({ obj: p, breakAt, gone: 0, vel: new T.Vector3(), spin: new T.Vector3() });
    return p;
  }
  function ring(n: number, r: number, y: number, fn: (a: number, i: number, p: THREE_NS.Group) => void, breaks = true) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      const at = breaks ? 1 + (i % 3) : 99;
      breakable(at, (p) => { p.position.set(Math.cos(a) * r, y, Math.sin(a) * r); fn(a, i, p); });
    }
  }
  function lumpy(detail: number, amount: number, seed: number) {
    const geo = g(new T.IcosahedronGeometry(1, detail));
    const pos = geo.attributes.position;
    const v = new T.Vector3();
    const seen = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      let f = seen.get(key);
      if (f === undefined) { f = 1 + Math.sin((seen.size + 1) * 12.9898 + seed * 78.233) * amount; seen.set(key, f); }
      v.multiplyScalar(f);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  switch (title) {
    case 'ASTEROID KING': {
      mesh(lumpy(1, 0.18, 3), std('#6b5240', '#2a1205', 0.3, { flatShading: true, roughness: 0.9 })).scale.set(0.95, 0.62, 0.95);
      const core = mesh(g(new T.SphereGeometry(0.5, 20, 14)), basic('#ff8a2a'));
      core.position.y = 0.32;
      anims.push((t) => { core.scale.setScalar(0.85 + Math.sin(t * 3) * 0.08); });
      ring(7, 0.62, 0.45, (a, i, p) => {
        const c = mesh(g(new T.ConeGeometry(0.13, 0.55, 6)), std('#c9a27a', '#5a2a0a', 0.4, { flatShading: true }), p);
        c.rotation.z = -Math.cos(a) * 0.5;
        c.rotation.x = Math.sin(a) * 0.5;
        c.position.y = 0.2;
      });
      break;
    }
    case 'VOID TYRANT': {
      mesh(g(new T.SphereGeometry(0.62, 28, 18)), std('#0d0618', '#2a0a55', 0.6, { metalness: 0.9, roughness: 0.15 }));
      const eye = mesh(g(new T.SphereGeometry(0.2, 16, 10)), basic(H(70, 100)));
      eye.position.set(0.5, 0.25, 0);
      for (let i = 0; i < 3; i++) {
        breakable(i + 1, (p) => {
          const r = mesh(g(new T.TorusGeometry(0.85 + i * 0.12, 0.04, 8, 64)), basic(H(62, 95)), p);
          r.rotation.x = PI / 2 + (i - 1) * 0.5;
          anims.push((t) => { p.rotation.y = t * (0.6 + i * 0.25) * (i % 2 ? -1 : 1); });
        });
      }
      break;
    }
    case 'SOLAR WARDEN': {
      const core = mesh(g(new T.SphereGeometry(0.55, 24, 16)), std('#ffb347', '#ff5a00', 1.1));
      anims.push((t) => { core.rotation.y = t * 0.4; });
      ring(8, 0.68, 0.05, (a, i, p) => {
        const f = mesh(g(new T.ConeGeometry(0.16, 0.7, 8)), std('#ff7a2a', '#ff3a00', 1.2), p);
        f.rotation.z = -PI / 2;
        p.rotation.y = -a;
        anims.push((t) => { f.scale.y = 1 + Math.sin(t * 6 + i) * 0.18; });
      });
      break;
    }
    case 'PLASMA MEDUSA': {
      const bell = mesh(g(new T.SphereGeometry(0.72, 28, 14, 0, PI * 2, 0, PI / 2)), std(H(60, 90), H(40, 100), 0.8, { transparent: true, opacity: 0.75 }));
      bell.position.y = 0.05;
      const glow = mesh(g(new T.SphereGeometry(0.32, 16, 10)), basic(H(80, 100)));
      glow.position.y = 0.25;
      anims.push((t) => { bell.scale.set(1 + Math.sin(t * 2.4) * 0.06, 1 - Math.sin(t * 2.4) * 0.08, 1 + Math.sin(t * 2.4) * 0.06); });
      ring(9, 0.55, 0, (a, i, p) => {
        const ten = mesh(g(new T.CapsuleGeometry(0.05, 0.85, 3, 6)), std(H(55, 90), H(45, 100), 0.9), p);
        ten.rotation.z = PI / 2;
        ten.position.x = 0.45;
        p.rotation.y = -a;
        anims.push((t) => { p.rotation.y = -a + Math.sin(t * 2 + i) * 0.15; });
      });
      break;
    }
    case 'HIVE QUEEN': {
      const abd = mesh(g(new T.SphereGeometry(0.6, 24, 16)), std('#2e5a2a', '#1a5a10', 0.5));
      abd.scale.set(1.35, 0.7, 0.95);
      abd.position.x = -0.25;
      const head = mesh(g(new T.SphereGeometry(0.34, 18, 12)), std('#3d7a35', '#1a5a10', 0.5));
      head.position.set(0.62, 0.12, 0);
      ring(6, 0.62, 0.32, (a, i, p) => {
        mesh(g(new T.SphereGeometry(0.17, 12, 8)), basic('#8dff6a'), p);
        anims.push((t) => { p.scale.setScalar(1 + Math.sin(t * 3 + i * 1.3) * 0.15); });
      });
      break;
    }
    case 'XENO MONARCH': {
      mesh(g(new T.OctahedronGeometry(0.62)), std('#5a2416', '#ff3a10', 0.35, { flatShading: true, metalness: 0.7 })).scale.set(1.3, 0.75, 1);
      const eye = mesh(g(new T.SphereGeometry(0.16, 14, 10)), basic('#ffe14a'));
      eye.position.set(0.7, 0.25, 0);
      ring(4, 0.85, 0, (a, i, p) => {
        const b = mesh(g(new T.BoxGeometry(0.9, 0.06, 0.18)), std('#c8c2b8', '#552010', 0.3, { metalness: 0.9, roughness: 0.2 }), p);
        b.position.x = 0.15;
        p.rotation.y = -a + PI / 4;
      });
      ring(5, 0.32, 0.45, (a, i, p) => { mesh(g(new T.ConeGeometry(0.07, 0.35, 5)), std('#ffd04a', '#aa5500', 0.6), p); });
      break;
    }
    /*--- the six sector bosses ---------------------------------------------*/
    case 'STORM CALLER': {
      mesh(g(new T.SphereGeometry(0.42, 24, 16)), basic('#bff4ff'));
      const shell = mesh(g(new T.IcosahedronGeometry(0.6, 1)), std('#1d3d5a', '#2ab8ff', 0.5, { wireframe: true }));
      anims.push((t) => { shell.rotation.y = t * 0.8; shell.rotation.x = t * 0.5; });
      ring(3, 0.85, 0, (a, i, p) => {
        mesh(g(new T.CylinderGeometry(0.1, 0.14, 0.75, 8)), std('#7fb8d8', '#2a8ac8', 0.6, { metalness: 0.8 }), p);
        const tip = mesh(g(new T.SphereGeometry(0.12, 10, 8)), basic('#e8fbff'), p);
        tip.position.y = 0.45;
        anims.push((t) => { tip.scale.setScalar(0.8 + Math.abs(Math.sin(t * 9 + i * 2)) * 0.6); });
      });
      break;
    }
    case 'SCRAP COLOSSUS': {
      mesh(g(new T.BoxGeometry(1.1, 0.5, 0.9)), std('#5a5148', '#2a1a0a', 0.2, { roughness: 0.85, metalness: 0.5 }));
      const eye = mesh(g(new T.BoxGeometry(0.12, 0.1, 0.5)), basic('#ffb02a'));
      eye.position.set(0.56, 0.12, 0);
      const plates: Array<[number, number, number, number, number]> = [[0.2, 0.42, 0.35, 0.6, 0.12], [-0.35, 0.4, -0.3, 0.5, -0.2], [0.05, 0.3, -0.55, 0.7, 0.3], [-0.45, 0.3, 0.45, 0.45, -0.1], [0.5, 0.28, -0.4, 0.4, 0.4], [-0.6, 0.15, -0.05, 0.4, 0.1]];
      plates.forEach(([x, y, z, s, r], i) => {
        breakable(1 + (i % 3), (p) => {
          const pl = mesh(g(new T.BoxGeometry(s, 0.12, s * 0.7)), std(i % 2 ? '#7a6c5a' : '#8a5a3a', '#331a05', 0.2, { roughness: 0.9, metalness: 0.6 }), p);
          pl.rotation.set(r, i, r * 0.5);
          p.position.set(x, y, z);
        });
      });
      break;
    }
    case 'PULSAR LORD': {
      const star = mesh(g(new T.SphereGeometry(0.45, 24, 16)), basic('#dff3ff'));
      const halo = mesh(g(new T.SphereGeometry(0.62, 24, 16)), std('#3a6ab8', '#4a8aff', 0.9, { transparent: true, opacity: 0.35 }));
      anims.push((t) => { star.scale.setScalar(1 + Math.sin(t * 12) * 0.05); halo.rotation.y = t; });
      for (const k of [1, -1]) {
        breakable(k > 0 ? 2 : 3, (p) => {
          const c = mesh(g(new T.ConeGeometry(0.2, 0.8, 12)), std('#9ac4ff', '#3a7aff', 0.8, { metalness: 0.7 }), p);
          c.rotation.x = k * PI / 2;
          c.position.z = k * 0.85;
          anims.push((t) => { p.rotation.y = t * 0.7; });
        });
      }
      breakable(1, (p) => {
        const r = mesh(g(new T.TorusGeometry(0.95, 0.05, 8, 64)), basic('#8fc8ff'), p);
        r.rotation.x = PI / 2;
      });
      break;
    }
    case 'MINE LAYER': {
      const hull = mesh(g(new T.CylinderGeometry(1, 1.05, 0.35, 8)), std('#3a3d44', '#3a0505', 0.3, { metalness: 0.85, roughness: 0.3 }));
      hull.scale.set(1, 1, 0.75);
      hull.rotation.y = PI / 8;
      const bridge = mesh(g(new T.BoxGeometry(0.45, 0.28, 0.35)), std('#5a5f68', '#220000', 0.2, { metalness: 0.8 }));
      bridge.position.set(0.35, 0.3, 0);
      const lamp = mesh(g(new T.SphereGeometry(0.1, 10, 8)), basic('#ff3030'));
      lamp.position.set(0.62, 0.32, 0);
      anims.push((t) => { lamp.visible = Math.sin(t * 6) > -0.3; });
      for (let i = 0; i < 6; i++) {
        const row = i < 3 ? 1 : -1;
        breakable(1 + (i % 3), (p) => {
          p.position.set(-0.55 + (i % 3) * 0.32, 0.28, row * 0.38);
          mesh(g(new T.SphereGeometry(0.13, 12, 8)), std('#4a4f57', '#550000', 0.4, { metalness: 0.8 }), p);
          const l = mesh(g(new T.SphereGeometry(0.05, 8, 6)), basic('#ff4040'), p);
          l.position.y = 0.12;
        });
      }
      break;
    }
    case 'COMET HERALD': {
      mesh(lumpy(1, 0.12, 9), std('#cfe8ff', '#4a9aff', 0.55, { flatShading: true, roughness: 0.2 })).scale.setScalar(0.6);
      for (let i = 0; i < 3; i++) {
        breakable(i + 1, (p) => {
          const tail = mesh(g(new T.ConeGeometry(0.45 - i * 0.1, 1.2 + i * 0.5, 16, 1, true)), basic(i === 0 ? '#ff9a4a' : '#ffd08a', { transparent: true, opacity: 0.55 - i * 0.12, side: T.DoubleSide, depthWrite: false }), p);
          tail.rotation.z = PI / 2;
          tail.position.x = -0.9 - i * 0.35;
          anims.push((t) => { tail.scale.y = 1 + Math.sin(t * 8 + i) * 0.07; });
        });
      }
      ring(5, 0.85, 0.1, (a, i, p) => {
        mesh(lumpy(0, 0.3, 20 + i), std('#7a6a5a', '#552a0a', 0.3, { flatShading: true }), p).scale.setScalar(0.12);
        anims.push((t) => { const aa = a + t * 1.2; p.position.set(Math.cos(aa) * 0.85, 0.1, Math.sin(aa) * 0.85); });
      });
      break;
    }
    case 'PRISM GIANT': {
      const mat = std('#b46cff', '#8a3aff', 0.8, { transparent: true, opacity: 0.88, flatShading: true, roughness: 0.15 });
      mesh(g(new T.OctahedronGeometry(0.62)), mat).scale.set(0.8, 1.4, 0.8);
      ring(6, 0.66, 0, (a, i, p) => {
        const c = mesh(g(new T.OctahedronGeometry(0.3)), std('#d4a0ff', '#9a4aff', 0.9, { transparent: true, opacity: 0.85, flatShading: true }), p);
        c.scale.set(0.7, 1.5, 0.7);
        c.rotation.z = -Math.cos(a) * 0.6;
        c.rotation.x = Math.sin(a) * 0.6;
      });
      anims.push((t) => { grp.children[0].rotation.y = t * 0.5; });
      break;
    }
    default: {
      mesh(g(new T.SphereGeometry(0.8, 24, 16)), std(H(45), H(30), 0.6));
    }
  }

  return {
    group: grp,
    flash,
    tick(t, dt, phase) {
      anims.forEach((f) => f(t));
      for (const p of parts) {
        if (phase >= p.breakAt && !p.gone) {
          // knock it outward and up, spinning
          p.gone = 1;
          const out = new T.Vector3(p.obj.position.x || 0.3, 0, p.obj.position.z || 0.3).normalize();
          p.vel.set(out.x * 0.035, 0.03, out.z * 0.035);
          p.spin.set(0.08, 0.05, 0.07);
        }
        if (p.gone > 0 && p.obj.visible) {
          p.gone += dt / 60;
          p.obj.position.addScaledVector(p.vel, dt);
          p.vel.y -= 0.0012 * dt;
          p.obj.rotation.x += p.spin.x * dt;
          p.obj.rotation.z += p.spin.z * dt;
          p.obj.scale.multiplyScalar(Math.pow(0.985, dt));
          if (p.gone > 1.2) p.obj.visible = false;
        }
      }
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
    },
  };
}
