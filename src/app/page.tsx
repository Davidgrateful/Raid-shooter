import { Header } from '@/components/Header';
import { GameCanvas } from '@/components/GameCanvas';
import { MarketBridge } from '@/components/MarketBridge';
import { TurnstileGate } from '@/components/TurnstileGate';
import { PartnersBar } from '@/components/PartnersBar';
import { GameOverlays } from '@/components/GameOverlays';
import { BoardOverlay } from '@/components/BoardOverlay';
import { GameOverOverlay } from '@/components/GameOverOverlay';
import { StarterBundleModal } from '@/components/StarterBundleModal';
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
      <GameOverlays />
      <BoardOverlay />
      <GameOverOverlay />
      <StarterBundleModal />
      <GameChatWidget />
      <SettingsOverlay />
      <div id="rotate-overlay">
        <div className="phone" />
        <p className="text-sm text-white/80">
          ROTATE YOUR DEVICE
          <br />
          PLAY IN LANDSCAPE
        </p>
      </div>
    </main>
  );
}
