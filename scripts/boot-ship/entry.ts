// Bundled by bake.mjs: renders the loading screen's ship turning, frame by
// frame, from the same model the hangar flies (buildPlane + planeSpecs).
import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildPlane, glowTexture } from '../../src/components/three/buildPlane';

const FRAMES = 36, W = 220, H = 140;
(window as unknown as { __bake: () => string }).__bake = () => {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  // the bay's lamp overhead, a cool rim from behind, a little fill
  const key = new T.SpotLight('#ffffff', 60, 30, Math.PI / 5, 0.6, 1.4);
  key.position.set(-1.5, 6, 2.5);
  scene.add(key);
  const rim = new T.DirectionalLight('#6fe3ff', 2.2);
  rim.position.set(3, 1.5, -4);
  scene.add(rim);
  scene.add(new T.HemisphereLight('#a9c8ff', '#141a26', 0.8));

  const plane = buildPlane(T, glowTexture(T), 'onyix', 'hsl(190, 85%, 62%)');
  const turn = new T.Group();
  turn.add(plane.group);
  scene.add(turn);
  // frame the airframe whatever its size
  const box = new T.Box3().setFromObject(plane.group);
  const size = box.getSize(new T.Vector3()), centre = box.getCenter(new T.Vector3());
  plane.group.position.sub(centre);
  const span = Math.max(size.x, size.z);
  const camera = new T.PerspectiveCamera(26, W / H, 0.1, 100);
  const dist = span * 1.85;
  camera.position.set(0, dist * 0.42, dist);
  camera.lookAt(0, 0, 0);

  const sheet = document.createElement('canvas');
  sheet.width = W * FRAMES; sheet.height = H;
  const ctx = sheet.getContext('2d')!;
  for (let f = 0; f < FRAMES; f++) {
    const u = f / FRAMES;
    turn.rotation.y = u * Math.PI * 2;
    // a gentle bank and bob that also loop with the turn
    turn.rotation.z = Math.sin(u * Math.PI * 2) * 0.08;
    turn.position.y = Math.sin(u * Math.PI * 4) * span * 0.015;
    plane.anim.forEach((a) => a(u * 6));
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, f * W, 0);
  }
  return sheet.toDataURL('image/webp', 0.86);
};
