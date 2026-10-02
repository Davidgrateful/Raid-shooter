'use client';

import { WalletRuntimeProvider } from '@/components/wallet/WalletRuntime';
import AdminApp from './AdminApp';

// The admin tools use wagmi hooks in the page itself (paying winners from the
// operator's wallet), so /admin renders inside the wallet runtime from the
// start. The game loads it on demand instead - see src/lib/walletStore.ts.
export default function AdminPage() {
  return (
    <WalletRuntimeProvider>
      <AdminApp />
    </WalletRuntimeProvider>
  );
}
