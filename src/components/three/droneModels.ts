import type * as THREE_NS from 'three';

/*==============================================================================
The combat drones as 3D models

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

export const DRONE_IDS = [
  'drone_aegis', 'drone_voltmite', 'drone_needlefinch', 'drone_gravbeetle', 'drone_medicwisp', 'drone_champion',
  'drone_frostsprite', 'drone_salvagecrab', 'drone_embermoth', 'drone_mirrorbat', 'drone_decoygecko', 'drone_scoutowl',
] as const;

/** each drone's tint, as in drones.js */
export const DRONE_TINTS: Record<string, string> = {
  drone_aegis: 'hsl(190, 78%, 60%)',
  drone_voltmite: 'hsl(52, 92%, 58%)',
  drone_needlefinch: 'hsl(16, 85%, 57%)',
  drone_gravbeetle: 'hsl(280, 58%, 62%)',
  drone_medicwisp: 'hsl(145, 60%, 52%)',
  drone_champion: 'hsl(45, 100%, 58%)',
  drone_frostsprite: 'hsl(198, 90%, 72%)',
  drone_salvagecrab: 'hsl(28, 72%, 56%)',
  drone_embermoth: 'hsl(14, 95%, 58%)',
  drone_mirrorbat: 'hsl(215, 22%, 78%)',
  drone_decoygecko: 'hsl(165, 75%, 52%)',
  drone_scoutowl: 'hsl(38, 48%, 60%)',
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
  } else if (id === 'drone_frostsprite') {
    // FROST SPRITE: a six-armed ice crystal round a cold glowing core
    const ice = keep(new T.MeshPhysicalMaterial({ color: shade(0.12, -0.1), roughness: 0.08, metalness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 }));
    const core = mesh(new T.OctahedronGeometry(0.26), glow(shade(0.1, 0.1), 2.6));
    core.scale.set(1, 1.3, 1);
    const star = new T.Group(); g.add(star);
    for (let k = 0; k < 6; k++) {
      const arm = new T.Group(); arm.rotation.y = (k / 6) * Math.PI * 2; star.add(arm);
      const shaft = mesh(new T.OctahedronGeometry(0.5), ice, arm);
      shaft.scale.set(0.16, 0.12, 1); shaft.position.z = -0.52;
      for (const s of [-1, 1]) {
        const barb = mesh(new T.OctahedronGeometry(0.18), ice, arm);
        barb.scale.set(0.12, 0.1, 1); barb.position.set(s * 0.11, 0, -0.62); barb.rotation.y = s * 0.8;
      }
      const tip = mesh(new T.SphereGeometry(0.05, 8, 6), glow(shade(0.2), 2.5), arm);
      tip.position.z = -0.98;
    }
    const halo = mesh(new T.TorusGeometry(0.4, 0.02, 6, 40), glow(shade(0.15), 1.6));
    halo.rotation.x = Math.PI / 2;
    anim = (t) => { star.rotation.y = t * 0.5; core.rotation.y = -t * 1.2; halo.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08); };
  } else if (id === 'drone_salvagecrab') {
    // SALVAGE CRAB: a squat armoured crab with grabbing claws and a magnet on its back
    const shell = metal(shade(-0.02), 0.6, 0.38);
    const body = mesh(new T.SphereGeometry(0.5, 24, 14), shell);
    body.scale.set(1.15, 0.45, 0.85);
    const belly = mesh(new T.SphereGeometry(0.45, 18, 10), dark);
    belly.scale.set(1.15, 0.32, 0.8); belly.position.y = -0.06;
    const claws: THREE_NS.Group[] = [];
    for (const s of [-1, 1]) {
      const arm = mesh(new T.CylinderGeometry(0.06, 0.07, 0.42, 8), shell);
      arm.position.set(s * 0.42, 0, -0.42); arm.rotation.x = Math.PI / 2; arm.rotation.z = s * 0.5;
      const claw = new T.Group(); claw.position.set(s * 0.52, 0.02, -0.66); g.add(claw);
      const top = mesh(new T.BoxGeometry(0.1, 0.07, 0.34), shell, claw); top.position.set(s * 0.05, 0, -0.12);
      const bot = mesh(new T.BoxGeometry(0.1, 0.07, 0.3), metal(shade(-0.12), 0.6, 0.4), claw); bot.position.set(-s * 0.05, 0, -0.1);
      claws.push(claw);
      for (let k = 0; k < 3; k++) {
        const leg = mesh(new T.CylinderGeometry(0.03, 0.02, 0.46, 6), dark);
        leg.position.set(s * 0.6, -0.08, -0.1 + k * 0.22); leg.rotation.z = s * 1.15; leg.rotation.y = s * (0.15 - k * 0.2);
      }
      const stalk = mesh(new T.CylinderGeometry(0.02, 0.02, 0.18, 6), dark);
      stalk.position.set(s * 0.13, 0.24, -0.34);
      const eye = mesh(new T.SphereGeometry(0.055, 10, 8), glow('#d9fff4', 2.4));
      eye.position.set(s * 0.13, 0.34, -0.34);
    }
    // the magnet: a red U with steel poles, on a short mast
    const magnet = new T.Group(); magnet.position.set(0, 0.3, 0.05); g.add(magnet);
    const u = mesh(new T.TorusGeometry(0.2, 0.07, 10, 24, Math.PI), metal('#c8313a', 0.5, 0.35), magnet);
    u.rotation.z = Math.PI;
    for (const s of [-1, 1]) { const pole = mesh(new T.CylinderGeometry(0.075, 0.075, 0.1, 12), steel, magnet); pole.position.set(s * 0.2, 0.04, 0); }
    anim = (t) => {
      const pinch = (Math.sin(t * 3) + 1) * 0.25;
      claws.forEach((c, i) => { c.rotation.y = (i ? -1 : 1) * pinch; });
      magnet.rotation.y = Math.sin(t * 0.9) * 0.6;
    };
  } else if (id === 'drone_embermoth') {
    // EMBER MOTH: a moth with smouldering wings and a glowing ember abdomen
    const fur = metal(shade(-0.25, -0.3), 0.2, 0.7);
    const thorax = mesh(new T.SphereGeometry(0.18, 16, 12), fur);
    thorax.scale.set(1, 0.9, 1.3); thorax.position.z = -0.1;
    const head = mesh(new T.SphereGeometry(0.12, 14, 10), fur);
    head.position.z = -0.34;
    for (let k = 0; k < 3; k++) {
      const seg = mesh(new T.SphereGeometry(0.15 - k * 0.03, 14, 10), glow(new T.Color().setHSL(hsl.h + k * 0.02, 1, 0.5 - k * 0.04), 2.2 - k * 0.4));
      seg.position.z = 0.14 + k * 0.17;
      seg.scale.set(1, 0.85, 1.1);
    }
    for (const s of [-1, 1]) {
      const ant = mesh(new T.CylinderGeometry(0.012, 0.012, 0.36, 5), fur);
      ant.position.set(s * 0.1, 0.06, -0.55); ant.rotation.x = -Math.PI / 2 + 0.35; ant.rotation.z = s * 0.45;
    }
    const wingMat = keep(new T.MeshStandardMaterial({ color: shade(-0.08), emissive: shade(-0.2, 0.2), emissiveIntensity: 0.35, roughness: 0.6, metalness: 0.1, side: T.DoubleSide }));
    const edgeMat = glow(shade(0.05, 0.1), 2);
    const wings: Array<{ grp: THREE_NS.Group; s: number }> = [];
    const fore = new T.Shape(); fore.moveTo(0, 0); fore.bezierCurveTo(0.35, -0.55, 0.95, -0.5, 1.0, -0.2); fore.bezierCurveTo(0.9, 0.05, 0.4, 0.1, 0, 0.05);
    const hind = new T.Shape(); hind.moveTo(0, 0); hind.bezierCurveTo(0.3, 0.1, 0.75, 0.25, 0.7, 0.55); hind.bezierCurveTo(0.45, 0.65, 0.15, 0.4, 0, 0.12);
    for (const s of [-1, 1]) {
      const grp = new T.Group(); grp.position.set(s * 0.1, 0.05, -0.08); g.add(grp);
      for (const [shape, z] of [[fore, 0], [hind, 0.06]] as const) {
        const w = mesh(new T.ShapeGeometry(shape, 16), wingMat, grp);
        w.rotation.x = -Math.PI / 2; w.scale.x = s; w.position.z = z;
        // a hot rim along each wing
        const pts = shape.getPoints(24).map((p) => new T.Vector3(p.x * s, 0.01, -p.y + z));
        const line = new T.Line(keep(new T.BufferGeometry().setFromPoints(pts)), keep(new T.LineBasicMaterial({ color: shade(0.15, 0.1) })));
        grp.add(line);
      }
      const spot = mesh(new T.CircleGeometry(0.1, 16), edgeMat, grp);
      spot.rotation.x = -Math.PI / 2; spot.position.set(s * 0.55, 0.015, 0.3);
      wings.push({ grp, s });
    }
    anim = (t) => { const f = Math.sin(t * 9) * 0.45; wings.forEach((w) => { w.grp.rotation.z = w.s * f; }); };
  } else if (id === 'drone_mirrorbat') {
    // MIRROR BAT: a small dark bat whose wings are polished mirror
    const fur = metal('#1c1f27', 0.4, 0.6);
    const body = mesh(new T.SphereGeometry(0.22, 16, 12), fur);
    body.scale.set(0.9, 0.8, 1.3);
    const head = mesh(new T.SphereGeometry(0.15, 14, 10), fur);
    head.position.z = -0.3;
    for (const s of [-1, 1]) {
      const ear = mesh(new T.ConeGeometry(0.06, 0.2, 8), fur);
      ear.position.set(s * 0.08, 0.14, -0.33); ear.rotation.z = -s * 0.3;
      const eye = mesh(new T.SphereGeometry(0.035, 8, 6), glow('#7ff4ff', 2.6));
      eye.position.set(s * 0.06, 0.05, -0.43);
    }
    // chrome that still reads under a plain lamp (the bay has no
    // reflections to show, and a perfect mirror there renders black)
    const mirror = keep(new T.MeshStandardMaterial({ color: shade(0.2, -0.2), metalness: 0.6, roughness: 0.14, emissive: shade(-0.35), emissiveIntensity: 0.35, side: T.DoubleSide }));
    const wings: Array<{ grp: THREE_NS.Group; s: number }> = [];
    const wing = new T.Shape();
    wing.moveTo(0, -0.15); wing.lineTo(0.55, -0.42); wing.lineTo(1.0, -0.3); wing.quadraticCurveTo(0.85, -0.12, 0.92, 0.05);
    wing.quadraticCurveTo(0.72, -0.02, 0.62, 0.18); wing.quadraticCurveTo(0.45, 0.05, 0.3, 0.22); wing.quadraticCurveTo(0.2, 0.05, 0, 0.12); wing.closePath();
    for (const s of [-1, 1]) {
      const grp = new T.Group(); grp.position.set(s * 0.12, 0.02, 0); g.add(grp);
      const w = mesh(new T.ExtrudeGeometry(wing, { depth: 0.02, bevelEnabled: false }), mirror, grp);
      w.rotation.x = -Math.PI / 2; w.scale.x = s;
      for (const [x, y] of [[0.55, -0.42], [1.0, -0.3], [0.92, 0.05]]) {
        const finger = mesh(new T.CylinderGeometry(0.014, 0.014, Math.hypot(x, y + 0.1), 5), fur, grp);
        finger.position.set(s * x / 2, 0.02, -(y - 0.1) / 2 - 0.05);
        finger.rotation.z = Math.PI / 2; finger.rotation.y = s * Math.atan2(-(y - 0.1), x) * -1;
      }
      wings.push({ grp, s });
    }
    anim = (t) => { const f = Math.sin(t * 2.4) * 0.22; wings.forEach((w) => { w.grp.rotation.z = w.s * f; }); };
  } else if (id === 'drone_decoygecko') {
    // DECOY GECKO: a gecko with a holo-projector tail and a flickering double
    const skin = metal(shade(-0.02), 0.35, 0.45);
    const body = mesh(new T.SphereGeometry(0.3, 18, 12), skin);
    body.scale.set(0.75, 0.42, 1.25);
    const head = mesh(new T.SphereGeometry(0.2, 16, 12), skin);
    head.scale.set(1.05, 0.6, 1.2); head.position.z = -0.45;
    for (const s of [-1, 1]) {
      const eye = mesh(new T.SphereGeometry(0.065, 10, 8), glow('#f7ff9a', 2));
      eye.position.set(s * 0.13, 0.06, -0.5);
      for (const z of [-0.2, 0.22]) {
        const leg = mesh(new T.CylinderGeometry(0.035, 0.03, 0.32, 6), skin);
        leg.position.set(s * 0.3, -0.02, z); leg.rotation.z = s * 1.3; leg.rotation.y = z < 0 ? s * 0.5 : -s * 0.5;
        const pad = mesh(new T.SphereGeometry(0.06, 8, 6), metal(shade(0.12), 0.3, 0.5));
        pad.scale.set(1, 0.4, 1); pad.position.set(s * 0.45, -0.04, z + (z < 0 ? -0.08 : 0.08));
      }
    }
    // the tail curls round to the projector
    const curve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0.35), new T.Vector3(0.05, 0, 0.62), new T.Vector3(0.3, 0, 0.78), new T.Vector3(0.48, 0, 0.6), new T.Vector3(0.36, 0, 0.45)]);
    mesh(new T.TubeGeometry(curve, 24, 0.06, 8), skin);
    const lens = mesh(new T.SphereGeometry(0.08, 12, 10), glow(shade(0.12, 0.15), 3));
    lens.position.set(0.36, 0.05, 0.45);
    // the decoy it throws: a ghost gecko outline, offset and flickering
    const ghostMat = keep(new T.MeshBasicMaterial({ color: shade(0.2, 0.1), wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }));
    const ghost = new T.Group(); ghost.position.set(-0.55, 0.05, 0.1); g.add(ghost);
    const gb = mesh(new T.SphereGeometry(0.3, 10, 6), ghostMat, ghost); gb.scale.set(0.75, 0.42, 1.25);
    const gh = mesh(new T.SphereGeometry(0.2, 8, 6), ghostMat, ghost); gh.scale.set(1.05, 0.6, 1.2); gh.position.z = -0.45;
    ghost.scale.setScalar(0.7);
    anim = (t) => { ghostMat.opacity = 0.2 + Math.max(0, Math.sin(t * 13) * Math.sin(t * 3.1)) * 0.4; lens.scale.setScalar(1 + Math.sin(t * 6) * 0.15); };
  } else if (id === 'drone_scoutowl') {
    // SCOUT OWL: a compact owl with two big lens eyes and a radar dish on its back
    const plume = metal(shade(-0.24, -0.1), 0.5, 0.45);
    const body = mesh(new T.SphereGeometry(0.42, 22, 16), plume);
    body.scale.set(0.9, 0.7, 1.05);
    const face = mesh(new T.SphereGeometry(0.3, 20, 14), metal(shade(0.12, -0.15), 0.4, 0.5));
    face.scale.set(1.3, 0.8, 0.6); face.position.set(0, 0.16, -0.26);
    for (const s of [-1, 1]) {
      const rim = mesh(new T.TorusGeometry(0.15, 0.04, 8, 24), steel);
      rim.position.set(s * 0.17, 0.33, -0.34); rim.rotation.x = -1.95;
      const lensE = mesh(new T.CircleGeometry(0.13, 24), glow('#ffcf6a', 2.4));
      lensE.position.set(s * 0.17, 0.335, -0.345); lensE.rotation.x = -1.95;
      const pupil = mesh(new T.CircleGeometry(0.05, 16), keep(new T.MeshBasicMaterial({ color: '#120b02' })));
      pupil.position.set(s * 0.17, 0.34, -0.348); pupil.rotation.x = -1.95;
      const tuft = mesh(new T.ConeGeometry(0.06, 0.24, 8), plume);
      tuft.position.set(s * 0.26, 0.32, -0.2); tuft.rotation.z = -s * 0.5;
      const wingF = mesh(new T.SphereGeometry(0.3, 16, 10, 0, Math.PI), metal(shade(-0.15), 0.5, 0.45));
      wingF.scale.set(0.35, 0.55, 1.1); wingF.position.set(s * 0.33, 0.02, 0.08); wingF.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const beak = mesh(new T.ConeGeometry(0.05, 0.14, 6), metal('#e3b04a', 0.8, 0.3));
    beak.position.set(0, 0.22, -0.44); beak.rotation.x = -Math.PI / 2 - 0.5;
    const dish = new T.Group(); dish.position.set(0, 0.3, 0.25); g.add(dish);
    const bowl = mesh(new T.SphereGeometry(0.17, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), keep(new T.MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.6, roughness: 0.3, side: T.DoubleSide })), dish);
    bowl.rotation.x = Math.PI * 0.6;
    const feed = mesh(new T.SphereGeometry(0.035, 8, 6), glow(shade(0.1, 0.2), 3), dish);
    feed.position.set(0, 0.06, -0.12);
    anim = (t) => { dish.rotation.y = t * 2.2; };
  }
  return { group: g, anim, dispose() { trash.forEach((d) => d.dispose()); } };
}
