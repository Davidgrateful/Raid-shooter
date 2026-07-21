# Publishing Raid Shooter to the Google Play Store — when you're ready

Raid Shooter is already an **installable PWA** (players get it straight from the
browser, no store needed). This guide is for later: turning that same PWA into a
real Play Store listing with a "Download" button. Nothing here is built yet —
it's the recipe.

## The approach: TWA (Trusted Web Activity)

You do **not** rebuild the game. A TWA is a thin Android wrapper that opens the
live site full-screen in Chrome under the hood. Same code, same deploys — you
ship an update to Vercel and the app updates instantly, no re-submission. The
tool that generates it is **Bubblewrap** (Google's official CLI).

## What you need before starting

1. **Google Play Console account** — one-time **$25** fee. (play.google.com/console)
2. **The site live on its real domain** — `raidshooter.xyz` (the PWA must be
   reachable at a stable HTTPS URL; it already is).
3. **A signing key** — Bubblewrap generates it; **back it up**, you can never
   change it once published.
4. About **1–2 hours** for first submission, then review takes a few days.

## The steps (roughly)

1. `npm i -g @bubblewrap/cli`
2. `bubblewrap init --manifest https://raidshooter.xyz/manifest.webmanifest`
   — it reads the manifest we already ship (name, icons, colors) and asks a few
   questions.
3. `bubblewrap build` — produces a signed `.aab` (Android App Bundle) to upload.
4. **Digital Asset Links** — Bubblewrap prints an `assetlinks.json`. Host it at
   `https://raidshooter.xyz/.well-known/assetlinks.json` (a small file in
   `public/.well-known/`). This is what removes the browser address bar so it
   looks like a native app instead of a Chrome tab. **Without it the app shows a
   URL bar.**
5. In Play Console: create the app, upload the `.aab`, fill store listing
   (screenshots, description, the 512 icon we already have), set content rating,
   privacy policy URL (you have `/privacy`), submit.

## ⚠️ The one thing to get right: the crypto policy

This is why I flagged it. Google Play's payments policy is strict about
**in-app digital purchases** and has specific **blockchain/crypto** rules.

- **Safe:** the game itself is free, skill-based, no purchase required to play.
  That's the core listing and it's clean.
- **The risk:** the **cosmetics marketplace** (on-chain USDC purchases) and
  **cup payouts**. Google may require these go through Play Billing, or may
  allow them under the crypto exemption **if** the transactions are genuinely
  on-chain wallet-to-wallet (which yours are) and clearly not gated behind Play.
- **Practical play:** consider a **"lite" TWA build for Play** where the
  marketplace is hidden/disabled (env flag — the game already degrades
  gracefully with features off), so the Play version is purely the free game +
  leaderboard. Players who want cosmetics use the web/PWA version. This
  sidesteps the policy fight entirely.

Decide this **before** you submit — it's the difference between a smooth
approval and a rejection loop.

## Also test before submitting

- **Wallet-in-webview:** wallet connect (Reown/WalletConnect) inside the TWA's
  Chrome context — verify the connect flow and any deep-links back to wallet
  apps actually work on a physical Android device.
- **The install prompt:** hide our in-app "Install" button when running as the
  installed TWA (it's redundant there) — a small check on
  `display-mode: standalone`.

## Bottom line

The PWA covers "download and play" today with zero store risk. When you want the
Play Store badge specifically, it's ~$25 + Bubblewrap + the assetlinks file —
and the **only** real decision is whether the Play build includes the on-chain
marketplace or ships as the clean free-game version. Ping me and I'll run the
Bubblewrap setup and add the assetlinks route.
