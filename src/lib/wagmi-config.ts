import { cookieStorage, createStorage } from 'wagmi';
import { mainnet, sepolia, base, baseSepolia } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// Reown Cloud project ID — get one at https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

// Whether wallet connect is actually usable. Without a real project ID the
// WalletConnect relay rejects the placeholder, so the modal opens but can
// never complete a connection — the UI checks this to warn instead of
// showing players a dead modal.
export const walletReady = !!projectId;

if (!projectId) {
  console.warn(
    '[Reown] NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Wallet connection will be limited. Get a project ID at https://cloud.reown.com'
  );
}

// Chains to support. Mainnet stays first: it is the default at connection
// time and universally supported by mobile wallets - defaulting to Base
// here broke mobile connections for wallets without it configured. The
// market switches the chain to Base only when a purchase starts.
export const networks = [mainnet, base, baseSepolia, sepolia] as const;

// Wagmi adapter bridges Reown AppKit with wagmi hooks
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || 'dev-placeholder',
  networks: [...networks],
});

export const config = wagmiAdapter.wagmiConfig;
