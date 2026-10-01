import type * as THREE_NS from 'three';
import { buildPlane, glowTexture, type BuiltPlane } from '../buildPlane';
import { enemyMaterials, enemyTemplates } from './enemyModels';
import { objectFactory, type ObjectModel } from './objectModels';
import { buildBoss, type BossModel } from './bossModels';

/*==============================================================================
THE 3D ARENA - the fight, drawn in 3D over the same simulation

The engine (public/game) still runs every rule, every hitbox and every dice
roll in its flat 2D world. This layer only DRAWS: each frame it reads the
engine's live state and poses a 3D model for the plane, every drone, every
boss and every arena object.

  camera   straight down, perspective. The floor plane maps 1:1 onto the 2D
           world at screen resolution, so everything the engine still draws
           flat - bullets, bolts, particles, explosions, hazards, the HUD -
           lands exactly where it always did, on the floor. Models stand up
           off that floor, lit from the upper left like the 2D art, and cast
           real shadows onto it; their height is what makes it read as 3D.
  layers   a transparent WebGL canvas between the backdrop canvases and the
           engine's main canvas (which is cleared to transparent each frame).
  dice     three.js calls Math.random whenever it creates an object (UUIDs).
           During a Daily Run or a duel Math.random IS the seeded wave
           generator, so a frame that built a mesh would shift that pilot's
           waves. Every frame therefore runs with the real generator swapped
           back in - see frame().

The engine asks for a frame with $.arena3d.frame() right after it draws the
world, and skips its own 2D drawing of anything this layer owns while
$.arena3d.active is set (enemy.js, hero.js, objects.js).
==============================================================================*/

type Three = typeof THREE_NS;
type Any = Record<string, any>; // the engine's untyped objects

export type ArenaQuality = 'high' | 'low';

export interface ArenaController {
  frame(): void;
  setQuality(q: ArenaQuality): void;
  /** a translucent replay plane (a duel rival's run), or null */
  setGhost(g: { x: number; y: number; direction: number; pilotId: string; color: string } | null): void;
  stats(): { ms: number; quality: ArenaQuality; meshes: number };
  dispose(): void;
}

const FOV = 40;
const PI = Math.PI;

export function createArena(T: Three, canvas: HTMLCanvasElement, opts: { quality: ArenaQuality }): ArenaController {
  let quality = opts.quality;
  const renderer = new T.WebGLRenderer({ canvas, antialias: quality === 'high', alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, 16 / 9, 10, 8000);
  camera.up.set(0, 0, -1);
  const glowTex = glowTexture(T);

  /*--- light: from the upper left, like every 2D sprite in the game -------*/
  scene.add(new T.HemisphereLight('#b8d4ff', '#1a2030', 0.55 * PI));
  const key = new T.DirectionalLight('#ffffff', 2.2 * PI);
  key.castShadow = true;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.6;
  scene.add(key, key.target);
  const rim = new T.DirectionalLight('#5fe9ff', 0.7 * PI);
  scene.add(rim, rim.target);
  // a small pool of point lights that explosions borrow, so a kill lights
  // the hulls around it. Fixed count: adding lights mid-run would recompile
  // every shader in the scene.
  const blasts: THREE_NS.PointLight[] = [];
  for (let i = 0; i < 4; i++) {
    const l = new T.PointLight('#ffb070', 0, 260, 1.6);
    scene.add(l);
    blasts.push(l);
  }
  // the floor itself is invisible - the backdrop shows through - but it
  // catches the shadows
  const catcher = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: 0.42 }));
  catcher.rotation.x = -PI / 2;
  catcher.receiveShadow = true;
  scene.add(catcher);

  function applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, quality === 'high' ? 2 : 1.25));
    key.castShadow = quality === 'high';
    catcher.visible = quality === 'high';
    const size = 2048;
    key.shadow.mapSize.set(size, size);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null as unknown as THREE_NS.WebGLRenderTarget; }
    w = 0; // force a resize on the next frame
  }

  /*--- the plane -----------------------------------------------------------*/
  let hero: BuiltPlane | null = null;
  let heroKey = '';
  const heroHold = new T.Group();
  heroHold.rotation.order = 'YXZ';
  scene.add(heroHold);
  let ghost: BuiltPlane | null = null;
  let ghostKey = '';
  const ghostHold = new T.Group();
  ghostHold.rotation.order = 'YXZ';
  scene.add(ghostHold);
  let ghostState: { x: number; y: number; direction: number; pilotId: string; color: string } | null = null;

  /*--- drones, objects, bosses: one record per live engine object -------------*/
  const templates = enemyTemplates(T);
  const objects = objectFactory(T);
  type HueMats = ReturnType<typeof enemyMaterials>;
  const hueMats = new Map<string, HueMats>();
  type ERec = { grp: THREE_NS.Group; body: THREE_NS.MeshStandardMaterial; spinA: number; tumbleA: number; seen: number; boss: BossModel | null };
  const erecs = new Map<Any, ERec>();
  type ORec = { model: ObjectModel; seen: number; tilt: number };
  const orecs = new Map<Any, ORec>();
  let gen = 0;

  function matsFor(hue: number, sat: number) {
    const k = `${Math.round(hue)}|${Math.round(sat)}`;
    let m = hueMats.get(k);
    if (!m) { m = enemyMaterials(T, hue, sat); hueMats.set(k, m); }
    return m;
  }

  function newEnemy(e: Any): ERec {
    const grp = new T.Group();
    grp.rotation.order = 'YXZ';
    if (e.isBoss) {
      const boss = buildBoss(T, String(e.title || e.variant?.title || ''), Number(e.hue) || 0);
      grp.add(boss.group);
      scene.add(grp);
      return { grp, body: boss.flash[0], spinA: 0, tumbleA: 0, seen: gen, boss };
    }
    const tpl = templates.get(String(e.shape || 'orb'));
    const m = matsFor(Number(e.hue) || 0, Number(e.saturation) || 100);
    const body = m.body.clone();
    const model = tpl.group.clone(true);
    model.traverse((o) => {
      const me = o as THREE_NS.Mesh;
      const role = (me.material as THREE_NS.Material | undefined)?.userData?.role;
      if (!role) return;
      me.material = role === 'body' ? body : role === 'dark' ? m.dark : role === 'glow' ? m.glow : role === 'edge' ? m.edge : m.ghost;
    });
    model.userData.tpl = tpl;
    grp.add(model);
    scene.add(grp);
    return { grp, body, spinA: 0, tumbleA: 0, seen: gen, boss: null };
  }

  function dropEnemy(e: Any, r: ERec) {
    scene.remove(r.grp);
    if (r.boss) r.boss.dispose(); else r.body.dispose();
    erecs.delete(e);
  }

  let w = 0;
  let h = 0;
  let lastNow = performance.now();
  let t0 = lastNow;
  let msAvg = 0;

  function syncHero($: Any, dt: number, t: number) {
    const hh = $.hero as Any;
    const alive = hh && hh.life > 0;
    heroHold.visible = !!alive;
    if (!alive) return;
    const id = (hh.character && hh.character.id) || 'onyix';
    const color = String(hh.fillStyle || '#35e8ff');
    const k = `${id}|${color}`;
    if (k !== heroKey) {
      heroKey = k;
      if (hero) { heroHold.remove(hero.group); hero.dispose(); }
      hero = buildPlane(T, glowTex, id, color);
      hero.group.traverse((o) => { (o as THREE_NS.Mesh).castShadow = true; });
      heroHold.add(hero.group);
    }
    const launch = typeof $.launchScale === 'function' ? $.launchScale() : 1;
    const s = (Number(hh.radius) || 12) * 1.05 * launch;
    heroHold.scale.setScalar(s);
    heroHold.position.set(hh.x, 26 + s * 0.4, hh.y);
    heroHold.rotation.y = -(Number(hh.direction) || 0);
    heroHold.rotation.x = (Number(hh.bank) || 0) * 0.8;
    if (hero) {
      hero.anim.forEach((f) => f(t));
      // hit: the hull goes white-hot, like the 2D one
      const hot = hh.takingDamage ? 0.5 + Math.abs(Math.cos($.tick / 2.5)) * 0.5 : 0;
      for (const m of [hero.mats.hull, hero.mats.wing]) {
        m.emissive.setRGB(hot, hot, hot);
        m.emissiveIntensity = hot ? 1 : 0;
      }
    }
    void dt;
  }

  function syncGhost(t: number) {
    const g = ghostState;
    ghostHold.visible = !!g;
    if (!g) return;
    const k = `${g.pilotId}|${g.color}`;
    if (k !== ghostKey) {
      ghostKey = k;
      if (ghost) { ghostHold.remove(ghost.group); ghost.dispose(); }
      ghost = buildPlane(T, glowTex, g.pilotId, g.color);
      ghost.group.traverse((o) => {
        const me = o as THREE_NS.Mesh;
        const mat = me.material as THREE_NS.Material | undefined;
        if (mat && 'opacity' in mat) { (mat as THREE_NS.MeshStandardMaterial).transparent = true; (mat as THREE_NS.MeshStandardMaterial).opacity = 0.38; (mat as THREE_NS.MeshStandardMaterial).depthWrite = false; }
      });
      ghostHold.add(ghost.group);
    }
    ghostHold.scale.setScalar(13);
    ghostHold.position.set(g.x, 24, g.y);
    ghostHold.rotation.y = -g.direction;
    ghost?.anim.forEach((f) => f(t));
  }

  function syncEnemies($: Any, dt: number, t: number) {
    const list = ($.enemies || []) as Any[];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e || e.isBolt) continue;
      let r = erecs.get(e);
      if (!r) { r = newEnemy(e); erecs.set(e, r); }
      r.seen = gen;
      r.grp.visible = !!e.inView;
      if (!e.inView) continue;
      const rad = Number(e.radius) || 12;
      const facing = (e.vx || e.vy) ? Math.atan2(e.vy, e.vx) : (Number(e.direction) || 0);
      if (r.boss) {
        r.grp.scale.setScalar(rad);
        r.grp.position.set(e.x, rad * 0.55, e.y);
        r.grp.rotation.y = -facing;
        r.boss.tick(t, dt, Number(e.phase) || 0);
      } else {
        const tpl = (r.grp.children[0].userData.tpl || { spin: 0, tumble: 0, lift: 0.2 }) as { spin: number; tumble: number; lift: number };
        r.spinA += tpl.spin * dt;
        r.tumbleA += tpl.tumble * dt;
        r.grp.scale.setScalar(rad);
        r.grp.position.set(e.x, rad * (0.6 + tpl.lift) + Math.sin(t * 2.2 + rad) * rad * 0.06, e.y);
        r.grp.rotation.y = -facing - r.spinA;
        r.grp.rotation.x = r.tumbleA;
        r.grp.rotation.z = r.tumbleA * 0.6;
      }
      // hit flash and the elite's glow, on this drone's own material
      const flash = Math.max(0, Math.min(1, (Number(e.hitFlag) || 0) / 10));
      const mats = r.boss ? r.boss.flash : [r.body];
      for (const m of mats) {
        if (!m.userData.baseEI) m.userData.baseEI = m.emissiveIntensity || 0.5;
        m.emissiveIntensity = m.userData.baseEI + flash * 2.4 + (e.elite ? 0.6 + Math.sin(t * 6) * 0.25 : 0);
      }
    }
    erecs.forEach((r, e) => { if (r.seen !== gen) dropEnemy(e, r); });
  }

  function syncObjects($: Any, dt: number) {
    const list = ($.objects || []) as Any[];
    const vx0 = -$.screen.x - 120;
    const vy0 = -$.screen.y - 120;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      let r = orecs.get(o);
      if (!r) {
        r = { model: objects.build(o as { kind: string; id?: number }), seen: gen, tilt: objects.hash(Number(o.id) || i) * PI * 2 };
        r.model.group.rotation.order = 'YXZ';
        scene.add(r.model.group);
        orecs.set(o, r);
      }
      r.seen = gen;
      const g = r.model.group;
      const inView = o.x > vx0 && o.x < vx0 + $.cw + 240 && o.y > vy0 && o.y < vy0 + $.ch + 240;
      g.visible = inView;
      if (!inView) continue;
      const rad = Number(o.radius) || 16;
      g.scale.setScalar(rad);
      g.position.set(o.x, rad * (o.kind === 'mine' ? 0.9 : 0.75), o.y);
      // mines and fuel stay upright so their warnings read; the rest tumble
      const upright = o.kind === 'mine' || o.kind === 'fuel';
      g.rotation.y = -(Number(o.rotation) || 0);
      if (!upright) { g.rotation.x = Math.sin(r.tilt + (Number(o.rotation) || 0) * 0.7) * 0.6; g.rotation.z = Math.cos(r.tilt) * 0.4; }
      const hit = Math.max(0, Math.min(1, (Number(o.hit) || 0) / 8));
      for (const m of r.model.flash) {
        if (m.userData.baseEI === undefined) m.userData.baseEI = m.emissiveIntensity || 0;
        if (hit) m.emissive.setRGB(1, 1, 1);
        m.emissiveIntensity = hit ? hit * 1.4 : m.userData.baseEI;
        if (!hit && m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
        if (!m.userData.baseEmissive) m.userData.baseEmissive = m.emissive.clone();
      }
      if (r.model.warn) {
        const armed = !!o.armed;
        r.model.warn.color.set(armed && Math.floor(($.tick || 0) / 5) % 2 ? '#ffffff' : (o.kind === 'mine' ? '#ff2b2b' : '#ffd23f'));
      }
    }
    orecs.forEach((r, o) => { if (r.seen !== gen) { scene.remove(r.model.group); r.model.dispose(); orecs.delete(o); } });
    void dt;
  }

  function syncBlasts($: Any) {
    const ex = ($.explosions || []) as Any[];
    let n = 0;
    for (let i = ex.length - 1; i >= 0 && n < blasts.length; i--) {
      const e = ex[i];
      const life = 1 - (Number(e.tick) || 0) / (Number(e.tickMax) || 20);
      if (life <= 0) continue;
      const l = blasts[n++];
      l.position.set(e.x, 40, e.y);
      l.intensity = life * 6 * PI * Math.min(2, (Number(e.radius) || 20) / 30);
      l.distance = 120 + (Number(e.radius) || 20) * 5;
    }
    for (; n < blasts.length; n++) blasts[n].intensity = 0;
  }

  function draw() {
    const $ = (window as unknown as { $?: Any }).$;
    if (!$ || !$.hero || !$.screen) return;
    const now = performance.now();
    const dt = Math.min(3, Math.max(0, (now - lastNow) / (1000 / 60)));
    lastNow = now;
    const t = (now - t0) / 1000;
    gen++;
    const cw = $.cw;
    const ch = $.ch;
    if (cw !== w || ch !== h) {
      w = cw;
      h = ch;
      renderer.setSize(cw, ch, false);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
    }
    // the camera hangs over the centre of the screen at the height where the
    // floor fills it exactly, and shakes with the engine's rumble
    const H = (ch / 2) / Math.tan((FOV / 2) * PI / 180);
    const cx = cw / 2 - $.screen.x + ($.rumble ? $.rumble.x : 0);
    const cy = ch / 2 - $.screen.y + ($.rumble ? $.rumble.y : 0);
    camera.near = H * 0.2;
    camera.far = H * 2;
    camera.updateProjectionMatrix();
    camera.position.set(cx, H, cy);
    camera.lookAt(cx, 0, cy);
    key.position.set(cx - H * 0.45, H * 0.9, cy - H * 0.4);
    key.target.position.set(cx, 0, cy);
    const sc = key.shadow.camera as THREE_NS.OrthographicCamera;
    const span = Math.max(cw, ch) * 0.75;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = H * 3;
    sc.updateProjectionMatrix();
    rim.position.set(cx + H * 0.5, H * 0.5, cy + H * 0.6);
    rim.target.position.set(cx, 0, cy);
    catcher.position.set(cx, 0, cy);
    catcher.scale.set(cw * 1.6, ch * 1.6, 1);

    syncHero($, dt, t);
    syncGhost(t);
    syncEnemies($, dt, t);
    syncObjects($, dt);
    syncBlasts($);
    renderer.render(scene, camera);
  }

  applyQuality();

  return {
    frame() {
      const $ = (window as unknown as { $?: Any }).$;
      const seeded = !!($ && $.__realRandom && Math.random !== $.__realRandom);
      const dice = Math.random;
      if (seeded) Math.random = $!.__realRandom;
      const s = performance.now();
      try { draw(); } finally { if (seeded) Math.random = dice; }
      msAvg = msAvg * 0.95 + (performance.now() - s) * 0.05;
    },
    setQuality(q) { if (q !== quality) { quality = q; applyQuality(); } },
    setGhost(g) { ghostState = g; },
    stats() { return { ms: msAvg, quality, meshes: erecs.size + orecs.size + 1 }; },
    dispose() {
      erecs.forEach((r, e) => dropEnemy(e, r));
      orecs.forEach((r) => { scene.remove(r.model.group); r.model.dispose(); });
      orecs.clear();
      if (hero) hero.dispose();
      if (ghost) ghost.dispose();
      hueMats.forEach((m) => Object.values(m).forEach((x) => x.dispose()));
      templates.dispose();
      objects.dispose();
      glowTex.dispose();
      renderer.dispose();
    },
  };
}
