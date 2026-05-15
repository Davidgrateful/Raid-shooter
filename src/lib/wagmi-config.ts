import { cookieStorage, createStorage } from 'wagmi';
import { mainnet, sepolia } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// Reown Cloud project ID — get one at https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  console.warn(
    '[Reown] NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Wallet connection will be limited. Get a project ID at https://cloud.reown.com'
  );
}

// Chains to support — easy to extend
export const networks = [mainnet, sepolia] as const;

// Wagmi adapter bridges Reown AppKit with wagmi hooks
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || 'dev-placeholder',
  networks: [...networks],
});

export const config = wagmiAdapter.wagmiConfig;
