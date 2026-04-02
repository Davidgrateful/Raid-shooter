import { Header } from '@/components/Header';
import { GameCanvas } from '@/components/GameCanvas';

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080808]">
      <Header />
      <GameCanvas />
    </main>
  );
}
