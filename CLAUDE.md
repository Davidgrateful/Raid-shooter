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

## Admin / team dashboard

`/admin` (gated by `ADMIN_STATS_TOKEN`): player stats, revenue, loadout usage,
market config, recent purchases, a players table (call sign, wallet, games,
spend) with derank/ban moderation, plus player lookup and item grant tools.

## Conventions

- The marketplace must NEVER affect a live run or score (cosmetics only).
- Diag endpoints return booleans/previews only — never full secrets or the
  treasury address.
- The bitmap font (`text.js`) supports only ` $+,.\/0-9:@A-Z` — no lowercase or
  parentheses. Keep new in-game UI text within that set.
- Gated features degrade gracefully: no env key → feature is a silent no-op.
- Verify game changes with Playwright (`/opt/pw-browsers/chromium`) against
  `next start`; check TS with `npx tsc --noEmit` and `node --check` for the
  vanilla JS engine files.
