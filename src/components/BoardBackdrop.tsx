'use client';

import { useEffect, useRef } from 'react';

// A blurred, ambient combat scene rendered behind the leaderboard: friendly
// ships drift across, firing at drifting enemy blips that flash and pop when
// hit. Purely decorative, randomized each frame, heavily blurred + dimmed so
// it reads as atmosphere and never competes with the board rows. Pauses when
// the tab is hidden and respects reduced-motion.
export function BoardBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const R = 22; // world padding

    type Ship = { x: number; y: number; vx: number; vy: number; a: number; cd: number; hue: number };
    type Enemy = { x: number; y: number; vx: number; vy: number; r: number; hp: number; flash: number };
    type Bullet = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

    const ships: Ship[] = [];
    const enemies: Enemy[] = [];
    const bullets: Bullet[] = [];
    const sparks: Spark[] = [];

    const spawnShip = (): Ship => {
      const fromLeft = Math.random() < 0.5;
      return {
        x: fromLeft ? -R : w + R,
        y: rand(0, h),
        vx: (fromLeft ? 1 : -1) * rand(0.25, 0.7),
        vy: rand(-0.15, 0.15),
        a: 0, cd: rand(0, 60),
        hue: Math.random() < 0.5 ? 190 : 45,
      };
    };
    const spawnEnemy = (): Enemy => ({
      x: rand(0, w), y: rand(-R, h),
      vx: rand(-0.2, 0.2), vy: rand(0.15, 0.5),
      r: rand(6, 12), hp: 2 + Math.floor(Math.random() * 2), flash: 0,
    });

    const shipCount = Math.max(3, Math.round(w / 320));
    const enemyCount = Math.max(4, Math.round(w / 220));
    for (let i = 0; i < shipCount; i++) ships.push(spawnShip());
    for (let i = 0; i < enemyCount; i++) enemies.push(spawnEnemy());

    let raf = 0, last = performance.now(), running = true;
    const onVis = () => { running = !document.hidden; if (running) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', onVis);

    function nearestEnemy(s: Ship): Enemy | null {
      let best: Enemy | null = null, bd = Infinity;
      for (const e of enemies) {
        const dx = e.x - s.x, dy = e.y - s.y, d = dx * dx + dy * dy;
        // only target enemies roughly ahead in the ship's travel direction
        if (Math.sign(dx) === Math.sign(s.vx) && d < bd) { bd = d; best = e; }
      }
      return best;
    }

    function step(dt: number) {
      // ships
      for (const s of ships) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < -R * 2 || s.x > w + R * 2) Object.assign(s, spawnShip());
        s.cd -= dt;
        if (s.cd <= 0) {
          const t = nearestEnemy(s);
          if (t) {
            const dx = t.x - s.x, dy = t.y - s.y, m = Math.hypot(dx, dy) || 1;
            bullets.push({ x: s.x, y: s.y, vx: (dx / m) * 3.4, vy: (dy / m) * 3.4, life: 120, hue: s.hue });
            s.cd = rand(22, 45);
          } else s.cd = 20;
        }
      }
      // enemies
      for (const e of enemies) {
        e.x += e.vx * dt; e.y += e.vy * dt; e.flash *= 0.85;
        if (e.y > h + R || e.x < -R || e.x > w + R) Object.assign(e, spawnEnemy(), { y: -R });
      }
      // bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let hit = false;
        for (const e of enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 2) {
            e.hp -= 1; e.flash = 1; hit = true;
            for (let k = 0; k < 5; k++) sparks.push({ x: b.x, y: b.y, vx: rand(-1.5, 1.5), vy: rand(-1.5, 1.5), life: rand(14, 26), hue: b.hue });
            if (e.hp <= 0) {
              for (let k = 0; k < 12; k++) sparks.push({ x: e.x, y: e.y, vx: rand(-2.4, 2.4), vy: rand(-2.4, 2.4), life: rand(18, 34), hue: 12 });
              Object.assign(e, spawnEnemy(), { y: -R });
            }
            break;
          }
        }
        if (hit || b.life <= 0 || b.x < -R || b.x > w + R || b.y < -R || b.y > h + R) bullets.splice(i, 1);
      }
      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt;
        if (p.life <= 0) sparks.splice(i, 1);
      }
    }

    function drawShip(s: Ship) {
      ctx!.save();
      ctx!.translate(s.x, s.y);
      ctx!.rotate(Math.atan2(s.vy, s.vx));
      // engine glow
      ctx!.beginPath();
      ctx!.arc(-7, 0, 4, 0, Math.PI * 2);
      ctx!.fillStyle = `hsla(${s.hue},100%,65%,0.35)`;
      ctx!.fill();
      // hull
      ctx!.beginPath();
      ctx!.moveTo(13, 0); ctx!.lineTo(-8, 7); ctx!.lineTo(-4, 0); ctx!.lineTo(-8, -7); ctx!.closePath();
      ctx!.fillStyle = `hsla(${s.hue},95%,68%,0.95)`;
      ctx!.fill();
      ctx!.restore();
    }

    function render() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      // faint starfield glow
      for (const e of enemies) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = e.flash > 0.05 ? `hsla(0,90%,70%,${0.5 + e.flash * 0.4})` : 'hsla(0,70%,55%,0.5)';
        ctx.fill();
      }
      for (const b of bullets) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
        ctx.strokeStyle = `hsla(${b.hue},100%,70%,0.9)`; ctx.lineWidth = 2; ctx.stroke();
      }
      for (const p of sparks) {
        ctx.globalAlpha = Math.max(0, p.life / 30);
        ctx.fillStyle = `hsl(${p.hue},100%,65%)`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      ctx.globalAlpha = 1;
      for (const s of ships) drawShip(s);
    }

    function loop(now: number) {
      if (!running) return;
      const dt = Math.min(3, (now - last) / (1000 / 60)); last = now;
      step(dt);
      render();
      raf = requestAnimationFrame(loop);
    }
    if (!reduce) raf = requestAnimationFrame(loop);
    else { step(1); render(); }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ filter: 'blur(2px)', opacity: 0.5 }}
    />
  );
}
