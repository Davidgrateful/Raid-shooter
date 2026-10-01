import type * as THREE_NS from 'three';

/*==============================================================================
The enemy fleet in 3D - one procedural model per 2D shape (public/game/enemy.js)

Every model is built at unit radius with its nose on +x, the same convention
as the 2D art (the engine rotates a drone to face its velocity). The silhouette
seen from above matches the 2D shape's family, so "pink chases you" and every
other read the player has learned still holds; height, lighting and a neon edge
are what the 3D adds.

Templates are built once per shape and cloned per enemy. Clones share the
geometry; materials are swapped per instance for the enemy's own hue.
==============================================================================*/

type Three = typeof THREE_NS;

export interface EnemyTemplate {
  group: THREE_NS.Group;
  /** spin about the vertical axis, radians per frame at 60fps (0 = faces velocity) */
  spin: number;
  /** tumble about the nose axis (tumblers, shards) */
  tumble: number;
  /** extra lift above the floor, in radii */
  lift: number;
}

const PI = Math.PI;

export function enemyTemplates(T: Three) {
  const cache = new Map<string, EnemyTemplate>();
  const geos: THREE_NS.BufferGeometry[] = [];
  const g = <G extends THREE_NS.BufferGeometry>(x: G) => { geos.push(x); return x; };
  // placeholder materials, tagged so instances can swap them for their own hue
  const body = new T.MeshStandardMaterial({ color: '#888' });
  body.userData.role = 'body';
  const dark = new T.MeshStandardMaterial({ color: '#444' });
  dark.userData.role = 'dark';
  const glow = new T.MeshBasicMaterial({ color: '#fff' });
  glow.userData.role = 'glow';
  const edge = new T.LineBasicMaterial({ color: '#fff' });
  edge.userData.role = 'edge';

  function mesh(geo: THREE_NS.BufferGeometry, m: THREE_NS.Material, edges = true) {
    const me = new T.Mesh(geo, m);
    me.castShadow = true;
    if (edges && m !== glow) {
      const eg = g(new T.EdgesGeometry(geo, 28));
      const line = new T.LineSegments(eg, edge);
      me.add(line);
    }
    return me;
  }
  // a flat outline extruded to a thin slab, lying in the floor plane (x = nose)
  function slab(pts: Array<[number, number]>, h: number, mirror = true) {
    const s = new T.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    if (mirror) for (let j = pts.length - 1; j >= 0; j--) s.lineTo(pts[j][0], -pts[j][1]);
    const geo = g(new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: h * 0.25, bevelSize: 0.05, bevelSegments: 1 }));
    geo.rotateX(PI / 2);
    geo.translate(0, h / 2, 0);
    return geo;
  }

  function make(shape: string): EnemyTemplate {
    const grp = new T.Group();
    let spin = 0;
    let tumble = 0;
    let lift = 0.15;
    const add = (o: THREE_NS.Object3D) => { grp.add(o); return o; };
    switch (shape) {
      case 'shuttle': {
        const hull = add(mesh(g(new T.CapsuleGeometry(0.32, 1.1, 4, 12)), body));
        hull.rotation.z = PI / 2;
        add(mesh(slab([[0.2, 0], [-0.1, 0.9], [-0.45, 0.9], [-0.35, 0]], 0.08), dark)).position.y = -0.05;
        const eye = add(mesh(g(new T.SphereGeometry(0.16, 12, 8)), glow, false));
        eye.position.set(0.55, 0.12, 0);
        break;
      }
      case 'slant': {
        add(mesh(slab([[1, 0], [-0.7, 0.85], [-0.45, 0]], 0.35), body));
        break;
      }
      case 'chevron': {
        add(mesh(slab([[1, 0], [-0.8, 0.95], [-0.45, 0.95], [0.35, 0]], 0.3), body));
        const c = add(mesh(g(new T.OctahedronGeometry(0.22)), glow, false));
        c.position.set(0.35, 0.25, 0);
        break;
      }
      case 'block': {
        add(mesh(g(new T.BoxGeometry(1.35, 0.65, 1.35)), body));
        const top = add(mesh(g(new T.BoxGeometry(0.7, 0.3, 0.7)), dark));
        top.position.y = 0.45;
        break;
      }
      case 'tumbler': {
        add(mesh(g(new T.OctahedronGeometry(0.95)), body));
        tumble = 0.06;
        lift = 0.6;
        break;
      }
      case 'comet': {
        add(mesh(g(new T.SphereGeometry(0.62, 16, 12)), body));
        const tail = add(mesh(g(new T.ConeGeometry(0.5, 1.6, 14)), dark));
        tail.rotation.z = PI / 2;
        tail.position.x = -1.05;
        const core = add(mesh(g(new T.SphereGeometry(0.3, 12, 8)), glow, false));
        core.position.x = 0.25;
        lift = 0.4;
        break;
      }
      case 'wasp': {
        const head = add(mesh(g(new T.SphereGeometry(0.42, 14, 10)), body));
        head.position.x = 0.45;
        const abd = add(mesh(g(new T.SphereGeometry(0.5, 14, 10)), dark));
        abd.scale.set(1.4, 0.8, 0.9);
        abd.position.x = -0.4;
        for (const k of [1, -1]) {
          const w = add(mesh(g(new T.CircleGeometry(0.55, 16)), body));
          w.rotation.x = -PI / 2;
          w.scale.set(0.5, 1, 1);
          w.position.set(0.05, 0.25, k * 0.6);
        }
        lift = 0.35;
        break;
      }
      case 'sliver': {
        add(mesh(slab([[1.2, 0], [0, 0.32], [-1.1, 0]], 0.18), body));
        lift = 0.25;
        break;
      }
      case 'heavy': {
        const hull = add(mesh(g(new T.CylinderGeometry(0.85, 0.95, 0.6, 6)), body));
        hull.rotation.y = PI / 6;
        for (const k of [1, -1]) {
          const pod = add(mesh(g(new T.CapsuleGeometry(0.22, 0.7, 4, 10)), dark));
          pod.rotation.z = PI / 2;
          pod.position.set(0, 0.1, k * 0.95);
        }
        const eye = add(mesh(g(new T.SphereGeometry(0.22, 12, 8)), glow, false));
        eye.position.set(0.55, 0.35, 0);
        break;
      }
      case 'bloom': {
        for (let i = 0; i < 6; i++) {
          const p = add(mesh(g(new T.SphereGeometry(0.42, 12, 8)), body));
          const a = (i / 6) * PI * 2;
          p.scale.set(1.3, 0.35, 0.7);
          p.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55);
          p.rotation.y = -a;
        }
        add(mesh(g(new T.SphereGeometry(0.3, 12, 8)), glow, false)).position.y = 0.2;
        spin = 0.02;
        break;
      }
      case 'dartlet': {
        const c = add(mesh(g(new T.ConeGeometry(0.55, 1.6, 10)), body));
        c.rotation.z = -PI / 2;
        break;
      }
      case 'star': {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * PI * 2;
          const r = i % 2 ? 0.42 : 1;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        add(mesh(slab(pts, 0.3, false), body));
        add(mesh(g(new T.SphereGeometry(0.25, 12, 8)), glow, false)).position.y = 0.3;
        spin = 0.035;
        break;
      }
      case 'turret': {
        add(mesh(g(new T.CylinderGeometry(0.9, 1, 0.45, 16)), dark));
        const dome = add(mesh(g(new T.SphereGeometry(0.55, 16, 10, 0, PI * 2, 0, PI / 2)), body));
        dome.position.y = 0.22;
        const barrel = add(mesh(g(new T.CylinderGeometry(0.12, 0.14, 1.1, 10)), body));
        barrel.rotation.z = -PI / 2;
        barrel.position.set(0.7, 0.45, 0);
        break;
      }
      case 'crescent': {
        const t = add(mesh(g(new T.TorusGeometry(0.75, 0.22, 10, 32, PI * 1.25)), body));
        t.rotation.x = PI / 2;
        t.rotation.z = PI * 0.375;
        break;
      }
      case 'hive': {
        add(mesh(g(new T.DodecahedronGeometry(0.85)), body));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          const pod = add(mesh(g(new T.SphereGeometry(0.22, 10, 8)), glow, false));
          pod.position.set(Math.cos(a) * 0.8, 0.3, Math.sin(a) * 0.8);
        }
        spin = 0.01;
        lift = 0.45;
        break;
      }
      case 'fort': {
        add(mesh(g(new T.BoxGeometry(1.2, 0.55, 1.2)), body));
        for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const t = add(mesh(g(new T.CylinderGeometry(0.22, 0.26, 0.9, 8)), dark));
          t.position.set(x * 0.62, 0.2, z * 0.62);
        }
        break;
      }
      case 'shard': {
        const s = add(mesh(g(new T.TetrahedronGeometry(1)), body));
        s.scale.set(1.3, 0.7, 0.7);
        tumble = 0.045;
        lift = 0.5;
        break;
      }
      case 'phantom': {
        const shell = new T.MeshStandardMaterial({ color: '#888', transparent: true, opacity: 0.45, depthWrite: false });
        shell.userData.role = 'ghost';
        add(mesh(g(new T.IcosahedronGeometry(0.95, 1)), shell));
        add(mesh(g(new T.SphereGeometry(0.35, 12, 8)), glow, false));
        spin = 0.015;
        lift = 0.5;
        break;
      }
      case 'weaver': {
        const ring = add(mesh(g(new T.TorusGeometry(0.75, 0.07, 8, 40)), dark));
        ring.rotation.x = PI / 2;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2;
          const n = add(mesh(g(new T.SphereGeometry(0.3, 12, 8)), body));
          n.position.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75);
        }
        spin = 0.04;
        lift = 0.35;
        break;
      }
      case 'warden': {
        add(mesh(g(new T.CylinderGeometry(1, 1, 0.16, 24)), dark));
        add(mesh(g(new T.SphereGeometry(0.5, 16, 12)), body)).position.y = 0.2;
        const eye = add(mesh(g(new T.SphereGeometry(0.2, 12, 8)), glow, false));
        eye.position.set(0.4, 0.4, 0);
        break;
      }
      default: {
        add(mesh(g(new T.SphereGeometry(0.8, 18, 12)), body));
        const ring = add(mesh(g(new T.TorusGeometry(1, 0.06, 8, 40)), dark));
        ring.rotation.x = PI / 2;
        lift = 0.3;
      }
    }
    return { group: grp, spin, tumble, lift };
  }

  return {
    get(shape: string): EnemyTemplate {
      let t = cache.get(shape);
      if (!t) { t = make(shape); cache.set(shape, t); }
      return t;
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      [body, dark, glow, edge].forEach((m) => m.dispose());
    },
  };
}

/** The four materials of one enemy hue: body, dark, glow and edge. */
export function enemyMaterials(T: Three, hue: number, sat: number) {
  const s = Math.max(30, Math.min(100, sat));
  return {
    // the 2D fleet is neon: keep the hull saturated and let it glow in its
    // own hue, or the lighting washes every drone out to the same pale grey
    body: new T.MeshStandardMaterial({ color: `hsl(${hue}, ${s}%, 38%)`, emissive: `hsl(${hue}, ${s}%, 42%)`, emissiveIntensity: 0.85, metalness: 0.25, roughness: 0.5 }),
    dark: new T.MeshStandardMaterial({ color: `hsl(${hue}, ${Math.round(s * 0.5)}%, 18%)`, emissive: `hsl(${hue}, ${s}%, 12%)`, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.4 }),
    glow: new T.MeshBasicMaterial({ color: `hsl(${hue}, 100%, 72%)` }),
    edge: new T.LineBasicMaterial({ color: `hsl(${hue}, 100%, 66%)`, transparent: true, opacity: 0.9 }),
    ghost: new T.MeshStandardMaterial({ color: `hsl(${hue}, ${s}%, 55%)`, emissive: `hsl(${hue}, ${s}%, 35%)`, emissiveIntensity: 0.7, transparent: true, opacity: 0.45, depthWrite: false }),
  };
}
