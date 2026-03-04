"use client";

import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
  useClose,
  usePrimaryButton,
  useNotification,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./components/DemoComponents";
import { Icon } from "./components/DemoComponents";
import RaidShooterGame from "./components/RaidShooterGame";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [gameState, setGameState] = useState<'menu' | 'play' | 'gameover'>('menu');
  const [gameStats, setGameStats] = useState({
    score: 0,
    level: 1,
    kills: 0,
    time: 0,
    bestScore: 0,
  });

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();
  const close = useClose();
  const { sendNotification } = useNotification();

  // Set frame ready when component mounts
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Primary button for game controls
  usePrimaryButton(
    {
      text: gameState === 'play' ? 'Pause Game' : gameState === 'menu' ? 'Start Game' : 'Play Again',
    },
    () => {
      if (gameState === 'menu') {
        setGameState('play');
        setGameStats(prev => ({ ...prev, score: 0, level: 1, kills: 0, time: 0 }));
      } else if (gameState === 'play') {
        // Pause functionality would be handled by the game component
      } else if (gameState === 'gameover') {
        setGameState('menu');
      }
    }
  );

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    if (frameAdded) {
      setFrameAdded(true);
      await sendNotification({
        title: 'Onyix Raider Added! 🚀',
        body: 'You can now play anytime from your saved frames!'
      });
    }
  }, [addFrame, sendNotification]);

  const handleGameOver = useCallback(async (finalStats: typeof gameStats) => {
    setGameState('gameover');
    setGameStats(finalStats);
    
    if (finalStats.score > gameStats.bestScore) {
      await sendNotification({
        title: 'New High Score! 🎉',
        body: `You scored ${finalStats.score.toLocaleString()} points!`
      });
    }
  }, [gameStats.bestScore, sendNotification]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-2"
          icon={<Icon name="plus" size="sm" />}
        >
          Save
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] bg-black">
      <div className="w-full max-w-md mx-auto">
        {/* Header - only show in menu state */}
        {gameState === 'menu' && (
          <header className="flex justify-between items-center p-4 h-16">
            <div>
              <Wallet className="z-10">
                <ConnectWallet>
                  <Name className="text-white text-sm" />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
            <div className="flex items-center space-x-2">
              {saveFrameButton}
              <Button
                variant="ghost"
                size="sm"
                onClick={close}
                className="text-white"
              >
                Close
              </Button>
            </div>
          </header>
        )}

        {/* Game Content */}
        <main className="flex-1">
          <RaidShooterGame
            gameState={gameState}
            gameStats={gameStats}
            onGameStateChange={setGameState}
            onStatsUpdate={setGameStats}
            onGameOver={handleGameOver}
          />
        </main>

        {/* Footer - only show in menu state */}
        {gameState === 'menu' && (
          <footer className="p-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 text-xs"
              onClick={() => openUrl("https://base.org/builders/minikit")}
            >
              Built on Base with MiniKit
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}
