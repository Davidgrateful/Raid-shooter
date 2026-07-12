'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit, useAppKitEvents } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks } from '@/lib/wagmi-config';
import { mainnet } from '@reown/appkit/networks';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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

// Expired-session sweep, also BEFORE createAppKit(): the "old players can't
// connect" bug. WalletConnect v2 persists every session and pairing in
// localStorage (wc@2:client:0.3//session, wc@2:core:0.3//pairing, ...) with
// an `expiry` unix timestamp - sessions live ~7 days. A player who connected
// last week and comes back after expiry still has the dead records on disk;
// wagmi's silent auto-reconnect then tries to revive them against the relay
// and hangs or errors ("Failed to publish custom payload" in the admin
// telemetry) instead of falling back to a clean Connect Wallet button. New
// players have no stored session, so they never hit this - which is exactly
// why only OLD players report it. The sweep: parse the stored records, and
// if every session AND pairing is past its expiry (or unparseable), wipe all
// WalletConnect/AppKit connection caches so startup begins from a clean
// slate and the button works first tap. A single still-valid record keeps
// everything untouched, so a genuinely live session still auto-reconnects.
// Injected extensions (MetaMask et al) don't store wc@2 records - unaffected.
if (typeof window !== 'undefined') {
  try {
    const now = Math.floor(Date.now() / 1000);
    const wcKeys = Object.keys(window.localStorage).filter((k) => k.startsWith('wc@2'));
    const recordKeys = wcKeys.filter((k) => /\/\/(session|pairing)$/.test(k));
    let total = 0;
    let live = 0;
    for (const key of recordKeys) {
      try {
        const records = JSON.parse(window.localStorage.getItem(key) || '[]') as { expiry?: number }[];
        for (const record of records) {
          total++;
          if (typeof record.expiry === 'number' && record.expiry > now) live++;
        }
      } catch {
        // unparseable store counts as dead
      }
    }
    if (total > 0 && live === 0) {
      const stalePrefixes = ['wc@2', '@w3m', 'w3m', '@appkit', 'walletconnect'];
      for (const key of Object.keys(window.localStorage)) {
        const k = key.toLowerCase();
        if (stalePrefixes.some((p) => k.startsWith(p))) {
          window.localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // localStorage unavailable - nothing to sweep
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
// `basic` - createAppKit() itself still receives a fully-typed object.
//
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

// "Some people can connect, others can't" was reported with no console log,
// no wallet name, nothing to diagnose from - every prior fix in this file
// was found by reading SDK source, not by seeing what actually failed for a
// real player. AppKit already emits CONNECT_ERROR / USER_REJECTED /
// DISCONNECT_ERROR on its internal event bus; this just listens and reports
// them to /api/wallet/connect-error so the NEXT occurrence shows up in
// /admin with a wallet name, an error message, and a user agent instead of
// being another blind report. Also remembers the most recently selected
// wallet (SELECT_WALLET fires before the attempt) so a failure can be
// attributed to a specific wallet brand. Best-effort only - never throws,
// never blocks the connect flow, and reports nothing on success.
function WalletErrorReporter() {
  const events = useAppKitEvents();
  const lastSeenTimestamp = useRef<number>(0);
  const lastWalletName = useRef<string | undefined>(undefined);
  // Relay-failure hint, shown AFTER a real CONNECT_ERROR whenever there's no
  // injected provider already (inside a wallet's own browser, or with an
  // extension already handling the connection, the relay never enters the
  // picture and this hint would be nonsense). Originally scoped to mobile
  // only - the theory being the relay handshake dies across an app switch -
  // but the SAME "Failed to publish custom payload" error keeps showing up
  // from desktop Chrome too (Uniswap Wallet, MetaMask), which means it's not
  // just an app-switch problem: it's the underlying WalletConnect relay
  // pairing itself being unreliable, desktop QR-scan flows included. That's
  // relay infrastructure - unfixable from here - so instead of guessing at
  // one specific trigger, the hint now fires on any CONNECT_ERROR and gives
  // device-appropriate advice: on a phone, open the game inside the wallet's
  // own browser (skips the relay/app-switch entirely); on desktop, install/
  // use that wallet's browser extension instead of scanning a QR code (also
  // skips the relay), or just retry - these are often transient.
  const [hint, setHint] = useState<'mobile' | 'desktop' | null>(null);

  useEffect(() => {
    if (!events || events.timestamp === lastSeenTimestamp.current) return;
    lastSeenTimestamp.current = events.timestamp;

    const data = events.data;
    if (!data || data.type !== 'track') return;

    if (data.event === 'SELECT_WALLET') {
      lastWalletName.current = data.properties?.name;
      return;
    }
    if (data.event !== 'CONNECT_ERROR' && data.event !== 'USER_REJECTED' && data.event !== 'DISCONNECT_ERROR') {
      return;
    }

    if (data.event === 'CONNECT_ERROR' && !(window as unknown as { ethereum?: unknown }).ethereum) {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      setHint(isMobile ? 'mobile' : 'desktop');
    }

    const payload = {
      kind: data.event,
      walletName: lastWalletName.current,
      message: 'properties' in data ? data.properties?.message : undefined,
    };
    fetch('/api/wallet/connect-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // best-effort telemetry - never surface this to the player
    });
  }, [events]);

  if (!hint) return null;

  return (
    <div
      data-game-ui=""
      style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 80, width: 'min(92vw, 420px)' }}
      className="rounded-xl border border-cyan-400/40 bg-[#0b0e16]/95 p-3.5 text-white shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg">{hint === 'mobile' ? '📱' : '💻'}</span>
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-white/80">
          {hint === 'mobile' ? (
            <>
              <b className="text-cyan-300">Connection didn&apos;t go through?</b> The most
              reliable way on phones is opening this game inside your wallet app&apos;s own browser:
              open {lastWalletName.current ? <b>{lastWalletName.current}</b> : 'your wallet app'}, find its
              <b> Browser / Discover</b> tab, and go to <b className="font-mono">raidshooter.xyz</b> —
              the wallet connects instantly there, no approval ping-pong.
            </>
          ) : (
            <>
              <b className="text-cyan-300">Connection didn&apos;t go through?</b> QR-code connects
              can be flaky. If {lastWalletName.current ? <b>{lastWalletName.current}</b> : 'your wallet'} has
              a browser extension, install and use that instead — it connects directly,
              no scan required. Otherwise just try again in a few seconds.
            </>
          )}
        </div>
        <button
          onClick={() => setHint(null)}
          aria-label="Close"
          className="shrink-0 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletErrorReporter />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
