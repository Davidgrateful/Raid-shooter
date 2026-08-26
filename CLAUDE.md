# Raid Shooter — project notes for Claude

Browser arcade shooter (vanilla JS canvas engine in `public/game/*.js`) wrapped
in a Next.js app (`src/`). On-chain cosmetics marketplace settled on Base,
wallet login via SIWE/Reown, leaderboard + profiles + stats in Redis (Upstash
KV). Deployed on Vercel.

## Operator reminders (proactively surface these)

When the user (the operator/owner) complains about something matching a trigger
below, remind them of the ready-made fix BEFORE digging into new work. These are
already built and gated — usually just an env var + redeploy.

- **Bot spam / fake or junk leaderboard entries / someone gaming the board /
  flood of fake scores** → Cloudflare **Turnstile** is already built and gated.
  Tell them to add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` in
  Vercel and redeploy to switch it on (guests get challenged, wallet players are
  exempt). No code change needed.

- **"My purchase disappeared" / bought item is gone after an update** → almost
  always KV not connected, so profiles fall back to ephemeral memory. Have them
  check `/api/market/diag` → `profilesPersistent`, and set
  `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or the prefixed Vercel variants).

- **Leaderboard reset itself / scores vanished after deploy / players can't see
  each other** → same root cause: KV not persistent. Check
  `/api/leaderboard/diag` → `persistent`.

- **Anyone can fake a sign-in / forged wallet / trust concerns** → `SESSION_SECRET`
  must be set in production (32+ random chars), or sessions are forgeable.

- **Wallet won't connect / modal opens but nothing happens / "shows a wallet
  but doesn't connect"** → `NEXT_PUBLIC_REOWN_PROJECT_ID` is not set, so AppKit
  falls back to a placeholder the WalletConnect relay rejects. Get a free ID at
  cloud.reown.com, set it in Vercel, add `raidshooter.xyz` to the project's
  allowed domains, redeploy. The Connect button greys out with an explanation
  until it's set (no dead modal). Email/social embedded wallets are enabled and
  need the same ID.

## Admin / team dashboard

`/admin` (gated by `ADMIN_STATS_TOKEN`): player stats, revenue, loadout usage,
market config, recent purchases, a players table (call sign, wallet, games,
spend) with derank/ban moderation, plus player lookup and item grant tools.

## Conventions

- Trails and finishes are cosmetic and never affect a run. HULLS, DRONES and
  FIELD KITS are not: hulls fly differently, drones grant a modest passive
  combat effect plus 10-25% pilot XP, and field kits are spent mid-run. The
  old note here said "the marketplace must NEVER affect a live run or score
  (cosmetics only)" - that has not been true since drones shipped, and a stale
  invariant is worse than none. Keep drone effects modest (see drones.js) and
  keep the cosmetic/gameplay split legible in the Armory's rack blurbs.
- Combat consumables set `$.runAssisted`, which is submitted with the score so
  the operator can audit paid help before a payout. Drones do NOT set it even
  though they can raise a run's score - see the note in `shooterboard.js`.
- Diag endpoints return booleans/previews only — never full secrets or the
  treasury address.
- The bitmap font (`text.js`) supports only ` $+,.\/0-9:@A-Z` — no lowercase or
  parentheses. Keep new in-game UI text within that set.
- Gated features degrade gracefully: no env key → feature is a silent no-op.
- Verify game changes with Playwright (`/opt/pw-browsers/chromium`) against
  `next start`; check TS with `npx tsc --noEmit` and `node --check` for the
  vanilla JS engine files.
