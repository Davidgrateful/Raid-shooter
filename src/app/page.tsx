import { Header } from '@/components/Header';
import { GameCanvas } from '@/components/GameCanvas';
import { MarketBridge } from '@/components/MarketBridge';

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080808]">
      <Header />
      <GameCanvas />
      <MarketBridge />
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
