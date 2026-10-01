import type * as THREE_NS from 'three';
import { buildPlane, glowTexture, type BuiltPlane } from './buildPlane';

/*==============================================================================
The Shooterboard podium - the top three, each in the plane and colour they
flew, on lit hex columns (gold, silver, bronze) under their own spotlights.
Columns are ordered 2-1-3 left to right, the way a podium stands.
==============================================================================*/

type Three = typeof THREE_NS;

export interface PodiumPilot { pilotId: string; color: string }

export interface PodiumController {
  setPilots(p: PodiumPilot[]): void;
  dispose(): void;
}

const COLS = [
  { place: 2, x: -3.4, h: 1.5, trim: '#c9d1e8' },
  { place: 1, x: 0, h: 2.3, trim: '#ffd75e' },
  { place: 3, x: 3.4, h: 1.0, trim: '#d08a4a' },
];

export function createPodiumScene(T: Three, canvas: HTMLCanvasElement): PodiumController {
  const PI = Math.PI;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  const glowTex = glowTexture(T);
  const disposables: Array<{ dispose(): void }> = [glowTex];
  const keep = <X extends { dispose(): void }>(x: X) => { disposables.push(x); return x; };

  scene.add(new T.HemisphereLight('#8fb8ff', '#0a0d14', 0.45 * PI));
  const spot = (color: string, x: number, y: number, z: number, tx: number, ty: number, power: number) => {
    const s = new T.SpotLight(color, power * PI, 30, PI / 8, 0.5, 1);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, 0);
    s.castShadow = true;
    s.shadow.mapSize.set(1024, 1024);
    s.shadow.bias = -0.0004;
    scene.add(s, s.target);
  };
  spot('#fff4d6', 0, 12, 4, 0, 2, 2.6);
  spot('#bfe9ff', -6, 9, 6, -3.4, 1.5, 1.2);
  spot('#ffd9bf', 6, 9, 6, 3.4, 1, 1.0);
  const rim = new T.PointLight('#35e8ff', 1.4 * PI, 16, 1);
  rim.position.set(0, 4, -4);
  scene.add(rim);

  // a dark floor disc that fades out, so the stage sits on the page's own background
  const fc = document.createElement('canvas');
  fc.width = fc.height = 256;
  const fg = fc.getContext('2d')!;
  const grad = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(20,32,52,0.95)');
  grad.addColorStop(0.6, 'rgba(10,16,28,0.6)');
  grad.addColorStop(1, 'rgba(6,7,12,0)');
  fg.fillStyle = grad;
  fg.fillRect(0, 0, 256, 256);
  const floorTex = keep(new T.CanvasTexture(fc));
  floorTex.colorSpace = T.SRGBColorSpace;
  const floor = new T.Mesh(keep(new T.PlaneGeometry(18, 9)), keep(new T.MeshStandardMaterial({ map: floorTex, transparent: true, roughness: 0.6, metalness: 0.3 })));
  floor.rotation.x = -PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const steel = keep(new T.MeshStandardMaterial({ color: '#121a28', roughness: 0.45, metalness: 0.75 }));
  for (const c of COLS) {
    const col = new T.Mesh(keep(new T.CylinderGeometry(1.45, 1.55, c.h, 6)), steel);
    col.position.set(c.x, c.h / 2, 0);
    col.rotation.y = PI / 6;
    col.castShadow = col.receiveShadow = true;
    scene.add(col);
    const trim = new T.Mesh(keep(new T.TorusGeometry(1.47, 0.05, 6, 6)), keep(new T.MeshBasicMaterial({ color: c.trim })));
    trim.rotation.x = PI / 2;
    trim.rotation.z = PI / 6;
    trim.position.set(c.x, c.h + 0.01, 0);
    scene.add(trim);
    const nc = document.createElement('canvas');
    nc.width = nc.height = 128;
    const ng = nc.getContext('2d')!;
    ng.fillStyle = c.trim;
    ng.font = '900 96px Orbitron, system-ui, sans-serif';
    ng.textAlign = 'center';
    ng.textBaseline = 'middle';
    ng.fillText(String(c.place), 64, 70);
    const numTex = keep(new T.CanvasTexture(nc));
    numTex.colorSpace = T.SRGBColorSpace;
    const num = new T.Mesh(keep(new T.PlaneGeometry(0.9, 0.9)), keep(new T.MeshBasicMaterial({ map: numTex, transparent: true })));
    num.position.set(c.x, Math.max(0.5, c.h * 0.5), 1.37);
    scene.add(num);
  }

  let planes: Array<BuiltPlane | null> = [null, null, null];
  let key = '';

  let w = 0;
  let h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height || (r.width === w && r.height === h)) return;
    w = r.width;
    h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1.2 ? 56 : 34;
    camera.position.set(0, 4.2, camera.aspect < 1.2 ? 12.5 : 11);
    camera.lookAt(0, 2.0, 0);
    camera.updateProjectionMatrix();
  }

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let visible = true;
  const t0 = performance.now();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); if (visible) loop(); })
    : null;
  io?.observe(canvas);
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  const onVis = () => { if (!document.hidden) loop(); };
  document.addEventListener('visibilitychange', onVis);

  function loop() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    resize();
    const t = (now - t0) / 1000;
    planes.forEach((p, i) => {
      if (!p) return;
      const c = COLS[i];
      p.group.rotation.y = reduced ? 0.5 : t * 0.45 + i * 2.1;
      p.group.position.set(c.x, c.h + 0.75 + (reduced ? 0 : Math.sin(t * 1.3 + i) * 0.07), 0);
      p.anim.forEach((f) => f(t));
    });
    renderer.render(scene, camera);
    loop();
  }
  resize();
  loop();

  return {
    setPilots(list) {
      // podium order is 2, 1, 3
      const order = [list[1], list[0], list[2]];
      const k = order.map((p) => (p ? `${p.pilotId}:${p.color}` : '')).join('|');
      if (k === key) return;
      key = k;
      planes.forEach((p) => { if (p) { scene.remove(p.group); p.dispose(); } });
      planes = order.map((p) => {
        if (!p) return null;
        const b = buildPlane(T, glowTex, p.pilotId, p.color);
        b.group.scale.setScalar(0.92);
        scene.add(b.group);
        return b;
      });
      loop();
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      planes.forEach((p) => p?.dispose());
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
