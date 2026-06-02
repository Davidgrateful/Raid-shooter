# Raid Shooter

<img width="200px" src="received_661686108319509.jpeg" align="center" alt="Elisha David" />

Raid Shooter is a space themed shoot 'em up where you must blast away unrelenting enemies before they destroy you. The game features 13 enemy types, 5 powerups, parallax backgrounds, retro sound effects, and locally stored stats.

Now migrated to **Next.js** with **wallet connection** and **Sign-In With Ethereum (SIWE)** authentication.

## Installation

```bash
npm install
```

## Running Locally

```bash
# Copy environment variables
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes (prod) | Iron-session encryption key, at least 32 chars. A dev fallback is built in. |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Yes | Reown Cloud project ID. Required for wallet connection to work properly. |

### Getting a Reown Project ID

1. Go to [https://cloud.reown.com](https://cloud.reown.com)
2. Sign up or log in
3. Click **Create Project**
4. Give it a name (e.g. "Raid Shooter") and pick the **AppKit** product
5. Copy the **Project ID** from the project dashboard
6. Paste it into your `.env.local`:
   ```
   NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id_here
   ```
7. In the Reown dashboard, add your domains under **Settings → Domains** (e.g. `http://localhost:3000` for dev, your production URL for prod)
8. Restart `npm run dev`

## Controls

| Action | Input |
|---|---|
| Move | WASD / Arrow keys |
| Aim & Fire | Mouse |
| Autofire | F |
| Pause | P |
| Mute | M |

Touch controls (dual virtual joysticks) also work on mobile.

## Wallet Connection

- Click **Connect Wallet** in the top-right header bar to open the Reown AppKit modal.
- Uses [Reown AppKit](https://reown.com/appkit) (the new name for WalletConnect) with [wagmi](https://wagmi.sh) + [viem](https://viem.sh).
- Supports injected wallets (MetaMask, Brave, Coinbase Wallet, Rabby, etc.), WalletConnect-compatible mobile wallets, and more — all through the unified Reown modal.
- Configured for Ethereum Mainnet and Sepolia by default; add more chains in `src/lib/wagmi-config.ts` (import from `@reown/appkit/networks`).

## SIWE Authentication

After connecting a wallet, click **Sign In** to authenticate via [Sign-In With Ethereum](https://login.xyz):

1. Client requests a nonce from `GET /api/siwe/nonce`
2. Client constructs a SIWE message with domain, address, chainId, nonce
3. User signs the message in their wallet
4. Client sends the message + signature to `POST /api/siwe/verify`
5. Server verifies the signature, checks nonce and domain, creates an encrypted session cookie
6. Session can be checked via `GET /api/siwe/session` and destroyed via `DELETE /api/siwe/session`

Sessions are stored server-side using [iron-session](https://github.com/vvo/iron-session) (encrypted cookies, no database needed).

## Project Structure

```
src/
  app/
    layout.tsx          # Root layout with WalletProvider
    page.tsx            # Main page: header + game canvas
    globals.css         # Global styles including game container styles
    api/siwe/           # SIWE auth API routes (nonce, verify, session)
  components/
    GameCanvas.tsx      # Client component that loads the game engine
    Header.tsx          # Top bar with title and wallet controls
    WalletButton.tsx    # Connect/Sign In/Sign Out button
    WalletProvider.tsx  # wagmi + react-query provider wrapper
  hooks/
    useSIWE.ts          # React hook for SIWE sign-in/sign-out flow
  lib/
    session.ts          # iron-session configuration
    wagmi-config.ts     # wagmi chain and connector configuration
public/
  game/                 # Original game engine JS files (served statically)
js/                     # Original source JS files (preserved for reference)
```

## Credits

**Created By:** @vcg_run
**Software Development:** Elisha David (https://elishadavid.netlify.app), Melvin Jones Repol (https://mrepol742.github.io)
**Audio Processing:** [JSFXR](https://github.com/mneubrand/jsfxr) by @markusneubrand
**Game Inspiration:** Asteroids, Cell Warfare, Space Pips, and many more
**HTML5 Canvas Reference:** [HTML5 Canvas Cheat Sheet](https://simon.html5.org/dump/html5-canvas-cheat-sheet.html)
**Game Math Reference:** Billy Lamberta - Foundation HTML5 Animation with JavaScript
