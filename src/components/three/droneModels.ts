import type * as THREE_NS from 'three';

/*==============================================================================
The six combat drones as 3D models

Unit radius, nose/front toward -z (screen up when seen from above), top toward
+y. Each returns its group plus `anim(t)` for the parts that move (spinning
brackets, sparking coils, orbiting motes). Colour comes from the drone's own
tint (drones.js `color`, mirrored in DRONE_TINTS), so a recolour still works.

Used twice: live in the hangar bay and Armory (bayScene.ts), and baked
straight down into the raid's sprite sheets (objectSprites.ts) - the fight
draws the drone from those, so keep both the 2D drawing in drones.js and the
model here describing the same drone.
==============================================================================*/

type Three = typeof THREE_NS;

export interface DroneModel {
  group: THREE_NS.Group;
  anim: (t: number) => void;
  dispose(): void;
}

export const DRONE_IDS = ['drone_aegis', 'drone_voltmite', 'drone_needlefinch', 'drone_gravbeetle', 'drone_medicwisp', 'drone_champion'] as const;

/** each drone's tint, as in drones.js */
export const DRONE_TINTS: Record<string, string> = {
  drone_aegis: 'hsl(190, 78%, 60%)',
  drone_voltmite: 'hsl(52, 92%, 58%)',
  drone_needlefinch: 'hsl(16, 85%, 57%)',
  drone_gravbeetle: 'hsl(280, 58%, 62%)',
  drone_medicwisp: 'hsl(145, 60%, 52%)',
  drone_champion: 'hsl(45, 100%, 58%)',
};

export const isDroneId = (id: string) => (DRONE_IDS as readonly string[]).includes(id);

export function buildDrone(T: Three, id: string, tint: string): DroneModel {
  const g = new T.Group();
  const trash: Array<{ dispose(): void }> = [];
  const keep = <X extends { dispose(): void }>(x: X) => { trash.push(x); return x; };
  const col = new T.Color(tint);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  const shade = (dl: number, ds = 0) => new T.Color().setHSL(hsl.h, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(1, Math.max(0, hsl.l + dl)));
  const metal = (c: THREE_NS.Color | string, m = 0.75, r = 0.32) => keep(new T.MeshStandardMaterial({ color: c, metalness: m, roughness: r }));
  // lit parts: a saturated colour that glows without blowing out to white
  const glow = (c: THREE_NS.Color | string, k = 1) => keep(new T.MeshStandardMaterial({ color: c, emissive: new T.Color(c), emissiveIntensity: Math.min(1.1, k * 0.45), roughness: 0.3 }));
  const mesh = (geo: THREE_NS.BufferGeometry, mat: THREE_NS.Material, parent: THREE_NS.Object3D = g) => { const m = new T.Mesh(keep(geo), mat); parent.add(m); return m; };
  const dark = metal('#262c35', 0.8, 0.4);
  const steel = metal('#9aa3ad', 0.95, 0.25);
  let anim: (t: number) => void = () => {};

  if (id === 'drone_aegis') {
    // AEGIS HALO: a hex shield pod inside two bracket arcs that turn round it
    const body = metal(shade(-0.05), 0.6, 0.3);
    const pod = mesh(new T.CylinderGeometry(0.42, 0.48, 0.34, 6), body);
    pod.rotation.y = Math.PI / 6;
    mesh(new T.CylinderGeometry(0.3, 0.3, 0.38, 6), dark).rotation.y = Math.PI / 6;
    const core = mesh(new T.SphereGeometry(0.17, 20, 12), glow(shade(0.08, 0.25), 3));
    core.position.y = 0.16;
    const halo = new T.Group(); g.add(halo);
    for (const s of [0, Math.PI]) {
      const arc = mesh(new T.TorusGeometry(0.86, 0.09, 10, 40, Math.PI * 0.62), metal(shade(0.05), 0.7, 0.25), halo);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = s + Math.PI * 0.19;
      // a lit edge strip along each bracket
      const strip = mesh(new T.TorusGeometry(0.86, 0.025, 6, 40, Math.PI * 0.62), glow(shade(0.1, 0.2), 2.4), halo);
      strip.rotation.x = Math.PI / 2;
      strip.rotation.z = s + Math.PI * 0.19;
      strip.position.y = 0.09;
    }
    anim = (t) => { halo.rotation.y = t * 0.9; core.scale.setScalar(1 + Math.sin(t * 3) * 0.08); };
  } else if (id === 'drone_voltmite') {
    // VOLT MITE: a little beetle-bodied mite with two tesla coils that spark
    const shell = metal(shade(-0.02), 0.55, 0.35);
    const b = mesh(new T.SphereGeometry(0.46, 24, 16), shell);
    b.scale.set(1, 0.62, 1.15);
    const belly = mesh(new T.SphereGeometry(0.4, 20, 12), dark);
    belly.scale.set(1.05, 0.45, 1.1); belly.position.y = -0.08;
    const eye = mesh(new T.SphereGeometry(0.12, 14, 10), glow(shade(0.1, 0.2), 2.5));
    eye.position.set(0, 0.06, -0.48);
    const tips: THREE_NS.Mesh[] = [];
    for (const s of [-1, 1]) {
      const coil = mesh(new T.CylinderGeometry(0.05, 0.07, 0.62, 10), steel);
      coil.position.set(s * 0.24, 0.42, -0.12); coil.rotation.z = -s * 0.32;
      for (let k = 0; k < 3; k++) {
        const ring = mesh(new T.TorusGeometry(0.085, 0.022, 6, 16), metal('#c98a2b', 0.9, 0.3));
        ring.rotation.x = Math.PI / 2; ring.position.set(s * (0.2 + k * 0.035), 0.24 + k * 0.12, -0.12);
      }
      const tip = mesh(new T.SphereGeometry(0.1, 14, 10), glow(shade(0.12, 0.2), 3.2));
      tip.position.set(s * 0.34, 0.72, -0.12);
      tips.push(tip);
      // four little legs
      for (const z of [-0.2, 0.25]) {
        const leg = mesh(new T.CylinderGeometry(0.03, 0.02, 0.4, 6), dark);
        leg.position.set(s * 0.5, -0.12, z); leg.rotation.z = s * 1.0;
      }
    }
    // the arc between the coils: a jagged glowing line rebuilt as it flickers
    const arcMat = keep(new T.LineBasicMaterial({ color: shade(0.4, 0.2), transparent: true }));
    const arcGeo = keep(new T.BufferGeometry());
    const pts = new Float32Array(9 * 3);
    arcGeo.setAttribute('position', new T.BufferAttribute(pts, 3));
    const arc = new T.Line(arcGeo, arcMat); g.add(arc);
    anim = (t) => {
      const flick = Math.sin(t * 23) * Math.sin(t * 7.3);
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        const jit = i === 0 || i === 8 ? 0 : (Math.sin(t * 40 + i * 2.3) * 0.06);
        pts[i * 3] = -0.34 + u * 0.68; pts[i * 3 + 1] = 0.72 + jit + Math.sin(u * Math.PI) * 0.08; pts[i * 3 + 2] = -0.12 + jit;
      }
      arcGeo.attributes.position.needsUpdate = true;
      arcMat.opacity = flick > -0.2 ? 0.95 : 0.15;
      tips.forEach((tp) => tp.scale.setScalar(1 + Math.max(0, flick) * 0.35));
    };
  } else if (id === 'drone_needlefinch') {
    // NEEDLE FINCH: a dart bird - needle beak, swept wings, a hot tail
    const hull = metal(shade(0), 0.6, 0.3);
    const body = mesh(new T.CylinderGeometry(0.16, 0.24, 0.95, 16), hull);
    body.rotation.x = Math.PI / 2;
    const beak = mesh(new T.ConeGeometry(0.15, 0.85, 16), steel);
    beak.rotation.x = -Math.PI / 2; beak.position.z = -0.9;
    const canopy = mesh(new T.SphereGeometry(0.13, 16, 10), glow(shade(0.12, 0.2), 1.6));
    canopy.scale.set(1, 0.7, 1.6); canopy.position.set(0, 0.13, -0.18);
    const wing = new T.Shape();
    wing.moveTo(0, 0); wing.lineTo(0.95, 0.45); wing.lineTo(0.85, 0.62); wing.lineTo(0.1, 0.42); wing.closePath();
    const wingGeo = new T.ExtrudeGeometry(wing, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    for (const s of [-1, 1]) {
      const w = mesh(wingGeo.clone(), metal(shade(-0.08), 0.6, 0.35));
      w.rotation.x = -Math.PI / 2; w.scale.x = s; w.position.set(0, 0, -0.05);
      const fin = mesh(new T.BoxGeometry(0.04, 0.22, 0.3), hull);
      fin.position.set(s * 0.14, 0.12, 0.4); fin.rotation.z = s * 0.4;
    }
    keep(wingGeo);
    const jet = mesh(new T.SphereGeometry(0.15, 14, 10), glow(shade(0.08, 0.25), 3));
    jet.scale.set(1, 1, 1.6); jet.position.z = 0.55;
    anim = (t) => { jet.scale.set(1, 1, 1.4 + Math.sin(t * 17) * 0.3); g.rotation.z = Math.sin(t * 1.7) * 0.12; };
  } else if (id === 'drone_gravbeetle') {
    // GRAV BEETLE: a heavy split carapace over a dark gravity well that pulls
    const shellMat = metal(shade(-0.08, -0.1), 0.7, 0.28);
    for (const s of [-1, 1]) {
      const half = mesh(new T.SphereGeometry(0.62, 28, 16, s > 0 ? 0 : Math.PI, Math.PI, 0, Math.PI / 2), shellMat);
      half.scale.set(1, 0.7, 1.25); half.position.x = s * 0.08; half.rotation.z = -s * 0.08;
    }
    const seam = mesh(new T.BoxGeometry(0.1, 0.06, 1.4), glow(shade(0.05, 0.25), 2.2));
    seam.position.y = 0.36;
    const under = mesh(new T.CylinderGeometry(0.6, 0.5, 0.14, 24), dark);
    under.position.y = -0.04;
    // the gravity well: a dark lens set into the tail, lit from inside
    const well = mesh(new T.SphereGeometry(0.15, 20, 12), keep(new T.MeshStandardMaterial({ color: '#07030c', emissive: shade(-0.1, 0.2), emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.4 })));
    well.scale.set(1, 0.5, 1); well.position.set(0, 0.18, 0.6);
    const ring = mesh(new T.TorusGeometry(0.98, 0.04, 8, 48), glow(shade(0.05, 0.25), 1.8));
    ring.rotation.x = Math.PI / 2 - 0.25;
    for (const s of [-1, 1]) {
      const horn = mesh(new T.ConeGeometry(0.07, 0.4, 10), steel);
      horn.position.set(s * 0.22, 0.1, -0.78); horn.rotation.x = -Math.PI / 2 + 0.3; horn.rotation.z = s * 0.3;
    }
    anim = (t) => { ring.rotation.z = t * 1.4; ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05); well.scale.setScalar(1 + Math.sin(t * 4) * 0.1); };
  } else if (id === 'drone_medicwisp') {
    // MEDIC WISP: a soft glass orb with a lit cross, trailing healing motes
    const shellMat = keep(new T.MeshPhysicalMaterial({ color: shade(0.15), roughness: 0.1, metalness: 0, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1 }));
    mesh(new T.SphereGeometry(0.62, 32, 20), shellMat);
    const core = mesh(new T.SphereGeometry(0.34, 24, 16), glow(shade(0.0, 0.2), 1.6));
    core.position.y = 0.02;
    const cross = new T.Group(); g.add(cross);
    const crossMat = glow('#e9fff0', 2.6);
    mesh(new T.BoxGeometry(0.38, 0.1, 0.12), crossMat, cross);
    mesh(new T.BoxGeometry(0.12, 0.1, 0.38), crossMat, cross);
    cross.position.y = 0.6;
    const band = mesh(new T.TorusGeometry(0.63, 0.04, 8, 40), metal('#e8edf2', 0.8, 0.25));
    band.rotation.x = Math.PI / 2;
    const motes: THREE_NS.Mesh[] = [];
    for (let i = 0; i < 4; i++) motes.push(mesh(new T.SphereGeometry(0.07, 10, 8), glow(shade(0.1, 0.25), 3)));
    anim = (t) => {
      motes.forEach((m, i) => {
        const a = t * 1.6 + i * Math.PI / 2;
        m.position.set(Math.cos(a) * 0.9, Math.sin(t * 2 + i) * 0.2, Math.sin(a) * 0.9);
      });
      core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.07);
    };
  } else if (id === 'drone_champion') {
    // CHAMPION CREST: a gold crown crest with a ruby, carried on two laurel wings
    const gold = metal('#e8b53a', 1, 0.22);
    const base = mesh(new T.CylinderGeometry(0.5, 0.55, 0.3, 32, 1, true), gold);
    base.material.side = T.DoubleSide;
    mesh(new T.CylinderGeometry(0.47, 0.47, 0.06, 32), gold).position.y = -0.13;
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2;
      const spike = mesh(new T.ConeGeometry(0.11, 0.42, 4), gold);
      spike.position.set(Math.cos(a) * 0.48, 0.34, Math.sin(a) * 0.48);
      const pearl = mesh(new T.SphereGeometry(0.06, 10, 8), metal('#fff6dc', 0.3, 0.2));
      pearl.position.set(Math.cos(a) * 0.48, 0.58, Math.sin(a) * 0.48);
    }
    const ruby = mesh(new T.OctahedronGeometry(0.16), keep(new T.MeshPhysicalMaterial({ color: '#d4123a', emissive: new T.Color('#5a0010'), roughness: 0.05, metalness: 0.1, clearcoat: 1 })));
    ruby.position.set(0, 0, -0.55); ruby.scale.set(1, 1.3, 0.6);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        // laurel sprigs hugging the band, rising toward the back
        const leaf = mesh(new T.SphereGeometry(0.12, 10, 8), metal('#d9a22a', 1, 0.3));
        leaf.scale.set(1.5, 0.3, 0.6);
        const a = Math.PI * (0.62 + k * 0.1);
        leaf.position.set(s * Math.sin(a) * 0.62, -0.06 + k * 0.07, -Math.cos(a) * 0.62);
        leaf.rotation.y = -s * (a - Math.PI / 2) + s * 0.4;
      }
    }
    anim = (t) => { ruby.rotation.y = t * 1.5; };
  }
  return { group: g, anim, dispose() { trash.forEach((d) => d.dispose()); } };
}
