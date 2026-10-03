import type * as THREE_NS from 'three';
import { buildPlane, glowTexture, type BuiltPlane } from './buildPlane';
import type { ShipDef } from '@/components/command/engine';
import { motionFor, type PilotMotion } from './pilotMotion';
import { buildDrone, isDroneId, DRONE_TINTS, type DroneModel } from './droneModels';

/*==============================================================================
The 3D bay - one scene, three framings

  bay   the hangar: an open stage, not a room - a lit grid floor that fades
        out into the screen behind it, a lamp overhead washing a shaft of light
        down onto a turntable pad. The canvas is transparent, so the bay sits
        IN the screen instead of on it as a pasted black box (it used to be a
        walled room with gantries and a ceiling rig, and read exactly like
        that). Used by the hangar, the armory and pre-flight.
  deck  the command deck: no walls - the engine's starfield shows through a
        transparent canvas - just the pad and two slow instrument rings
        measuring the hull.
  pad   game over: the plane back on its pad, in a column beside the run
        results.

The subject is the pilot's real airframe (planeSpecs) in the player's own hull
colour. A drone is its own 3D model (droneModels.ts) - orbiting the hull when
equipped, or alone over the pad when the armory inspects one. Getting a drone
plays its arrival: bought in the Armory, a cargo crate drops onto the pad,
its walls fall away and the drone powers up out of it; equipped in the
hangar, it drops in beside the hull in a burst of light. A trail tints the engine glow and lights a
plume behind the plane. A locked hull sits unpowered behind a containment
field, desaturated, exactly as the 2D bay showed it.

Each pilot lands on the pad its own way when it is selected, idles its own
way, and test-fires a short burst every couple of seconds (pilotMotion.ts).
A locked hull does all of that too, under its field: it is a showroom, and a
hull you cannot see properly is a hull nobody buys.

Drag spins the plane (with inertia); it turns slowly on its own otherwise.
Rendering pauses whenever the canvas is off screen or the tab is hidden.
==============================================================================*/

type Three = typeof THREE_NS;

export type BayMode = 'bay' | 'deck' | 'pad';

export interface BaySubject {
  ship: ShipDef | null;
  color: string;
  accentHue: number;
  trailHue: number | null;
  drone: ShipDef | null;
  unlocked: boolean;
  kind: 'hull' | 'object';
}

export interface BayController {
  setSubject(s: BaySubject, swapDir?: number): void;
  /** the drone in view arrives (crate in the Armory, drop-in beside the hull) */
  playArrival(): void;
  dispose(): void;
}

const LOCKED_GREY = 'hsl(210, 14%, 62%)';

/** A billboard showing a 2D engine drawing (drones), redrawn as it animates. */
function artSprite(T: Three, def: ShipDef, color: string, px: number) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new T.Sprite(mat);
  let tick = 0;
  return {
    sprite,
    redraw() {
      tick += 3;
      ctx.clearRect(0, 0, px, px);
      ctx.save();
      ctx.translate(px / 2, px / 2);
      ctx.shadowColor = color;
      ctx.shadowBlur = px * 0.08;
      try { def.draw(ctx, px * 0.22, color, tick); } catch { /* a draw that throws shows nothing */ }
      ctx.restore();
      tex.needsUpdate = true;
    },
    dispose() { tex.dispose(); mat.dispose(); },
  };
}

export function createBayScene(T: Three, canvas: HTMLCanvasElement, mode: BayMode, compact: boolean): BayController {
  const deck = mode === 'deck';
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, 16 / 9, 0.1, 120);
  const glowTex = glowTexture(T);
  const disposables: Array<{ dispose(): void }> = [glowTex];
  const keep = <X extends { dispose(): void }>(x: X) => { disposables.push(x); return x; };
  const PI = Math.PI;

  /*--- light: physically based units, hence the PI factors ---------------*/
  const hemi = new T.HemisphereLight('#a9c8ff', '#141a26', 0.6 * PI);
  scene.add(hemi);
  // the key light IS the lamp over the pad, so the light you see is the light
  // that falls on the plane
  const LAMP_Y = deck ? 4.6 : 4.4;
  const KEY = 3.2;
  const key = new T.SpotLight('#ffffff', KEY * PI, 30, PI / 4.4, 0.55, 1);
  key.position.set(0, LAMP_Y, 0.4);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  // a soft front fill so the camera side of the hull is never a silhouette
  const fill = new T.DirectionalLight('#dbe9ff', 0.55 * PI);
  fill.position.set(2, 4, 9);
  scene.add(fill);
  const rimL = new T.PointLight('#35e8ff', 1.4 * PI, 18, 1);
  rimL.position.set(-6, 3, -2);
  const rimR = new T.PointLight('#35e8ff', 1.1 * PI, 18, 1);
  rimR.position.set(6, 3, -2);
  const under = new T.PointLight('#35e8ff', 1.6 * PI, 6, 1);
  under.position.set(0, 0.4, 0);
  scene.add(rimL, rimR, under);

  const steel = keep(new T.MeshStandardMaterial({ color: '#28324a', roughness: 0.5, metalness: 0.65 }));
  const accentMat = keep(new T.MeshBasicMaterial({ color: '#35e8ff' }));
  const amber = keep(new T.MeshBasicMaterial({ color: '#ffcf4d' }));

  /*--- the stage (bay and pad): a grid floor that fades into the screen --*/
  if (!deck) {
    const gc = document.createElement('canvas');
    gc.width = gc.height = 512;
    const g = gc.getContext('2d')!;
    g.strokeStyle = 'rgba(53,232,255,0.9)';
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.strokeStyle = 'rgba(53,232,255,0.25)';
    g.lineWidth = 1;
    for (let j = 32; j < 512; j += 64) {
      g.beginPath(); g.moveTo(j, 0); g.lineTo(j, 512); g.stroke();
      g.beginPath(); g.moveTo(0, j); g.lineTo(512, j); g.stroke();
    }
    const grid = keep(new T.CanvasTexture(gc));
    grid.colorSpace = T.SRGBColorSpace;
    grid.wrapS = grid.wrapT = T.RepeatWrapping;
    grid.repeat.set(7, 7);
    grid.anisotropy = 4;
    // the fade: bright under the pad, gone well before the canvas edge
    const fc = document.createElement('canvas');
    fc.width = fc.height = 256;
    const fg = fc.getContext('2d')!;
    const fade = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
    fade.addColorStop(0, '#ffffff');
    fade.addColorStop(0.3, '#8a8a8a');
    fade.addColorStop(0.7, '#1c1c1c');
    fade.addColorStop(1, '#000000');
    fg.fillStyle = fade;
    fg.fillRect(0, 0, 256, 256);
    const fadeTex = keep(new T.CanvasTexture(fc));
    const floor = new T.Mesh(
      keep(new T.PlaneGeometry(26, 26)),
      keep(new T.MeshBasicMaterial({ map: grid, alphaMap: fadeTex, transparent: true, opacity: 0.32, depthWrite: false, color: '#9feeff' })),
    );
    floor.rotation.x = -PI / 2;
    floor.position.y = 0.002;
    scene.add(floor);
    // the plane's shadow still lands on the (now invisible) floor
    const catcher = new T.Mesh(keep(new T.PlaneGeometry(26, 26)), keep(new T.ShadowMaterial({ opacity: 0.45 })));
    catcher.rotation.x = -PI / 2;
    catcher.receiveShadow = true;
    scene.add(catcher);
  }

  /*--- the lamp overhead and the shaft of light it throws -------------------*/
  const lampMat = keep(new T.MeshBasicMaterial({ color: '#35e8ff' }));
  const lamp = new T.Group();
  lamp.position.set(0, LAMP_Y, 0.4);
  scene.add(lamp);
  const lampRing = new T.Mesh(keep(new T.TorusGeometry(0.85, 0.07, 10, 64)), lampMat);
  lampRing.rotation.x = PI / 2;
  lamp.add(lampRing);
  const lampFace = new T.Mesh(keep(new T.CircleGeometry(0.78, 48)), keep(new T.MeshBasicMaterial({ color: '#eafcff' })));
  lampFace.rotation.x = PI / 2;
  lampFace.position.y = -0.02;
  lamp.add(lampFace);
  const lampGlow = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color: '#bff4ff', transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending })));
  lampGlow.scale.set(4.2, 4.2, 1);
  lamp.add(lampGlow);
  const shaftMat = keep(new T.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
  const shaft = new T.Mesh(keep(new T.CylinderGeometry(0.8, 3.3, LAMP_Y - 0.4, 48, 1, true)), shaftMat);
  shaft.position.set(0, (LAMP_Y + 0.4) / 2, 0.4);
  scene.add(shaft);
  // the pool of light the lamp leaves on the pad
  const pool = new T.Mesh(keep(new T.CircleGeometry(3.0, 48)), keep(new T.MeshBasicMaterial({ map: glowTex, color: '#9feeff', transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending })));
  pool.rotation.x = -PI / 2;
  pool.position.y = 0.43;
  scene.add(pool);

  /*--- the turntable pad, its glowing rim and four clamps -----------------*/
  const pad = new T.Group();
  scene.add(pad);
  const base = new T.Mesh(keep(new T.CylinderGeometry(3.4, 3.6, 0.35, 64)), steel);
  base.position.y = 0.17;
  base.receiveShadow = base.castShadow = true;
  pad.add(base);
  const top = new T.Mesh(keep(new T.CylinderGeometry(3.1, 3.1, 0.06, 64)), keep(new T.MeshStandardMaterial({ color: '#1b2539', roughness: 0.3, metalness: 0.75 })));
  top.position.y = 0.37;
  top.receiveShadow = true;
  pad.add(top);
  const rim = new T.Mesh(keep(new T.TorusGeometry(3.35, 0.05, 8, 96)), accentMat);
  rim.rotation.x = PI / 2;
  rim.position.y = 0.36;
  pad.add(rim);
  const rim2Mat = keep(new T.MeshBasicMaterial({ color: '#35e8ff', transparent: true, opacity: 0.5 }));
  const rim2 = new T.Mesh(keep(new T.TorusGeometry(2.2, 0.025, 8, 96)), rim2Mat);
  rim2.rotation.x = PI / 2;
  rim2.position.y = 0.41;
  pad.add(rim2);
  for (let c = 0; c < 4; c++) {
    const a = PI / 4 + (c * PI) / 2;
    const clamp = new T.Mesh(keep(new T.BoxGeometry(0.9, 0.22, 0.3)), steel);
    clamp.position.set(Math.cos(a) * 2.75, 0.5, Math.sin(a) * 2.75);
    clamp.rotation.y = -a;
    clamp.castShadow = true;
    pad.add(clamp);
    const tip = new T.Mesh(keep(new T.BoxGeometry(0.12, 0.06, 0.32)), amber);
    tip.position.set(Math.cos(a) * 2.32, 0.62, Math.sin(a) * 2.32);
    tip.rotation.y = -a;
    pad.add(tip);
  }

  // deck: two slow instrument rings measuring the hull
  const rings: THREE_NS.Mesh[] = [];
  if (deck) {
    for (let i = 0; i < 2; i++) {
      const ring = new T.Mesh(
        keep(new T.TorusGeometry(3.2 + i * 0.4, 0.018, 6, 128, PI * (1.1 + i * 0.3))),
        keep(new T.MeshBasicMaterial({ color: '#35e8ff', transparent: true, opacity: 0.35 - i * 0.12 })),
      );
      ring.rotation.x = PI / 2;
      ring.position.y = 0.6 + i * 0.25;
      scene.add(ring);
      rings.push(ring);
    }
  }

  // dust motes drifting in the light (the bay only)
  let motes: THREE_NS.Points | null = null;
  if (mode === 'bay') {
    const mp: number[] = [];
    for (let mi = 0; mi < (compact ? 120 : 220); mi++) mp.push((Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 8);
    const geo = keep(new T.BufferGeometry());
    geo.setAttribute('position', new T.Float32BufferAttribute(mp, 3));
    motes = new T.Points(geo, keep(new T.PointsMaterial({ color: '#9fe9ff', size: 0.035, transparent: true, opacity: 0.6, depthWrite: false })));
    scene.add(motes);
  }

  // the containment field over a hull you do not own
  // (a light touch: it says "not yours yet", it must not hide the hull)
  const fieldMat = keep(new T.MeshBasicMaterial({ color: '#b9d4ee', wireframe: true, transparent: true, opacity: 0.075, depthWrite: false }));
  const fieldSkin = keep(new T.MeshBasicMaterial({ color: '#7fb6e6', transparent: true, opacity: 0.05, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide }));
  const field = new T.Mesh(keep(new T.IcosahedronGeometry(2.7, 2)), fieldMat);
  field.position.y = 1.3;
  field.visible = false;
  field.add(new T.Mesh(keep(new T.IcosahedronGeometry(2.68, 3)), fieldSkin));
  scene.add(field);

  /*--- test fire: a small pool of bolts and a muzzle flash -----------------*/
  const boltGeo = keep(new T.CylinderGeometry(0.035, 0.035, 1, 8));
  boltGeo.rotateZ(PI / 2);
  type Bolt = { mesh: THREE_NS.Mesh; mat: THREE_NS.MeshBasicMaterial; vel: THREE_NS.Vector3; life: number };
  const bolts: Bolt[] = [];
  for (let bi = 0; bi < 18; bi++) {
    const mat = keep(new T.MeshBasicMaterial({ color: '#9feeff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    const mesh = new T.Mesh(boltGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    bolts.push({ mesh, mat, vel: new T.Vector3(), life: 0 });
  }
  const flash = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })));
  flash.scale.set(1.1, 1.1, 1);
  scene.add(flash);
  // the touchdown ring that runs out across the pad
  const shockMat = keep(new T.MeshBasicMaterial({ color: '#9feeff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  const shock = new T.Mesh(keep(new T.RingGeometry(0.9, 1.05, 64)), shockMat);
  shock.rotation.x = -PI / 2;
  shock.position.y = 0.45;
  scene.add(shock);

  // a trail plume behind the plane, lit in the trail's hue
  const plumeMat = keep(new T.MeshBasicMaterial({ color: '#35e8ff', transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const plume = new T.Mesh(keep(new T.ConeGeometry(0.22, 1.6, 20, 1, true)), plumeMat);
  plume.rotation.z = -PI / 2;
  plume.visible = false;

  /*--- camera framing -------------------------------------------------*/
  let camY = 0;
  function frame(aspect: number) {
    camera.aspect = aspect;
    const narrow = aspect < 1.1;
    if (mode === 'bay') {
      camera.fov = narrow ? 50 : 36;
      camera.position.set(0, compact ? 3.6 : 4.0, narrow ? 11 : 9.5);
      camera.lookAt(0, 1.2, 0);
    } else if (mode === 'deck') {
      // the deck's bay is a small square: frame the hull, let the pad run off
      camera.fov = narrow ? 44 : 34;
      camera.position.set(0, 2.9, 8.4);
      camera.lookAt(0, 1.0, 0);
    } else {
      camera.fov = narrow ? 46 : 34;
      camera.position.set(0, 3.0, 10.5);
      camera.lookAt(0, 1.1, 0);
    }
    camY = camera.position.y;
    camera.updateProjectionMatrix();
  }

  let w = 0;
  let h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height || (r.width === w && r.height === h)) return;
    w = r.width;
    h = r.height;
    renderer.setSize(w, h, false);
    frame(w / h);
  }

  /*--- the subject ----------------------------------------------------*/
  let subject: BaySubject | null = null;
  let plane: BuiltPlane | null = null;
  let object: ReturnType<typeof artSprite> | null = null;
  let escort: ReturnType<typeof artSprite> | null = null;
  let droneObj: DroneModel | null = null;
  let escortDrone: DroneModel | null = null;
  let escortId = '';
  let builtKey = '';
  let escortKey = '';
  // holder carries the yaw (turntable + drag) and the landing's position;
  // poser carries the landing's and the idle's roll and pitch in the plane's
  // own frame (+x is the nose), so a barrel roll rolls about the nose
  const holder = new T.Group();
  holder.position.y = 1.0;
  scene.add(holder);
  const poser = new T.Group();
  holder.add(poser);
  let motion: PilotMotion = motionFor(undefined);
  let landU = 1;
  let landDir = 1;
  let shockT = 0;
  let shake = 0;
  let fireAt = 1.2;
  let shotsLeft = 0;
  let nextShot = 0;
  let noseX = 2;

  function clearSubject() {
    if (plane) { poser.remove(plane.group); plane.dispose(); plane = null; }
    if (object) { holder.remove(object.sprite); object.dispose(); object = null; }
    if (droneObj) { holder.remove(droneObj.group); droneObj.dispose(); droneObj = null; }
    poser.remove(plume);
  }

  function apply(s: BaySubject) {
    const live = s.unlocked;
    const hue = s.accentHue;
    const accent = new T.Color(`hsl(${hue}, 85%, 60%)`);
    rimL.color.copy(accent);
    rimR.color.copy(accent);
    accentMat.color.copy(new T.Color(`hsl(${hue}, 90%, 62%)`));
    rim2Mat.color.copy(accentMat.color);
    lampMat.color.copy(accentMat.color);
    rim2Mat.opacity = live ? 0.5 : 0.3;
    field.visible = !live && s.kind === 'hull';
    under.color.copy(new T.Color(live ? s.color : '#8a96a8'));
    under.intensity = (live ? 1.6 : 1.0) * PI;

    const k = `${s.kind}:${s.ship?.id || ''}:${live ? s.color : 'locked'}`;
    if (k !== builtKey) {
      builtKey = k;
      clearSubject();
      if (s.ship && s.kind === 'hull') {
        // a locked hull keeps a hint of its colour: grey enough to read as
        // "not yours yet", lit enough to see what you would be buying
        const tone = live ? s.color : `#${new T.Color(s.color).lerp(new T.Color(LOCKED_GREY), 0.55).getHexString()}`;
        plane = buildPlane(T, glowTex, s.ship.id, tone);
        if (!live) plane.glows.forEach((gl) => { gl.material.opacity = 0.35; });
        poser.add(plane.group);
        poser.add(plume);
        motion = motionFor(s.ship.id);
        const bb = new T.Box3().setFromObject(plane.group);
        noseX = Number.isFinite(bb.max.x) ? bb.max.x : 2;
      } else if (s.ship && s.kind === 'object' && isDroneId(s.ship.id)) {
        droneObj = buildDrone(T, s.ship.id, DRONE_TINTS[s.ship.id]);
        droneObj.group.scale.setScalar(DRONE_SCALE);
        droneObj.group.position.y = DRONE_Y;
        droneObj.group.traverse((o) => { if ((o as THREE_NS.Mesh).isMesh) o.castShadow = true; });
        holder.add(droneObj.group);
      } else if (s.ship && s.kind === 'object') {
        object = artSprite(T, s.ship, s.color, 256);
        object.sprite.scale.set(3.4, 3.4, 1);
        object.sprite.position.y = 0.8;
        object.redraw();
        holder.add(object.sprite);
      }
    }
    // the trail lights the engines and a plume, in its own hue
    if (plane) {
      const trail = s.trailHue;
      const tint = new T.Color(trail !== null ? `hsl(${trail}, 95%, 62%)` : 'hsl(190, 100%, 65%)');
      plane.glows.forEach((gl) => { if (trail !== null) gl.material.color.copy(tint); });
      plume.visible = live && trail !== null;
      plumeMat.color.copy(tint);
      plume.position.set(plane.tailX - 0.7, 0.22, 0);
    }
    // the escort drone
    const ek = live && s.drone && s.kind === 'hull' ? `${s.drone.id}:${s.drone.color || ''}` : '';
    if (ek !== escortKey) {
      escortKey = ek;
      if (escort) { scene.remove(escort.sprite); escort.dispose(); escort = null; }
      if (escortDrone) { scene.remove(escortDrone.group); escortDrone.dispose(); escortDrone = null; }
      link = -1; beam.visible = false; delete canvas.dataset.link;
      escortId = ek && s.drone ? s.drone.id : '';
      if (ek && s.drone && isDroneId(s.drone.id)) {
        escortDrone = buildDrone(T, s.drone.id, DRONE_TINTS[s.drone.id]);
        escortDrone.group.scale.setScalar(ESCORT_SCALE);
        escortDrone.group.traverse((o) => { if ((o as THREE_NS.Mesh).isMesh) o.castShadow = true; });
        scene.add(escortDrone.group);
      } else if (ek && s.drone) {
        escort = artSprite(T, s.drone, s.drone.color || 'hsl(190, 100%, 70%)', 128);
        escort.sprite.scale.set(0.9, 0.9, 1);
        escort.redraw();
        scene.add(escort.sprite);
      }
    }
  }

  /*--- a drone's arrival -----------------------------------------------
     crate: bought in the Armory. 0-0.55s a cargo crate drops onto the pad,
            0.7-1.15s its walls fall outward and the lid lifts away,
            0.95-2.0s the drone powers up rising and spinning out of it, and
            the touchdown ring runs out across the pad.
     escort: equipped in the hangar. The drone drops in beside the hull,
            growing and spinning, in a burst of sparks.            */
  const ESCORT_SCALE = 0.55;
  // the Armory shows a drone alone, so it fills the pad the way a hull does
  const DRONE_SCALE = 1.75;
  const DRONE_Y = 0.75;
  let arrival: { kind: 'crate' | 'escort'; t: number; tint: THREE_NS.Color } | null = null;
  let crate: { group: THREE_NS.Group; walls: THREE_NS.Group[]; lid: THREE_NS.Mesh; stripe: THREE_NS.MeshStandardMaterial } | null = null;
  const sparkMat = keep(new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  const sparkGeo = keep(new T.SphereGeometry(0.05, 6, 6));
  const sparks: Array<{ m: THREE_NS.Mesh; a: number; v: number }> = [];
  for (let si = 0; si < 18; si++) {
    const m = new T.Mesh(sparkGeo, sparkMat);
    m.visible = false;
    scene.add(m);
    sparks.push({ m, a: (si / 18) * PI * 2, v: 0.6 + (si % 5) * 0.18 });
  }
  function buildCrate() {
    const group = new T.Group();
    const mat = keep(new T.MeshStandardMaterial({ color: '#2a3442', metalness: 0.75, roughness: 0.35 }));
    const stripe = keep(new T.MeshStandardMaterial({ color: '#35e8ff', emissive: new T.Color('#35e8ff'), emissiveIntensity: 0.6 }));
    const wallGeo = keep(new T.BoxGeometry(2.0, 1.7, 0.1));
    const stripeGeo = keep(new T.BoxGeometry(1.5, 0.1, 0.12));
    const walls: THREE_NS.Group[] = [];
    for (const yaw of [0, PI / 2, PI, -PI / 2]) {
      const hinge = new T.Group(); hinge.rotation.y = yaw; group.add(hinge);
      const inner = new T.Group(); inner.position.z = 1.0; hinge.add(inner);
      const wall = new T.Mesh(wallGeo, mat); wall.position.y = 0.85; wall.castShadow = true; inner.add(wall);
      const st = new T.Mesh(stripeGeo, stripe); st.position.y = 1.25; inner.add(st);
      walls.push(inner);
    }
    const lid = new T.Mesh(keep(new T.BoxGeometry(2.1, 0.12, 2.1)), mat);
    lid.position.y = 1.74; lid.castShadow = true;
    group.add(lid);
    group.position.y = 0.4;
    group.visible = false;
    scene.add(group);
    return { group, walls, lid, stripe };
  }
  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  /* the link-up: a pilot and its drone, together. The drone leaves its
     orbit for formation off the nose, a beam joins them in the pilot's
     colour (its test-fire hue), the plane fires a burst, and the drone
     goes back to its orbit. Plays when a drone is equipped and when a
     pilot lands with one already riding along. */
  let link = -1;
  const beamMat = keep(new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  const beam = new T.Mesh(keep(new T.CylinderGeometry(0.035, 0.035, 1, 10, 1, true)), beamMat);
  beam.visible = false;
  scene.add(beam);
  const linkFrom = new T.Vector3();
  const linkTo = new T.Vector3();
  const beamUp = new T.Vector3(0, 1, 0);
  function startLink() {
    if (reduced || !escortDrone || !plane) return;
    link = 0;
    beamMat.color.set(`hsl(${motion.fire.hue}, 100%, 66%)`);
    canvas.dataset.link = '1';
    loop();
  }
  function startArrival(kind: 'crate' | 'escort', id: string) {
    if (reduced) return;
    if (kind === 'crate' && !crate) crate = buildCrate();
    arrival = { kind, t: 0, tint: new T.Color(DRONE_TINTS[id] || '#35e8ff') };
    sparkMat.color.copy(arrival.tint);
    if (crate) { crate.stripe.color.copy(arrival.tint); crate.stripe.emissive.copy(arrival.tint); }
    canvas.dataset.arrival = kind;
    loop();
  }
  // returns the drone's scale and lift for this frame
  function stepArrival(dt: number): { s: number; lift: number; spin: number } | null {
    if (!arrival) return null;
    arrival.t += dt;
    const a = arrival.t;
    let out = { s: 1, lift: 0, spin: 0 };
    let burstU = -1;
    let burstAt = new T.Vector3();
    if (arrival.kind === 'crate' && crate) {
      crate.group.visible = a < 2.2;
      crate.group.position.y = 0.4 + (a < 0.55 ? 5 * (1 - ease(a / 0.55)) : 0);
      const open = ease((a - 0.7) / 0.45);
      crate.walls.forEach((w) => { w.rotation.x = open * 1.45; });
      crate.lid.position.y = 1.74 + open * 3;
      crate.lid.visible = open < 0.98;
      const rise = ease((a - 0.95) / 1.05);
      out = { s: 0.3 + 0.7 * rise, lift: -1.2 * (1 - rise), spin: (1 - rise) * 9 * dt };
      if (a >= 1.0 && a - dt < 1.0) shockT = 1;
      burstU = (a - 1.0) / 0.8;
      burstAt.set(0, 1.0, 0);
      if (a > 2.3) { arrival = null; crate.group.visible = false; }
    } else {
      const u = ease(a / 0.9);
      out = { s: Math.max(0.01, u), lift: 1.4 * (1 - u), spin: (1 - u) * 14 * dt };
      burstU = (a - 0.55) / 0.7;
      if (escortDrone) burstAt = escortDrone.group.position.clone();
      if (a > 1.3) { arrival = null; startLink(); }
    }
    sparks.forEach((p) => {
      const on = burstU > 0 && burstU < 1;
      p.m.visible = on;
      if (!on) return;
      const k = burstU;
      p.m.position.set(burstAt.x + Math.cos(p.a) * k * 1.6 * p.v, burstAt.y - 0.2 + k * p.v * 1.1, burstAt.z + Math.sin(p.a) * k * 1.6 * p.v);
    });
    sparkMat.opacity = burstU > 0 && burstU < 1 ? 1 - burstU : 0;
    if (!arrival) delete canvas.dataset.arrival;
    return out;
  }

  /*--- drag to spin ---------------------------------------------------*/
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0.6;
  let vel = 0;
  let dragging = false;
  let lastX = 0;
  const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    vel = dx * 0.012;
    yaw += vel;
  };
  const onUp = () => { dragging = false; };
  if (mode !== 'pad') {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    // vertical swipes still scroll the page on a phone
    canvas.style.touchAction = 'pan-y';
  }

  /*--- loop -----------------------------------------------------------*/
  let raf = 0;
  let visible = true;
  let frameNo = 0;
  const t0 = performance.now();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); if (visible) loop(); })
    : null;
  io?.observe(canvas);
  const onVis = () => { if (!document.hidden) loop(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const fwd = new T.Vector3();
  const muzzle = new T.Vector3();
  let boltIx = 0;
  function shoot() {
    if (!plane) return;
    const f = motion.fire;
    const n = f.guns.length;
    f.guns.forEach((gz, gi) => {
      const b = bolts[boltIx++ % bolts.length];
      const fan = n > 1 ? (gi / (n - 1) - 0.5) * f.fan : (Math.random() - 0.5) * f.fan;
      muzzle.set(noseX + 0.1, 0.15, gz);
      plane!.group.localToWorld(muzzle);
      fwd.set(Math.cos(fan), 0, -Math.sin(fan)).applyQuaternion(plane!.group.getWorldQuaternion(new T.Quaternion())).normalize();
      b.mesh.position.copy(muzzle).addScaledVector(fwd, f.len / 2);
      b.mesh.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), fwd);
      b.mesh.scale.set(f.len, 1, 1);
      b.vel.copy(fwd).multiplyScalar(f.speed);
      b.mat.color.set(`hsl(${f.hue}, 100%, 72%)`);
      b.life = 0.42;
      b.mat.opacity = 1;
      b.mesh.visible = true;
      if (gi === 0) {
        flash.position.copy(muzzle);
        flash.material.color.set(`hsl(${f.hue}, 100%, 80%)`);
        flash.material.opacity = 0.95;
      }
    });
  }

  let lastNow = performance.now();
  function loop() {
    if (raf) return;
    raf = requestAnimationFrame(tickFrame);
  }
  function tickFrame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    resize();
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    frameNo++;
    if (!dragging) {
      if (Math.abs(vel) > 0.0005) { yaw += vel; vel *= 0.94; } else if (!reduced) yaw += 0.004;
    }
    // the pilot's own landing, then its own idle
    const isHull = !!plane;
    if (landU < 1) {
      landU = Math.min(1, landU + dt / motion.landTime);
      if (landU >= 1) {
        // touchdown: a ring runs out across the pad, the pad flares, and a
        // heavy hull shakes the bay
        shockT = 1;
        shake = motion.impact >= 0.9 ? 1 : 0;
        fireAt = t + 0.7;
        // a pilot that lands with a drone riding along links up with it
        if (escortDrone && !arrival) startLink();
      }
    }
    const lp = isHull && !reduced ? motion.land(landU, landDir) : null;
    // the deck and the game-over pad are small frames: same landing, a
    // shorter flight, so it never enters from outside the canvas
    const reach = mode === 'bay' ? 1 : 0.3;
    if (lp) { lp.x *= reach; lp.y *= reach; lp.z *= reach; }
    const id = isHull && !reduced && landU >= 1 ? motion.idle(t) : null;
    holder.position.set(
      (lp ? lp.x : 0) + (id ? id.jx : 0),
      1.0 + (lp ? lp.y : 0) + (id ? id.y : reduced ? 0 : Math.sin(t * 1.4) * 0.05),
      (lp ? lp.z : 0) + (id ? id.jz : 0),
    );
    holder.rotation.y = yaw + (lp ? lp.ry : 0) + (id ? id.ry : 0);
    poser.rotation.x = (lp ? lp.rx : 0) + (id ? id.rx : 0);
    poser.rotation.z = (lp ? lp.rz : 0) + (id ? id.rz : 0);
    holder.scale.setScalar(lp ? lp.s : 1);
    if (plane) plane.group.visible = !(lp && lp.flicker > 0 && Math.random() < lp.flicker * 0.55);
    // the lamp beam brightens while a hull is coming in under it
    const arriving = isHull ? 1 - landU : 0;
    shaftMat.opacity = 0.045 + arriving * 0.12;
    lampGlow.material.opacity = 0.75 + arriving * 0.25 + Math.sin(t * 2.1) * 0.05;
    key.intensity = KEY * ((subject?.unlocked ?? true) ? 1 : 0.8) * PI * (1 + arriving * 0.5 + shockT * 0.4);
    if (shockT > 0) {
      shockT = Math.max(0, shockT - dt * 1.8);
      const r = 1 + (1 - shockT) * 2.6;
      shock.scale.set(r, r, 1);
      shockMat.opacity = shockT * (0.35 + motion.impact * 0.5);
      rim2Mat.opacity = ((subject?.unlocked ?? true) ? 0.5 : 0.3) + shockT * 0.5;
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 3);
      camera.position.y = camY + Math.sin(t * 70) * shake * 0.08;
    } else if (camera.position.y !== camY) camera.position.y = camY;

    // test fire: a burst in the pilot's own pattern, every couple of seconds
    if (plane && !reduced && landU >= 1 && mode !== 'pad') {
      if (shotsLeft === 0 && t >= fireAt) { shotsLeft = motion.fire.burst; nextShot = t; }
      if (shotsLeft > 0 && t >= nextShot) {
        shoot();
        shotsLeft--;
        nextShot = t + motion.fire.gap;
        if (shotsLeft === 0) fireAt = t + motion.fire.every;
      }
    }
    for (const b of bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mat.opacity = Math.max(0, Math.min(1, b.life / 0.18));
      if (b.life <= 0) b.mesh.visible = false;
    }
    if (flash.material.opacity > 0) flash.material.opacity = Math.max(0, flash.material.opacity - dt * 9);
    if (plane) plane.anim.forEach((f) => f(t));
    if (plume.visible) {
      (plume.material as THREE_NS.MeshBasicMaterial).opacity = 0.32 + Math.sin(t * 10) * 0.08;
      plume.scale.set(1, 0.9 + Math.sin(t * 17) * 0.1, 1);
    }
    if (object && frameNo % 3 === 0) object.redraw();
    const arr = stepArrival(dt);
    if (droneObj) {
      droneObj.anim(t);
      const crateArr = arr && arrival?.kind !== 'escort' ? arr : null;
      droneObj.group.scale.setScalar(DRONE_SCALE * (crateArr ? crateArr.s : 1));
      droneObj.group.position.y = DRONE_Y + (crateArr ? crateArr.lift : 0);
      if (crateArr) yaw += crateArr.spin;
    }
    if (escortDrone) {
      const a = t * 0.9;
      const g = escortDrone.group;
      const escArr = arr && arrival?.kind === 'escort' ? arr : null;
      g.position.set(Math.cos(a) * 3.0, 1.7 + Math.sin(t * 1.3) * 0.15 + (escArr ? escArr.lift : 0), Math.sin(a) * 1.6);
      if (link >= 0 && plane) {
        link += dt;
        const L = link;
        // 0-0.5s into formation, hold, 1.3-1.9s back to the orbit
        const w = L < 0.5 ? ease(L / 0.5) : L < 1.3 ? 1 : 1 - ease((L - 1.3) / 0.6);
        linkTo.set(noseX * 0.35, 1.0, 1.1);
        plane.group.localToWorld(linkTo);
        g.position.lerp(linkTo, w);
        // the beam, drone to hull, while they are together
        const on = L > 0.35 && L < 1.45;
        beam.visible = on;
        if (on) {
          plane.group.getWorldPosition(linkFrom);
          const len = linkFrom.distanceTo(g.position);
          beam.position.copy(linkFrom).add(g.position).multiplyScalar(0.5);
          beam.quaternion.setFromUnitVectors(beamUp, linkTo.copy(g.position).sub(linkFrom).normalize());
          beam.scale.set(1 + Math.sin(L * 30) * 0.3, len, 1 + Math.sin(L * 30) * 0.3);
          beamMat.opacity = Math.sin(((L - 0.35) / 1.1) * Math.PI) * 0.9;
        }
        // the plane answers with a burst in its own pattern
        if (L >= 0.55 && L - dt < 0.55 && mode !== 'pad') { shotsLeft = motion.fire.burst; nextShot = t; }
        if (L > 1.9) { link = -1; beam.visible = false; delete canvas.dataset.link; }
      }
      g.scale.setScalar(ESCORT_SCALE * (escArr ? escArr.s : 1));
      // nose along its orbit (front is -z); the crest stays facing the camera
      const vx = -Math.sin(a) * 3.0, vz = Math.cos(a) * 1.6;
      g.rotation.y = escortId === 'drone_champion' ? PI + Math.sin(t * 0.8) * 0.4 : Math.atan2(-vx, -vz);
      if (escArr) g.rotation.y += arrival ? arrival.t * 14 * (1 - Math.min(1, arrival.t / 0.9)) : 0;
      escortDrone.anim(t);
    }
    if (escort) {
      const a = t * 0.9;
      escort.sprite.position.set(Math.cos(a) * 3.0, 1.7 + Math.sin(t * 1.3) * 0.15, Math.sin(a) * 1.6);
      if (frameNo % 3 === 0) escort.redraw();
    }
    if (motes) motes.rotation.y = t * 0.02;
    rings.forEach((r, i) => { r.rotation.z = (i ? -1 : 1) * t * 0.12; });
    renderer.render(scene, camera);
    loop();
  }

  // a drone bought while the Armory shows it is delivered by crate
  const onPurchase = (e: Event) => {
    const d = (e as CustomEvent).detail || {};
    if (d.status === 'done' && droneObj && subject?.ship?.id === d.itemId) startArrival('crate', d.itemId);
  };
  window.addEventListener('raidshooter:purchase', onPurchase);

  resize();
  loop();

  return {
    setSubject(s, dir) {
      const changed = !subject || subject.ship?.id !== s.ship?.id || subject.kind !== s.kind;
      const prevDrone = subject ? subject.drone?.id || '' : null;
      subject = s;
      apply(s);
      // a drone just equipped in the hangar drops in beside the hull
      if (prevDrone !== null && s.drone && s.drone.id !== prevDrone && escortDrone && s.kind === 'hull') startArrival('escort', s.drone.id);
      // a new pilot lands - from the side it was paged in from, if it was
      if (changed && s.kind === 'hull' && s.ship) {
        landU = reduced ? 1 : 0;
        landDir = dir && dir < 0 ? -1 : 1;
        shotsLeft = 0;
        bolts.forEach((b) => { b.life = 0; b.mesh.visible = false; });
      }
      loop();
    },
    playArrival() {
      if (droneObj && subject?.ship) startArrival('crate', subject.ship.id);
      else if (escortDrone && subject?.drone) startArrival('escort', subject.drone.id);
    },
    dispose() {
      window.removeEventListener('raidshooter:purchase', onPurchase);
      cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      clearSubject();
      if (escort) escort.dispose();
      if (escortDrone) escortDrone.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
