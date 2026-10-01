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
  until it's set (no dead modal). Check `/api/wallet/diag` first - it reports
  whether the ID is set and valid, and names the allowed-domains step.
  **The domain allowlist is the part that is easy to miss and breaks connection
  even when the ID is correct.**

- **"Sign in with email / Google doesn't appear"** → embedded email/social
  wallets are requested in `WalletProvider.tsx`, but `basic: false` means the
  Reown Cloud project config WINS. Email and Socials must also be toggled on
  for the project at cloud.reown.com. Same project ID, same domain allowlist as
  wallet connect - so if plain wallet connect is broken, email login is broken
  the same way and for the same reason.

- **"Social/email login connects but sign-in never completes"** → fixed in
  `src/lib/siwe-verify.ts`: those logins create smart-account wallets whose
  signatures are ERC-6492/1271, which the old EOA-only `siwe.verify` always
  refused. The server now falls back to viem's `verifyMessage` on Base. If it
  ever recurs, check the chain RPC is reachable (`BASE_RPC_URL`) - a down RPC
  makes smart-account sign-in fail with `chain_unavailable`.

- **Forged / impossible scores on the board, or "how do we stop fake runs"** →
  run tickets are built (`src/lib/runs.ts`). Every run gets a single-use ticket
  at launch; a submission claiming more run time than has really passed since
  its ticket is refused outright. A submission with NO ticket still ranks but
  lands in the review queue flagged `NO RUN TICKET`. Once the new client has
  been live a day or two (so no cached old client is still playing), set
  `REQUIRE_RUN_TICKET=1` in Vercel and redeploy to refuse unticketed runs.
  Tickets do not prove a score was earned - keep reviewing flagged runs before
  any USDC payout.

- **"Holder tiers are too cheap / too expensive" / token price moved a lot** →
  $RAIDSHOOTER holder tiers (Holder / Commander / Admiral) are whole-token
  minimums, default 1M / 50M / 500M. Set `RAIDSHOOTER_HOLDER_TIERS` in Vercel
  (e.g. `1000000,50000000,500000000`, three increasing numbers) and redeploy.
  Perks are cosmetic (board `$` badge + HOLDER trail) and read on-chain from
  the signed-in wallet (`src/lib/holder.ts`). The official contract address is
  a constant in `src/lib/token.ts`, deliberately not an env var.

- **"Let players pay with the token" / "$RAIDSHOOTER checkout isn't showing" /
  "token price moved, items are too cheap/expensive in tokens"** → built. Go to
  `/admin` → **Token** tab: set tokens per $1 (a "Use this rate" button fills
  in the live pool price as a reference), an optional pay-in-token discount
  (0-50%), and switch it on. Applies in ~30s, no redeploy; every change is in
  the Audit tab. `RAIDSHOOTER_TOKENS_PER_USD` in Vercel still works as a
  fallback until the tab is first saved (after that the tab wins). Needs the
  Armory live on Base mainnet (`NEXT_PUBLIC_BASE_NETWORK=base` + treasury).
  Prices never follow the pool automatically (`src/lib/tokenpay.ts`).

- **"Pay cup winners in the token" / "$RAIDSHOOTER prizes"** → built. In
  `/admin` → Rewards, each prize tier has a `$RAIDSHOOTER` per-wallet field
  next to USDC. "Create payout" makes a separate $RAIDSHOOTER batch (official
  contract, Base mainnet, 18 decimals) paid the same ways as USDC: "Pay from my
  wallet", Export for Disperse, or auto-send if `PAYOUT_PRIVATE_KEY` is set
  (that wallet must then hold the tokens). Never pay tokens per-run: scores
  are not proof of play, so bots would farm them - prizes go through the
  reviewed cup flow.

- **"Open DUELS to everyone" / "pause duels" / "who can create a duel"** →
  DUELS is built. `/admin` → Token → **DUELS · who can create one**: Holders
  only (default - signed-in wallets with a $RAIDSHOOTER tier), Everyone
  (guests too), or Off (no new duels; open ones can still finish). Applies in
  ~30s, audited. Anyone with a link (`/duel/CODE`) can ACCEPT. One run each,
  48h window, run tickets apply, and duel scores never touch the boards, cups
  or payouts. `DUELS_ACCESS` in Vercel is only the fallback before the switch
  is first used. The old early-access list (holders who claimed a place) is
  still in the Token tab with Copy wallets.

- **"The 3D hangar is slow / looks broken on my phone"** → each player can
  turn it off: System → **3D graphics: OFF** (flat bays, and the 3D code is
  never downloaded). Browsers without WebGL already get the flat bays. The
  in-run fight is always 2D.

- **"Ask the players" / "run a poll" / "what should we build next"** →
  `/admin` → Content → Pilot vote: question + 2-5 options, shows on the deck.
  One vote each; guests can repeat by clearing storage, so steer by the
  separate **holder** count. Close it to freeze, Remove to take it off the deck.

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
- Purely visual randomness in the engine (particles, explosions, text pops,
  sound variants, backdrops) uses `$.fxRandom()` / `$.fxRand(min, max)`, never
  `Math.random` / `$.util.rand`. During a Daily Run or a duel `Math.random`
  IS the seeded generator, and every cosmetic roll taken from it shifts the
  waves for that player. `tests/battle-upgrades.spec.ts` holds this.
- Art lives in `public/game/art.js` (pilot airframes `$.planeDraws`, the enemy
  fleet, boss art, banking, warp/launch/explosions/damage numbers) and
  `scenery.js` (sector hazards and far landmarks, incl. ION NEBULA, WRECK
  FIELD, PULSAR). The 3D models are `src/components/three/planeSpecs.ts` -
  keep a pilot's 2D airframe and 3D spec describing the same plane.
- Verify game changes with Playwright (`/opt/pw-browsers/chromium`) against
  `next start`; check TS with `npx tsc --noEmit` and `node --check` for the
  vanilla JS engine files.
