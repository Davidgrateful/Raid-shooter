'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/lib/wagmi-config';
import { mainnet } from '@reown/appkit/networks';
import { useState, type ReactNode } from 'react';

// One-time cleanup, BEFORE createAppKit() below reads any persisted state:
// `basic: true` (see the block below) hard-disables the embedded email/
// social wallet flow, but a player who hit that flow before this fix
// shipped can still be carrying its leftover session keys in localStorage
// (@appkit/connected_social, @appkit/siwx-auth-token, etc.). Those now
// reference a connector type this client no longer registers under basic
// mode, so AppKit's auto-reconnect can choke on them inconsistently -
// exactly the kind of per-player "some people can connect, others can't"
// symptom that's otherwise invisible to us. Safe to always clear: these
// keys only ever back the email/social flow, never an injected extension
// or WalletConnect session, so this can never disconnect anyone with a
// real, working wallet connection.
if (typeof window !== 'undefined') {
  try {
    const embeddedOnlyKeys = [
      '@appkit/connected_social',
      '@appkit-wallet/SOCIAL_USERNAME',
      '@appkit/social_provider',
      '@appkit/recent_emails',
      '@appkit/siwx-auth-token',
      '@appkit/siwx-nonce-token',
    ];
    for (const key of embeddedOnlyKeys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) - nothing to clean up
  }
}

// Initialize Reown AppKit at module load. This is the last Vercel-working
// wallet baseline (plain WalletConnect: connect an existing wallet / injected
// extension), restored after the embedded email/social variant caused
// "Invalid App Configuration". The only addition kept over the baseline is the
// try/catch: WalletProvider wraps the ENTIRE app, so an unguarded throw here
// (bad config / unverified domain hitting the Verify API) would white-screen
// the whole game. The wallet is secondary - it must never take the game down.
//
// NOTE: the in-app "create a wallet" flow (email + Google/X -> smart account)
// is intentionally OFF here.
//
// `features: { email: false, socials: false }` alone does NOT reliably
// disable this. AppKit's ConfigUtil fetches remote feature flags from the
// Reown Cloud project dashboard on every init; if THAT project has Email or
// Social login toggled on (the SDK default for a new project), the remote
// config silently WINS and our local `false` is discarded outright - AppKit
// even logs a console warning ("local configuration ... was ignored") when
// this happens. That's what caused the reported bug: a player clicked
// Connect Wallet, the modal offered "Continue with email/Google", and
// picking one spun up a brand-new embedded non-custodial wallet the player
// never asked for and didn't recognize.
//
// `basic: true` is the actual fix - it forces every one of these
// dashboard-controlled features (email, socials, swaps, onramp, activity,
// multiWallet, etc.) off LOCALLY, unconditionally, regardless of what the
// Reown Cloud project has configured. Leaves plain wallet connect (an
// existing extension / WalletConnect QR) untouched, which is the only flow
// this game wants. Re-enable embedded wallets only as a deliberate product
// decision, not as a side effect of a dashboard toggle someone else flips.
//
// `basic` is deliberately omitted from createAppKit()'s public TS type
// (Reown's own `CreateAppKit = Omit<AppKitOptions, ... | 'basic'>`), but the
// runtime implementation (exports/react.js) just spreads the options object
// straight through to the underlying client unmodified - `basic` reaches
// ConfigUtil exactly like every other option. Verified against the installed
// package source before relying on this. The cast below only widens the
// param type to admit the one field Reown's types withhold; every other
// key still gets full type-checking against AppKitOptions.
type AppKitOptionsWithBasic = Parameters<typeof createAppKit>[0] & { basic: boolean };

// assigned to a typed variable (not passed as an inline literal) so the
// excess-property check runs against AppKitOptionsWithBasic, which admits
// `basic` - createAppKit() itself still receives a fully-typed object
// WalletConnect's spec requires metadata.icons to be a non-empty array of an
// HTTPS-reachable image, or the pairing request that gets relayed to a mobile
// wallet arrives with no icon. Several wallets - MetaMask's connect prompt
// notably - treat a missing/broken icon as a signal alongside their domain
// verification check, and will warn or block the connection; others render a
// blank icon and connect anyway without complaint. That split explains
// "some people can wallet connect, others can't" along wallet-brand lines:
// it was never fully broken, just inconsistently accepted. `icons: []` here
// was the gap - fixed to a real square badge (public/wallet-icon.png,
// composited from the wordmark logo onto the game's brand background, since
// the source logo is a wide non-square wordmark that would render cropped/
// distorted in the small square badge most wallets show).
const origin = typeof window !== 'undefined' ? window.location.origin : 'https://raidshooter.xyz';

const appKitOptions: AppKitOptionsWithBasic = {
  adapters: [wagmiAdapter],
  projectId: projectId || 'dev-placeholder',
  networks: [...networks],
  defaultNetwork: mainnet,
  metadata: {
    name: 'Raid Shooter',
    description: 'Canvas-based arcade shooter with Web3 wallet integration',
    url: origin,
    icons: [`${origin}/wallet-icon.png`],
  },
  basic: true,
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  themeMode: 'dark',
};

try {
  createAppKit(appKitOptions);
} catch (err) {
  // never let a wallet-config error break the game
  console.error('[Reown] AppKit init failed — wallet disabled, game unaffected:', err);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
