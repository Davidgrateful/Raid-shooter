import type * as THREE_NS from 'three';
import { buildPlane, glowTexture, type BuiltPlane } from './buildPlane';
import type { ShipDef } from '@/components/command/engine';

/*==============================================================================
The 3D bay - one scene, three framings

  bay   the hangar: deck floor with a lit grid, a ribbed back wall with light
        strips, two service gantries, a ceiling rig washing a light shaft down
        onto a turntable pad. Used by the hangar, the armory and pre-flight.
  deck  the command deck: no walls - the engine's starfield shows through a
        transparent canvas - just the pad and two slow instrument rings
        measuring the hull.
  pad   game over: the plane back on its pad, in a column beside the run
        results.

The subject is the pilot's real airframe (planeSpecs) in the player's own hull
colour. A drone has no 3D model, so it is shown as its 2D art on a billboard
that always faces the camera - orbiting the hull when equipped, or alone on the
cradle when the armory inspects one. A trail tints the engine glow and lights a
plume behind the plane. A locked hull sits unpowered behind a containment
field, desaturated, exactly as the 2D bay showed it.

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
  dispose(): void;
}

const LOCKED_GREY = 'hsl(210, 12%, 46%)';

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
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: deck, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  if (deck) renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  if (!deck) {
    scene.background = new T.Color('#03050a');
    scene.fog = new T.Fog('#03050a', 16, 46);
  }
  const camera = new T.PerspectiveCamera(36, 16 / 9, 0.1, 120);
  const glowTex = glowTexture(T);
  const disposables: Array<{ dispose(): void }> = [glowTex];
  const keep = <X extends { dispose(): void }>(x: X) => { disposables.push(x); return x; };
  const PI = Math.PI;

  /*--- light: physically based units, hence the PI factors ---------------*/
  const hemi = new T.HemisphereLight('#8fb8ff', '#0a0d14', 0.35 * PI);
  scene.add(hemi);
  const key = new T.SpotLight('#ffffff', 2.4 * PI, 40, PI / 7, 0.45, 1);
  key.position.set(0, 13, 3);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rimL = new T.PointLight('#35e8ff', 1.4 * PI, 18, 1);
  rimL.position.set(-6, 3, -2);
  const rimR = new T.PointLight('#35e8ff', 1.1 * PI, 18, 1);
  rimR.position.set(6, 3, -2);
  const under = new T.PointLight('#35e8ff', 1.6 * PI, 6, 1);
  under.position.set(0, 0.4, 0);
  scene.add(rimL, rimR, under);

  const steel = keep(new T.MeshStandardMaterial({ color: '#141b28', roughness: 0.6, metalness: 0.7 }));
  const steelDark = keep(new T.MeshStandardMaterial({ color: '#0b1019', roughness: 0.7, metalness: 0.6 }));
  const accentMat = keep(new T.MeshBasicMaterial({ color: '#35e8ff' }));
  const amber = keep(new T.MeshBasicMaterial({ color: '#ffcf4d' }));
  const box = (w: number, h: number, d: number, m: THREE_NS.Material, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(keep(new T.BoxGeometry(w, h, d)), m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  /*--- the room (bay and pad) ------------------------------------------*/
  if (!deck) {
    const gc = document.createElement('canvas');
    gc.width = gc.height = 512;
    const g = gc.getContext('2d')!;
    g.fillStyle = '#05080f';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(53,232,255,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.strokeStyle = 'rgba(53,232,255,0.12)';
    g.lineWidth = 1;
    for (let j = 32; j < 512; j += 64) {
      g.beginPath(); g.moveTo(j, 0); g.lineTo(j, 512); g.stroke();
      g.beginPath(); g.moveTo(0, j); g.lineTo(512, j); g.stroke();
    }
    const grid = keep(new T.CanvasTexture(gc));
    grid.colorSpace = T.SRGBColorSpace;
    grid.wrapS = grid.wrapT = T.RepeatWrapping;
    grid.repeat.set(12, 12);
    grid.anisotropy = 4;
    const floor = new T.Mesh(
      keep(new T.PlaneGeometry(90, 90)),
      keep(new T.MeshStandardMaterial({ color: '#0a0f1a', roughness: 0.55, metalness: 0.4, emissive: '#ffffff', emissiveMap: grid, emissiveIntensity: 0.35 })),
    );
    floor.rotation.x = -PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }
  if (mode === 'bay') {
    box(40, 14, 0.4, steelDark, 0, 7, -9).receiveShadow = true;
    for (let rx = -18; rx <= 18; rx += 3) box(0.35, 14, 0.6, steel, rx, 7, -8.7);
    for (const y of [2.2, 6.5]) box(36, 0.08, 0.1, accentMat, 0, y, -8.35);
    box(2.6, 0.5, 0.05, amber, -7.5, 4.2, -8.35);
    for (const x of [-6.2, 6.2]) {
      box(0.9, 9, 0.9, steel, x, 4.5, -3.2).castShadow = true;
      for (let y = 1; y < 9; y += 1.6) {
        box(1.6, 0.08, 1.4, steelDark, x - Math.sign(x) * 0.35, y, -3.2);
        box(1.6, 0.04, 0.04, accentMat, x - Math.sign(x) * 0.35, y + 0.06, -2.5);
      }
      box(2.6, 0.18, 0.25, steel, x - Math.sign(x) * 1.6, 5.2, -2.2).rotation.z = Math.sign(x) * -0.25;
    }
    box(10, 0.25, 3, steelDark, 0, 10.5, 0.5);
    const lampMat = keep(new T.MeshBasicMaterial({ color: '#dff6ff' }));
    for (let lx = -3.6; lx <= 3.6; lx += 1.8) box(1.2, 0.05, 0.5, lampMat, lx, 10.36, 0.5);
    const shaft = new T.Mesh(
      keep(new T.CylinderGeometry(1.4, 3.6, 10, 40, 1, true)),
      keep(new T.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.045, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })),
    );
    shaft.position.set(0, 5.3, 0.3);
    scene.add(shaft);
  }

  /*--- the turntable pad, its glowing rim and four clamps -----------------*/
  const pad = new T.Group();
  scene.add(pad);
  const base = new T.Mesh(keep(new T.CylinderGeometry(3.4, 3.6, 0.35, 64)), steel);
  base.position.y = 0.17;
  base.receiveShadow = base.castShadow = true;
  pad.add(base);
  const top = new T.Mesh(keep(new T.CylinderGeometry(3.1, 3.1, 0.06, 64)), keep(new T.MeshStandardMaterial({ color: '#0f1726', roughness: 0.35, metalness: 0.8 })));
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
  const fieldMat = keep(new T.MeshBasicMaterial({ color: '#96afc8', wireframe: true, transparent: true, opacity: 0.12, depthWrite: false }));
  const field = new T.Mesh(keep(new T.IcosahedronGeometry(2.7, 2)), fieldMat);
  field.position.y = 1.3;
  field.visible = false;
  scene.add(field);

  // a trail plume behind the plane, lit in the trail's hue
  const plumeMat = keep(new T.MeshBasicMaterial({ color: '#35e8ff', transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const plume = new T.Mesh(keep(new T.ConeGeometry(0.22, 1.6, 20, 1, true)), plumeMat);
  plume.rotation.z = -PI / 2;
  plume.visible = false;

  /*--- camera framing -------------------------------------------------*/
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
  let builtKey = '';
  let escortKey = '';
  const holder = new T.Group();
  holder.position.y = 1.0;
  scene.add(holder);
  let swapT = 0;
  let swapDir = 1;

  function clearSubject() {
    if (plane) { holder.remove(plane.group); plane.dispose(); plane = null; }
    if (object) { holder.remove(object.sprite); object.dispose(); object = null; }
    holder.remove(plume);
  }

  function apply(s: BaySubject) {
    const live = s.unlocked;
    const hue = s.accentHue;
    const accent = new T.Color(`hsl(${hue}, 85%, 60%)`);
    rimL.color.copy(accent);
    rimR.color.copy(accent);
    accentMat.color.copy(new T.Color(`hsl(${hue}, 90%, 62%)`));
    rim2Mat.color.copy(accentMat.color);
    key.intensity = (live ? 2.4 : 0.9) * PI;
    rim2Mat.opacity = live ? 0.5 : 0.15;
    field.visible = !live && s.kind === 'hull';
    under.color.copy(new T.Color(live ? s.color : '#4a5563'));
    under.intensity = (live ? 1.6 : 0.4) * PI;

    const k = `${s.kind}:${s.ship?.id || ''}:${live ? s.color : 'locked'}`;
    if (k !== builtKey) {
      builtKey = k;
      clearSubject();
      if (s.ship && s.kind === 'hull') {
        plane = buildPlane(T, glowTex, s.ship.id, live ? s.color : LOCKED_GREY);
        if (!live) plane.glows.forEach((gl) => { gl.visible = false; });
        holder.add(plane.group);
        holder.add(plume);
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
      if (ek && s.drone) {
        escort = artSprite(T, s.drone, s.drone.color || 'hsl(190, 100%, 70%)', 128);
        escort.sprite.scale.set(0.9, 0.9, 1);
        escort.redraw();
        scene.add(escort.sprite);
      }
    }
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

  function loop() {
    if (raf) return;
    raf = requestAnimationFrame(tickFrame);
  }
  function tickFrame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    resize();
    const t = (now - t0) / 1000;
    frameNo++;
    if (!dragging) {
      if (Math.abs(vel) > 0.0005) { yaw += vel; vel *= 0.94; } else if (!reduced) yaw += 0.004;
    }
    // swap: the incoming plane slides and spins into place, the bay flares
    if (swapT > 0) swapT = Math.max(0, swapT - 0.045);
    const ease = swapT * swapT;
    holder.position.x = -swapDir * ease * 6;
    holder.rotation.y = yaw + swapDir * ease * PI;
    holder.position.y = 1.0 + (reduced ? 0 : Math.sin(t * 1.4) * 0.05);
    key.intensity = ((subject?.unlocked ?? true) ? 2.4 : 0.9) * PI * (1 + ease * 0.8);
    if (plane) plane.anim.forEach((f) => f(t));
    if (plume.visible) {
      (plume.material as THREE_NS.MeshBasicMaterial).opacity = 0.32 + Math.sin(t * 10) * 0.08;
      plume.scale.set(1, 0.9 + Math.sin(t * 17) * 0.1, 1);
    }
    if (object && frameNo % 3 === 0) object.redraw();
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

  resize();
  loop();

  return {
    setSubject(s, dir) {
      const changed = !subject || subject.ship?.id !== s.ship?.id || subject.kind !== s.kind;
      subject = s;
      if (changed && dir) { swapT = 1; swapDir = dir; }
      apply(s);
      loop();
    },
    dispose() {
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
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
