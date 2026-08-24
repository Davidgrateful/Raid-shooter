import { Header } from '@/components/Header';
import { GameCanvas } from '@/components/GameCanvas';
import { MarketBridge } from '@/components/MarketBridge';
import { TurnstileGate } from '@/components/TurnstileGate';
import { PartnersBar } from '@/components/PartnersBar';
import { GameOverlays } from '@/components/GameOverlays';
import { CommandCenter } from '@/components/command/CommandCenter';
import { BoardOverlay } from '@/components/BoardOverlay';
import { GameOverOverlay } from '@/components/GameOverOverlay';
import { StarterBundleModal } from '@/components/StarterBundleModal';
import { StreakBoard } from '@/components/StreakBoard';
import { GameChatWidget } from '@/components/GameChatWidget';
import { SettingsOverlay } from '@/components/SettingsOverlay';

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080808]">
      <Header />
      <GameCanvas />
      <MarketBridge />
      <TurnstileGate />
      <PartnersBar />
      <CommandCenter />
      <GameOverlays />
      <BoardOverlay />
      <GameOverOverlay />
      <StarterBundleModal />
      <StreakBoard />
      <GameChatWidget />
      <SettingsOverlay />
      <div id="rotate-overlay">
        <div className="phone" />
        <p className="rs-label" style={{ color: 'var(--rs-cyan)', fontSize: 12 }}>
          ROTATE TO FLY
        </p>
        <p className="text-[11px] tracking-[0.2em] text-white/35">RAIDS RUN IN LANDSCAPE</p>
      </div>
    </main>
  );
}
