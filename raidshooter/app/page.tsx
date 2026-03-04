"use client";

import { useState, useCallback } from "react";
import RaidShooterGame from "./components/RaidShooterGame";

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'play' | 'gameover'>('menu');
  const [gameStats, setGameStats] = useState({
    score: 0,
    level: 1,
    kills: 0,
    time: 0,
    bestScore: 0,
  });

  const handleGameOver = useCallback((finalStats: typeof gameStats) => {
    setGameState('gameover');
    setGameStats(finalStats);
  }, []);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] bg-black">
      <div className="w-full max-w-md mx-auto">
        <main className="flex-1">
          <RaidShooterGame
            gameState={gameState}
            gameStats={gameStats}
            onGameStateChange={setGameState}
            onStatsUpdate={setGameStats}
            onGameOver={handleGameOver}
          />
        </main>
      </div>
    </div>
  );
}
