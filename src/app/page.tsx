import { Header } from '@/components/Header';
import { GameCanvas } from '@/components/GameCanvas';
import { TurnstileGate } from '@/components/TurnstileGate';
import { PartnersBar } from '@/components/PartnersBar';
import { GameOverlays } from '@/components/GameOverlays';
import { CommandCenter } from '@/components/command/CommandCenter';
import { HangarScreen } from '@/components/hangar/HangarScreen';
import { ArmoryScreen } from '@/components/armory/ArmoryScreen';
import { LaunchScreen } from '@/components/raid/LaunchScreen';
import { UpgradeDraft } from '@/components/raid/UpgradeDraft';
import { BoardOverlay } from '@/components/BoardOverlay';
import { GameOverOverlay } from '@/components/GameOverOverlay';
import { StarterBundleModal } from '@/components/StarterBundleModal';
import { StreakBoard } from '@/components/StreakBoard';
import { GameChatWidget } from '@/components/GameChatWidget';
import { SettingsOverlay } from '@/components/SettingsOverlay';
import { DuelInvite } from '@/components/duels/DuelInvite';

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080808]">
      <Header />
      <GameCanvas />
      <TurnstileGate />
      <PartnersBar />
      <CommandCenter />
      <HangarScreen />
      <ArmoryScreen />
      <LaunchScreen />
      <UpgradeDraft />
      <GameOverlays />
      <BoardOverlay />
      <GameOverOverlay />
      <StarterBundleModal />
      <StreakBoard />
      <GameChatWidget />
      <SettingsOverlay />
      <DuelInvite />
    </main>
  );
}
