'use client';

import { useEffect, useRef } from 'react';

/**
 * GameCanvas loads the original game engine scripts into a DOM container.
 *
 * The game expects a specific DOM structure (canvases with specific IDs) and
 * attaches everything to a global `$` object. We preserve this exactly as-is
 * to avoid breaking any game behavior.
 *
 * Scripts are loaded sequentially (order matters) via dynamic <script> tags,
 * matching the original index.html load order.
 */

const GAME_SCRIPTS = [
  '/game/touch-compat.js',
  '/game/jsfxr.js',
  '/game/util.js',
  '/game/storage.js',
  '/game/definitions.js',
  '/game/audio.js',
  '/game/text.js',
  '/game/hero.js',
  '/game/enemy.js',
  '/game/bullet.js',
  '/game/explosion.js',
  '/game/powerup.js',
  '/game/particle.js',
  '/game/particleemitter.js',
  '/game/textpop.js',
  '/game/levelpop.js',
  '/game/button.js',
  '/game/game.js',
];

export function GameCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const mount = mountRef.current;
    if (!mount) return;

    // Initialize the global game namespace (same as `var $ = {};` in original)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$ = {};

    // Load scripts sequentially
    let index = 0;
    function loadNext() {
      if (index >= GAME_SCRIPTS.length) {
        // All scripts loaded — trigger the game's init via "load" event simulation
        mount!.classList.add('loaded');
        document.documentElement.classList.add('loaded');
        return;
      }
      const script = document.createElement('script');
      script.src = GAME_SCRIPTS[index];
      script.onload = () => {
        index++;
        loadNext();
      };
      script.onerror = () => {
        console.error(`Failed to load game script: ${GAME_SCRIPTS[index]}`);
        index++;
        loadNext();
      };
      document.body.appendChild(script);
    }

    loadNext();
  }, []);

  return (
    <div id="game-mount" ref={mountRef} className="absolute inset-0">
      <div id="wrap">
        <div id="wrap-inner">
          <canvas id="cbg1"></canvas>
          <canvas id="cbg2"></canvas>
          <canvas id="cbg3"></canvas>
          <canvas id="cbg4"></canvas>
          <canvas id="cmg"></canvas>
          <canvas id="cfg"></canvas>
        </div>
      </div>
    </div>
  );
}
