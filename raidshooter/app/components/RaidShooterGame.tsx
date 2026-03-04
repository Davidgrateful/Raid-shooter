'use client';

import { useEffect, useRef, useCallback } from 'react';
import useAudio from '../hooks/useAudio';
import useVirtualControls from '../hooks/useVirtualControls';
import VirtualJoystick from './VirtualJoystick';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameStats {
  score: number;
  level: number;
  kills: number;
  time: number;
  bestScore: number;
}

interface RaidShooterGameProps {
  gameState: 'menu' | 'play' | 'gameover';
  gameStats: GameStats;
  onGameStateChange: (state: 'menu' | 'play' | 'gameover') => void;
  onStatsUpdate: (stats: GameStats | ((prev: GameStats) => GameStats)) => void;
  onGameOver: (finalStats: GameStats) => void;
}

interface Hero {
  x: number; y: number; vx: number; vy: number;
  radius: number; life: number; direction: number;
  damageFlash: number;
}

interface Enemy {
  id: string;
  x: number; y: number; vx: number; vy: number;
  radius: number; type: number; hp: number; maxHp: number;
  value: number; hue: number; sat: number; lit: number;
  hitFlash: number;
  angle?: number; orbitDist?: number; orbitDir?: number;
  targetX?: number; targetY?: number; reached?: boolean;
  spawnTimer?: number; sinePhase?: number; wanderAngle?: number;
}

interface Bullet {
  id: string;
  x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; pierced: number;
}

interface Powerup {
  id: string; x: number; y: number; type: number; radius: number; age: number;
}

interface Particle {
  id: string;
  x: number; y: number; vx: number; vy: number;
  radius: number; hue: number; alpha: number;
}

interface Floater {
  id: string; x: number; y: number; text: string; age: number; color: string;
}

interface ActivePowerup { type: number; expiresAt: number; }

interface GS {
  hero: Hero;
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  powerups: Powerup[];
  floaters: Floater[];
  activePowerups: ActivePowerup[];
  gameTime: number;
  lastFire: number;
  lastEnemySpawn: number;
  lastLevel: number;
  screenShake: number;
  score: number;
  kills: number;
  level: number;
}

// ── Definitions ───────────────────────────────────────────────────────────────

const ENEMY_DEFS = [
  { speed: 1.5, hp: 1,  radius: 15, hue: 180, sat: 100, lit: 50,  value: 5  }, // 0 cardinal
  { speed: 1.5, hp: 2,  radius: 15, hue: 120, sat: 100, lit: 50,  value: 10 }, // 1 diagonal
  { speed: 1.5, hp: 2,  radius: 20, hue: 330, sat: 100, lit: 50,  value: 15 }, // 2 chaser
  { speed: 0.5, hp: 3,  radius: 50, hue: 210, sat: 100, lit: 50,  value: 20 }, // 3 splitter
  { speed: 2.0, hp: 4,  radius: 20, hue: 30,  sat: 100, lit: 50,  value: 25 }, // 4 wanderer
  { speed: 1.0, hp: 3,  radius: 20, hue: 0,   sat: 0,   lit: 30,  value: 30 }, // 5 stealth
  { speed: 0.25,hp: 8,  radius: 80, hue: 150, sat: 100, lit: 50,  value: 35 }, // 6 tank
  { speed: 2.5, hp: 1,  radius: 15, hue: 300, sat: 100, lit: 50,  value: 40 }, // 7 speedster
  { speed: 1.5, hp: 6,  radius: 20, hue: 0,   sat: 100, lit: 100, value: 45 }, // 8 grower
  { speed: 0.5, hp: 2,  radius: 20, hue: 60,  sat: 100, lit: 50,  value: 50 }, // 9 orbiter
  { speed: 1.0, hp: 3,  radius: 45, hue: 0,   sat: 100, lit: 50,  value: 55 }, // 10 spawner
  { speed: 1.5, hp: 10, radius: 30, hue: 90,  sat: 100, lit: 50,  value: 60 }, // 11 tower
  { speed: 0,   hp: 1,  radius: 0,  hue: 0,   sat: 100, lit: 60,  value: 65 }, // 12 chaos
];

// kills needed to enter each level (index = level-1, so index 0 = reach level 2)
const LEVEL_KILLS = [17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94, 101];

const POWERUP_COLORS = ['#ffffff', '#aaddff', '#88ff44', '#44ddff', '#ff5566'];
const POWERUP_NAMES  = ['HEALTH', 'SLOW', 'FAST SHOT', 'TRIPLE', 'PIERCE'];
const POWERUP_DUR    = 7000; // ms for timed powerups

const CW = 400, CH = 600;
const HERO_SPEED = 4;
const BULLET_SPEED = 8;
const BASE_FIRE_RATE = 200;
const FAST_FIRE_RATE = 80;

// ── Pure helpers ──────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).substr(2, 9);

const dist2d = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function getLevelFromKills(kills: number): number {
  for (let i = 0; i < LEVEL_KILLS.length; i++) {
    if (kills < LEVEL_KILLS[i]) return i + 1;
  }
  return 13;
}

function pickEnemyType(level: number): number {
  const maxType = Math.min(level - 1, 12);
  // Higher-index types have lower spawn weight
  const weights = Array.from({ length: maxType + 1 }, (_, i) =>
    i === maxType ? Math.floor((maxType + 1) * 25 * 0.75) : (maxType + 1) * 25
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return maxType;
}

function spawnEnemy(type: number, heroX: number, heroY: number): Enemy {
  const def = ENEMY_DEFS[type];
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  switch (side) {
    case 0: x = Math.random() * CW; y = -def.radius - 5; break;
    case 1: x = CW + def.radius + 5; y = Math.random() * CH; break;
    case 2: x = Math.random() * CW; y = CH + def.radius + 5; break;
    default: x = -def.radius - 5; y = Math.random() * CH; break;
  }

  let vx = 0, vy = 0;
  let speed = def.speed;
  let radius = def.radius;
  let hue = def.hue;

  if (type === 0) {
    // Cardinal: move inward from whichever edge
    switch (side) {
      case 0: vy = speed; break;
      case 1: vx = -speed; break;
      case 2: vy = -speed; break;
      default: vx = speed; break;
    }
  } else if (type === 1) {
    // Diagonal
    const sx = (side === 1 || side === 2) ? -1 : 1;
    const sy = (side === 2 || side === 3) ? -1 : 1;
    vx = sx * speed * 0.707;
    vy = sy * speed * 0.707;
  } else if (type === 12) {
    // Chaos: random speed, size, hue, direction
    speed = 3 + Math.random() * 5;
    radius = 15 + Math.floor(Math.random() * 21);
    hue = Math.random() * 360;
    if (Math.random() < 0.5) {
      vx = (Math.random() < 0.5 ? 1 : -1) * speed * 0.707;
      vy = (Math.random() < 0.5 ? 1 : -1) * speed * 0.707;
    } else {
      const c = Math.floor(Math.random() * 4);
      vx = [0, speed, 0, -speed][c];
      vy = [speed, 0, -speed, 0][c];
    }
  }

  const e: Enemy = {
    id: uid(), x, y, vx, vy, radius,
    type, hp: def.hp, maxHp: def.hp,
    value: def.value, hue, sat: def.sat, lit: def.lit,
    hitFlash: 0,
  };

  // Type-specific init
  if (type === 9) {
    e.angle = Math.atan2(y - heroY, x - heroX);
    e.orbitDist = 80 + Math.random() * 60;
    e.orbitDir = Math.random() < 0.5 ? 1 : -1;
  } else if (type === 11) {
    e.targetX = 30 + Math.random() * (CW - 60);
    e.targetY = 30 + Math.random() * (CH - 60);
    e.reached = false;
  } else if (type === 7) {
    e.sinePhase = Math.random() * Math.PI * 2;
  } else if (type === 4) {
    e.wanderAngle = Math.random() * Math.PI * 2;
  } else if (type === 10) {
    e.spawnTimer = 0;
    e.sinePhase = Math.random() * Math.PI * 2;
  }

  return e;
}

function stepEnemy(e: Enemy, heroX: number, heroY: number, slow: boolean): Enemy {
  const def = ENEMY_DEFS[e.type];
  const sf = slow ? 0.3 : 1;
  const dx = heroX - e.x, dy = heroY - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / d, ny = dy / d;

  const n: Enemy = { ...e };
  n.hitFlash = Math.max(0, e.hitFlash - 1);

  switch (e.type) {
    case 0:
    case 1:
    case 12:
      n.x += e.vx * sf;
      n.y += e.vy * sf;
      if (e.type === 12) n.hue = (e.hue + 3) % 360;
      break;

    case 2:
    case 3:
    case 5:
    case 6: {
      const s = def.speed * sf;
      n.vx = nx * s; n.vy = ny * s;
      n.x += n.vx; n.y += n.vy;
      break;
    }

    case 4: {
      let wa = e.wanderAngle ?? 0;
      wa += (Math.random() - 0.5) * 0.3;
      n.wanderAngle = wa;
      const s = def.speed * sf;
      n.vx = Math.cos(wa) * s; n.vy = Math.sin(wa) * s;
      n.x += n.vx; n.y += n.vy;
      break;
    }

    case 7: {
      const phase = (e.sinePhase ?? 0) + 0.15;
      const perp = Math.sin(phase) * 2.5 * sf;
      const s = def.speed * sf;
      n.vx = nx * s + (-ny) * perp;
      n.vy = ny * s + nx * perp;
      n.x += n.vx; n.y += n.vy;
      n.sinePhase = phase;
      break;
    }

    case 8: {
      const s = def.speed * sf;
      n.vx = nx * s; n.vy = ny * s;
      n.x += n.vx; n.y += n.vy;
      if (d < 200) {
        n.radius = Math.min(60, e.radius + 0.3);
        n.hue = (e.hue + 10) % 360;
        n.lit = 60;
      }
      break;
    }

    case 9: {
      const angle = (e.angle ?? 0) + (e.orbitDir ?? 1) * 0.025 * sf;
      const od = Math.max(30, (e.orbitDist ?? 100) - 0.1);
      n.x = heroX + Math.cos(angle) * od;
      n.y = heroY + Math.sin(angle) * od;
      n.vx = n.x - e.x; n.vy = n.y - e.y;
      n.angle = angle; n.orbitDist = od;
      break;
    }

    case 10: {
      const phase = (e.sinePhase ?? 0) + 0.1;
      const perp = Math.sin(phase) * 1.5 * sf;
      const s = def.speed * sf;
      n.vx = nx * s + (-ny) * perp;
      n.vy = ny * s + nx * perp;
      n.x += n.vx; n.y += n.vy;
      n.sinePhase = phase;
      n.spawnTimer = (e.spawnTimer ?? 0) + 1;
      break;
    }

    case 11: {
      if (!e.reached) {
        const tx = e.targetX ?? CW / 2, ty = e.targetY ?? CH / 2;
        const tdx = tx - e.x, tdy = ty - e.y;
        const td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        const s = def.speed * sf;
        if (td < s + 2) {
          n.x = tx; n.y = ty; n.reached = true; n.vx = 0; n.vy = 0;
        } else {
          n.vx = (tdx / td) * s; n.vy = (tdy / td) * s;
          n.x += n.vx; n.y += n.vy;
        }
      }
      break;
    }
  }

  return n;
}

// ── Initial state ─────────────────────────────────────────────────────────────

function makeGS(): GS {
  return {
    hero: { x: CW / 2, y: CH / 2, vx: 0, vy: 0, radius: 12, life: 1, direction: 0, damageFlash: 0 },
    enemies: [], bullets: [], particles: [], powerups: [], floaters: [],
    activePowerups: [],
    gameTime: 0, lastFire: 0, lastEnemySpawn: 0, lastLevel: 1,
    screenShake: 0, score: 0, kills: 0, level: 1,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RaidShooterGame({
  gameState, gameStats,
  onGameStateChange: _onGameStateChange,
  onStatsUpdate, onGameOver,
}: RaidShooterGameProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animRef       = useRef<number>();
  const lastTimeRef   = useRef<number>(0);
  const mouseRef      = useRef({ x: 0, y: 0, down: false });
  const keysRef       = useRef({ w: false, a: false, s: false, d: false, up: false, left: false, down: false, right: false });
  const gsRef         = useRef<GS>(makeGS());
  const gameStateRef  = useRef(gameState);
  const doneRef       = useRef(false); // game-over guard
  const bestRef       = useRef(gameStats.bestScore);
  const isMutedRef    = useRef(false);

  const { playSound, toggleMute, isMuted }                                        = useAudio();
  const { isTouchDevice, showControls, getControlsState, toggleControls, leftZoneRef, rightZoneRef } = useVirtualControls(canvasRef);

  // Sync refs
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { bestRef.current = gameStats.bestScore; }, [gameStats.bestScore]);

  // Reset game state when entering play
  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState === 'play') {
      gsRef.current = makeGS();
      lastTimeRef.current = 0;
      doneRef.current = false;
    }
  }, [gameState]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderGame = useCallback((ctx: CanvasRenderingContext2D, gs: GS) => {
    const { hero, enemies, bullets, particles, powerups, floaters, activePowerups } = gs;
    const t = gs.gameTime;
    const shake = gs.screenShake;

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Background
    ctx.fillStyle = '#000010';
    ctx.fillRect(-shake * 2, -shake * 2, CW + shake * 4, CH + shake * 4);

    // Parallax stars — 3 layers
    const layers = [
      { count: 30, speed: 0.03, size: 1,   alpha: 0.4 },
      { count: 20, speed: 0.07, size: 1.5, alpha: 0.7 },
      { count: 12, speed: 0.13, size: 2,   alpha: 1.0 },
    ];
    for (const L of layers) {
      ctx.globalAlpha = L.alpha;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < L.count; i++) {
        const sx = (i * 137 + i * L.count * 11) % CW;
        const sy = ((i * 97 + t * L.speed) % CH + CH) % CH;
        ctx.fillRect(sx, sy, L.size, L.size);
      }
    }
    ctx.globalAlpha = 1;

    // Powerups — pulsing glow + label
    for (const p of powerups) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 0.005 + p.age * 0.1);
      const col = POWERUP_COLORS[p.type];
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(POWERUP_NAMES[p.type][0], p.x, p.y + 3);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = `hsl(${p.hue},100%,60%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Enemies
    for (const e of enemies) {
      const col = e.hitFlash > 0 ? '#ffffff' : `hsl(${e.hue},${e.sat}%,${e.lit}%)`;

      // HP bar for multi-HP enemies
      if (e.maxHp > 1) {
        const bw = e.radius * 2;
        ctx.fillStyle = '#440000';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, bw, 4);
        ctx.fillStyle = '#00ff44';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, bw * (e.hp / e.maxHp), 4);
      }

      // Glow halo for flashy types
      if (e.type === 7 || e.type === 8 || e.type === 12) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bullets — yellow with glow
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffff44';
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Hero — blinks when damaged
    const heroAlpha = hero.damageFlash > 0 ? (Math.floor(hero.damageFlash / 2) % 2 === 0 ? 0.3 : 1) : 1;
    ctx.globalAlpha = heroAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hero.x, hero.y, hero.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hero.x, hero.y);
    ctx.lineTo(
      hero.x + Math.cos(hero.direction) * hero.radius * 2.2,
      hero.y + Math.sin(hero.direction) * hero.radius * 2.2,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Score floaters
    ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, 1 - f.age / 45);
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.text.startsWith('LEVEL') ? 22 : 13}px monospace`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`SCORE ${gs.score.toLocaleString()}`, 10, 20);
    ctx.fillText(`LV ${gs.level}  KILLS ${gs.kills}`, 10, 38);

    // Active powerup indicators
    let py = 58;
    for (const ap of activePowerups) {
      const remaining = Math.max(0, ap.expiresAt - gs.gameTime);
      const pct = remaining / POWERUP_DUR;
      ctx.fillStyle = POWERUP_COLORS[ap.type];
      ctx.fillText(`${POWERUP_NAMES[ap.type]} ${(remaining / 1000).toFixed(1)}s`, 10, py);
      ctx.fillStyle = '#333';
      ctx.fillRect(10, py + 2, 80, 3);
      ctx.fillStyle = POWERUP_COLORS[ap.type];
      ctx.fillRect(10, py + 2, 80 * pct, 3);
      py += 16;
    }

    // Health bar
    ctx.fillStyle = '#550000';
    ctx.fillRect(10, CH - 24, 100, 8);
    ctx.fillStyle = hero.life > 0.3 ? '#00ff44' : '#ff8800';
    ctx.fillRect(10, CH - 24, 100 * hero.life, 8);
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, CH - 24, 100, 8);
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('HP', 114, CH - 16);

    // Mute hint
    ctx.fillStyle = isMutedRef.current ? '#ff4444' : '#444';
    ctx.fillText(isMutedRef.current ? 'MUTED' : 'M:mute', CW - 62, 18);

    ctx.restore();
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────────

  const gameLoop = useCallback((currentTime: number) => {
    if (gameStateRef.current !== 'play') {
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (lastTimeRef.current === 0) lastTimeRef.current = currentTime;
    lastTimeRef.current = currentTime;

    const gs = gsRef.current;
    gs.gameTime += 16; // fixed ~60fps timestep for determinism

    const now = gs.gameTime;
    const controls = getControlsState();

    // ── Active powerups ────────────────────────────────────────────────────────
    gs.activePowerups = gs.activePowerups.filter(ap => ap.expiresAt > now);
    const hasSlow   = gs.activePowerups.some(a => a.type === 1);
    const hasFast   = gs.activePowerups.some(a => a.type === 2);
    const hasTriple = gs.activePowerups.some(a => a.type === 3);
    const hasPierce = gs.activePowerups.some(a => a.type === 4);
    const fireRate  = hasFast ? FAST_FIRE_RATE : BASE_FIRE_RATE;

    // ── Hero movement ─────────────────────────────────────────────────────────
    const hero = gs.hero;
    if (controls.movement.active) {
      hero.vx = controls.movement.x * HERO_SPEED;
      hero.vy = controls.movement.y * HERO_SPEED;
    } else {
      const k = keysRef.current;
      if (k.w || k.up)    hero.vy = Math.max(hero.vy - 0.5, -HERO_SPEED);
      if (k.s || k.down)  hero.vy = Math.min(hero.vy + 0.5,  HERO_SPEED);
      if (k.a || k.left)  hero.vx = Math.max(hero.vx - 0.5, -HERO_SPEED);
      if (k.d || k.right) hero.vx = Math.min(hero.vx + 0.5,  HERO_SPEED);
      hero.vx *= 0.9; hero.vy *= 0.9;
    }
    hero.x = clamp(hero.x + hero.vx, hero.radius, CW - hero.radius);
    hero.y = clamp(hero.y + hero.vy, hero.radius, CH - hero.radius);

    hero.direction = controls.aiming.active
      ? controls.aiming.angle
      : Math.atan2(mouseRef.current.y - hero.y, mouseRef.current.x - hero.x);

    hero.damageFlash = Math.max(0, hero.damageFlash - 1);
    gs.screenShake   = Math.max(0, gs.screenShake - 0.4);

    // ── Fire ──────────────────────────────────────────────────────────────────
    if ((controls.aiming.firing || mouseRef.current.down) && now - gs.lastFire > fireRate) {
      gs.lastFire = now;
      playSound('shoot');
      const spreads = hasTriple ? [-0.22, 0, 0.22] : [0];
      for (const spread of spreads) {
        const dir = hero.direction + spread;
        gs.bullets.push({
          id: uid(), x: hero.x, y: hero.y,
          vx: Math.cos(dir) * BULLET_SPEED, vy: Math.sin(dir) * BULLET_SPEED,
          radius: 3, damage: 1, pierced: 0,
        });
      }
    }

    // ── Spawn enemies ─────────────────────────────────────────────────────────
    const spawnRate = Math.max(380, 1000 - gs.level * 48);
    if (now - gs.lastEnemySpawn > spawnRate) {
      gs.lastEnemySpawn = now;
      gs.enemies.push(spawnEnemy(pickEnemyType(gs.level), hero.x, hero.y));
    }

    // ── Update bullets ────────────────────────────────────────────────────────
    gs.bullets = gs.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      return b.x > -50 && b.x < CW + 50 && b.y > -50 && b.y < CH + 50;
    });

    // ── Update enemies ────────────────────────────────────────────────────────
    const spawned: Enemy[] = [];
    gs.enemies = gs.enemies.map(e => {
      const ne = stepEnemy(e, hero.x, hero.y, hasSlow);
      // Spawner fires mini-chasers every ~15 frames
      if (ne.type === 10 && (ne.spawnTimer ?? 0) > 15) {
        ne.spawnTimer = 0;
        spawned.push({
          id: uid(), x: ne.x, y: ne.y,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          radius: 8, type: 2, hp: 1, maxHp: 1,
          value: 5, hue: 0, sat: 100, lit: 55, hitFlash: 0,
        });
      }
      return ne;
    });
    gs.enemies.push(...spawned);

    // ── Bullets vs enemies ────────────────────────────────────────────────────
    const maxPierce = hasPierce ? 3 : 0;
    const bulletsKilled = new Set<string>();
    const damageMap = new Map<string, number>();

    for (const b of gs.bullets) {
      if (bulletsKilled.has(b.id)) continue;
      for (const e of gs.enemies) {
        if (dist2d(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
          damageMap.set(e.id, (damageMap.get(e.id) ?? 0) + b.damage);
          b.pierced++;
          if (b.pierced > maxPierce) { bulletsKilled.add(b.id); break; }
        }
      }
    }
    gs.bullets = gs.bullets.filter(b => !bulletsKilled.has(b.id));

    // Apply damage; handle deaths
    const deadIds = new Set<string>();
    for (const [eid, dmg] of damageMap) {
      const e = gs.enemies.find(x => x.id === eid);
      if (!e) continue;
      e.hp -= dmg;
      e.hitFlash = 6;
      playSound('hit');
      if (e.hp > 0) continue;

      deadIds.add(eid);
      playSound('explosion');

      // Particles
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i / 12) + (Math.random() - 0.5) * 0.4;
        gs.particles.push({
          id: uid(), x: e.x, y: e.y,
          vx: Math.cos(a) * (2 + Math.random() * 4),
          vy: Math.sin(a) * (2 + Math.random() * 4),
          radius: 2 + Math.random() * 3, hue: e.hue, alpha: 1,
        });
      }

      // Score floater
      gs.floaters.push({ id: uid(), x: e.x, y: e.y - 10, text: `+${e.value}`, age: 0, color: `hsl(${e.hue || 60},100%,70%)` });

      // Score / level
      gs.score += e.value;
      gs.kills++;
      const newLevel = getLevelFromKills(gs.kills);
      if (newLevel > gs.lastLevel) {
        gs.lastLevel = newLevel;
        gs.level = newLevel;
        gs.floaters.push({ id: uid(), x: CW / 2, y: CH / 2 - 20, text: `LEVEL ${newLevel}!`, age: 0, color: '#ffff44' });
        playSound('levelup');
      }
      onStatsUpdate(prev => ({
        ...prev, score: gs.score, kills: gs.kills, level: gs.level,
        time: gs.gameTime / 1000, bestScore: Math.max(prev.bestScore, gs.score),
      }));

      // Splitter → 4 mini chasers
      if (e.type === 3) {
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI * 2 * i / 4) + Math.PI / 4;
          gs.enemies.push({
            id: uid(), x: e.x + Math.cos(a) * 35, y: e.y + Math.sin(a) * 35,
            vx: Math.cos(a), vy: Math.sin(a),
            radius: 15, type: 2, hp: 1, maxHp: 1,
            value: 5, hue: 210, sat: 100, lit: 70, hitFlash: 0,
          });
        }
      }

      // Powerup drop (20 %)
      if (Math.random() < 0.2) {
        gs.powerups.push({ id: uid(), x: e.x, y: e.y, type: Math.floor(Math.random() * 5), radius: 12, age: 0 });
      }
    }
    gs.enemies = gs.enemies.filter(e => !deadIds.has(e.id));

    // ── Hero vs enemies ───────────────────────────────────────────────────────
    if (!doneRef.current) {
      let touching = false;
      for (const e of gs.enemies) {
        if (dist2d(hero.x, hero.y, e.x, e.y) < hero.radius + e.radius) { touching = true; break; }
      }
      if (touching) {
        hero.life = Math.max(0, hero.life - 0.005);
        hero.damageFlash = Math.max(hero.damageFlash, 10);
        gs.screenShake = Math.min(10, gs.screenShake + 1.5);
        playSound('takingDamage');
        if (hero.life <= 0) {
          doneRef.current = true;
          playSound('death');
          onGameOver({
            score: gs.score, kills: gs.kills, level: gs.level,
            time: gs.gameTime / 1000, bestScore: Math.max(bestRef.current, gs.score),
          });
        }
      }
    }

    // ── Hero vs powerups ──────────────────────────────────────────────────────
    gs.powerups = gs.powerups.filter(p => {
      p.age++;
      if (dist2d(hero.x, hero.y, p.x, p.y) < hero.radius + p.radius) {
        playSound('powerup');
        if (p.type === 0) {
          hero.life = Math.min(1, hero.life + 0.5);
        } else {
          gs.activePowerups = gs.activePowerups.filter(a => a.type !== p.type);
          gs.activePowerups.push({ type: p.type, expiresAt: now + POWERUP_DUR });
        }
        gs.floaters.push({ id: uid(), x: p.x, y: p.y - 12, text: POWERUP_NAMES[p.type], age: 0, color: POWERUP_COLORS[p.type] });
        return false;
      }
      return p.age < 600; // expire after ~10 s
    });

    // ── Particles ─────────────────────────────────────────────────────────────
    gs.particles = gs.particles.filter(p => {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.radius *= 0.97; p.alpha *= 0.97;
      return p.radius > 0.5;
    });

    // ── Floaters ──────────────────────────────────────────────────────────────
    gs.floaters = gs.floaters.filter(f => { f.y -= 0.8; f.age++; return f.age < 50; });

    // ── Render ────────────────────────────────────────────────────────────────
    renderGame(ctx, gs);

    animRef.current = requestAnimationFrame(gameLoop);
  }, [getControlsState, playSound, renderGame, onStatsUpdate, onGameOver]);

  // Start/stop RAF
  useEffect(() => {
    animRef.current = requestAnimationFrame(gameLoop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gameLoop]);

  // ── Input handlers ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onKD = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) keysRef.current[k as keyof typeof keysRef.current] = true;
      if (k === 'm') toggleMute();
      if (k === 't' && isTouchDevice) toggleControls();
    };
    const onKU = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) keysRef.current[k as keyof typeof keysRef.current] = false;
    };
    const onMM = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouseRef.current.x = e.clientX - r.left; mouseRef.current.y = e.clientY - r.top; };
    const onMD = () => { mouseRef.current.down = true; };
    const onMU = () => { mouseRef.current.down = false; };

    const onTS = (e: TouchEvent) => {
      const c = getControlsState();
      if (!c.movement.active && !c.aiming.active) {
        e.preventDefault();
        if (e.touches.length > 0) {
          const r = canvas.getBoundingClientRect();
          mouseRef.current.x = e.touches[0].clientX - r.left;
          mouseRef.current.y = e.touches[0].clientY - r.top;
          mouseRef.current.down = true;
        }
      }
    };
    const onTM = (e: TouchEvent) => {
      const c = getControlsState();
      if (!c.movement.active && !c.aiming.active) {
        e.preventDefault();
        if (e.touches.length > 0) {
          const r = canvas.getBoundingClientRect();
          mouseRef.current.x = e.touches[0].clientX - r.left;
          mouseRef.current.y = e.touches[0].clientY - r.top;
        }
      }
    };
    const onTE = (e: TouchEvent) => {
      const c = getControlsState();
      if (!c.movement.active && !c.aiming.active) { e.preventDefault(); mouseRef.current.down = false; }
    };

    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);
    canvas.addEventListener('mousemove', onMM);
    canvas.addEventListener('mousedown', onMD);
    canvas.addEventListener('mouseup', onMU);
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKD);
      window.removeEventListener('keyup', onKU);
      canvas.removeEventListener('mousemove', onMM);
      canvas.removeEventListener('mousedown', onMD);
      canvas.removeEventListener('mouseup', onMU);
      canvas.removeEventListener('touchstart', onTS);
      canvas.removeEventListener('touchmove', onTM);
      canvas.removeEventListener('touchend', onTE);
    };
  }, [toggleMute, isTouchDevice, toggleControls, getControlsState]);

  // ── Screens ──────────────────────────────────────────────────────────────────

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <h1 className="text-4xl font-bold mb-2 tracking-widest text-cyan-400">ONYIX RAIDER</h1>
        <p className="text-sm text-gray-500 mb-6">Survive the waves</p>
        <p className="text-yellow-400 font-bold text-xl mb-8">
          Best: {gameStats.bestScore.toLocaleString()}
        </p>
        <div className="text-xs text-gray-500 space-y-1 text-center">
          <p>WASD / Arrows — Move</p>
          <p>Mouse — Aim &amp; Fire</p>
          {isTouchDevice && <p>Virtual joysticks appear during play</p>}
          <p className="mt-3 text-gray-700">13 enemy types · 5 powerups · 13 levels</p>
        </div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <h2 className="text-3xl font-bold text-red-500 mb-6 tracking-widest">GAME OVER</h2>
        <p className="text-2xl font-bold mb-2">{gameStats.score.toLocaleString()} pts</p>
        <p className="text-gray-400 mb-4">
          Level {gameStats.level} · {gameStats.kills} kills · {Math.floor(gameStats.time)}s
        </p>
        {gameStats.score > 0 && gameStats.score >= gameStats.bestScore && (
          <p className="text-yellow-400 font-bold animate-pulse">✦ NEW HIGH SCORE ✦</p>
        )}
        <p className="text-gray-600 text-sm mt-6">Tap Start to play again</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="block mx-auto"
        style={{ touchAction: 'none', border: '1px solid #1a1a2e' }}
      />
      {showControls && gameState === 'play' && (
        <>
          <VirtualJoystick
            position="left" type="movement"
            isActive={getControlsState().movement.active}
            value={{ x: getControlsState().movement.x, y: getControlsState().movement.y }}
            onRef={(ref) => { if (leftZoneRef.current !== ref) leftZoneRef.current = ref; }}
          />
          <VirtualJoystick
            position="right" type="aiming"
            isActive={getControlsState().aiming.active}
            value={{ x: 0, y: 0 }}
            onRef={(ref) => { if (rightZoneRef.current !== ref) rightZoneRef.current = ref; }}
          />
          <button
            onClick={toggleControls}
            className="fixed top-4 right-4 w-8 h-8 rounded-full bg-black/30 border border-white/20 flex items-center justify-center text-white/60 hover:text-white/80"
            style={{ touchAction: 'manipulation' }}
          >⚙</button>
        </>
      )}
      {!isTouchDevice && gameState === 'play' && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-white/30 text-xs font-mono pointer-events-none">
          WASD Move · Mouse Aim/Fire · M Mute
        </div>
      )}
    </div>
  );
}
