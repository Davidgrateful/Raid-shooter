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
  wallets are requested in `src/components/wallet/WalletRuntime.tsx`, but `basic: false` means the
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

- **"The game is slow to open" / "wallet takes a second to appear"** → the
  wallet SDK (wagmi + AppKit, ~2.8 MB) loads on demand: when a player taps
  Connect Wallet / Sign In, a purchase starts, or - in the background after
  boot - for a returning signed-in or connected player. First load is ~1.3 MB
  of JS instead of ~4.5 MB. Nothing outside `src/components/wallet/` may
  import wagmi or `@reown/*`: read the wallet through `src/lib/walletStore.ts`
  (`useWallet()`, `wallet.connect()` / `ask()` / `signIn()`), or the SDK
  creeps back into every player's first load. `tests/wallet-lazy.spec.ts`
  holds this. `/admin` renders inside its own runtime (it needs wagmi hooks).

- **"Duel ghost isn't showing" / "can I race my rival"** → built. Each duel
  run uploads its path (`public/game/ghost.js`); the challenger gets the first
  pilot's ghost from `/api/duels/<id>/ghost` and races it as a RIVAL plane.
  Drawing only - a missing or bad ghost never affects the run or its score.
  Ghosts are kept as long as the duel (`src/lib/duelGhost.ts`).

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
  FIELD, PULSAR, MINEFIELD, METEOR SHOWER, CRYSTAL FIELD - ten sectors in
  `sectors.js`). The 3D models are `src/components/three/planeSpecs.ts` -
  keep a pilot's 2D airframe and 3D spec describing the same plane. How each
  pilot lands on the bay pad, idles and test-fires is
  `src/components/three/pilotMotion.ts` (one entry per pilot - a new pilot
  needs one; `tests/bay-and-board.spec.ts` checks every landing ends at
  rest). The bay is an open stage on a transparent canvas: do not give it
  walls or an opaque background again, that is what read as a pasted black box.
- The arena's objects (`public/game/objects.js`: rock, crate, fuel,
  satellite, ice, mine, crystal) are gameplay, not decor: solid to the plane,
  enemies and fire both ways, they pay score when the player breaks them, and
  fuel/mines explode. Each sector has its own mix (`$.sectorObjectMix`).
  Anything about them that rolls dice uses `$.objRandom()` - never
  `Math.random` (shifts a seeded raid's waves) and never `$.fxRandom` (differs
  between two duel pilots on one seed). Placement always rolls the same
  number of candidates so the stream stays in step wherever the plane is.
- Phones may hold a raid upright: there is no rotate prompt any more. The HUD
  drops its side columns under the touch buttons when upright, and the old
  canvas screens (how to play, stats, credits, daily run) lay out narrow via
  `$.narrowScreen()`. `tests/upright.spec.ts` and the upright rows in
  `tests/hud-matrix.spec.ts` hold it.
- Drones are 3D models (`src/components/three/droneModels.ts`): live in the
  hangar/Armory bay, and baked into the raid's sprite sheets with the arena
  objects (equipped drone first). In a raid each flies its own way, shows its
  effect (hex flash, chain arc, pierce streak, pull rings, heal motes, gold
  glint) and plays a combo move every 5th kill (BULWARK, STORM CROWN, STRAFE,
  COLLAPSE, BLOOM, CROWNED) - `public/game/drones.js`, fed by `$.droneEvent`
  hooks in hero/bullet/enemy/game.js. All of that is DRAWING: the effects'
  numbers live where they always did, a combo move never touches an enemy or
  the score, and every roll is `$.fxRandom`. Getting a drone plays an arrival
  (crate on the Armory pad after a purchase; drop-in beside the hull when
  equipped). Keep a drone's 2D drawing (3D off) and its model the same drone.
  Twelve drones: the first six, plus FROST SPRITE (hits chill 15 PCT for 1s),
  SALVAGE CRAB (power-ups drift in from 120px), EMBER MOTH (20 PCT burn over
  1.5s), MIRROR BAT (one enemy bolt per 8s glances off), DECOY GECKO (a 2s
  hologram every 12s that non-boss enemies chase) and SCOUT OWL (off-screen
  markers, drawing only). Their abilities ARE gameplay (`$.droneOnHit`,
  `$.droneChill`, `$.droneBurnTick`, `$.droneBlock`, `$.droneLure`,
  `$.droneMagnet` in drones.js) and run on frame counters - never dice, so a
  seeded raid stays the same raid. A new drone needs: a def in drones.js, a
  catalog entry in `src/lib/market.ts`, the leaderboard DRONE_IDS allowlist,
  and a model + tint in droneModels.ts. `tests/drones.spec.ts` holds it.
- Pilot + drone sync: a combo move is the drone's shape, glowing in the
  pilot's colour, with the pilot's own flourish on top (`$.pilotSync` and
  `droneFlourish` in drones.js: CHEVRONS, AFTERIMAGES, QUAKE, ... one per
  pilot; the hue is the pilot's bay test-fire hue in pilotMotion.ts). All 13 x
  12 pairs render differently - a test checks every pair. A new pilot needs a
  `$.pilotSync` entry and a flourish. In the hangar, equipping a drone (or a
  pilot being equipped with one riding along) plays the link-up: formation, a
  beam in the pilot's colour, then the pair's own 3D show - a 3D take on the
  drone's move plus the pilot's flourish (`src/components/three/syncShow.ts`,
  DRONE_MOVES x PILOT_TOUCH, pooled sprites/bars/rings, no allocation while
  it plays) - and a burst (`startLink` in bayScene.ts). A drone only rides
  with the EQUIPPED pilot, so browsing hulls plays nothing. A new pilot or
  drone needs an entry in both tables; tests/drones.spec.ts checks coverage.
- Pilot shot traits: each pilot's bullet type does one small thing in a fight
  (`$.shotTraits` at the top of `public/game/bullet.js`): HEAVY ROUND (every
  5th shot x1.5), LONG TRACER (+15 PCT speed/range), KNOCKBACK, SEEKER (darts
  curve toward an enemy within 150px), STAGGER (a hit stalls an enemy 10
  frames), WEAVE, TWIN FANGS (two shots at 60 PCT), PIERCE (+1 enemy), WIDE
  BEAM (+5px reach), GLITCH HIT (every 4th hit x2), SPLASH (25 PCT within
  40px), EMBER SPARK (a kill sparks 35 PCT onto the next enemy), RICOCHET
  (bounce once off the arena edge). Bosses ignore knockback and stagger. These
  ARE gameplay, kept as modest as drones, frame counters and geometry only -
  never dice. The hangar's Armament panel shows each pilot's trait. A new
  pilot needs a bullet kind with an entry there; `tests/shots.spec.ts` holds it.
- Achievements (`public/game/achievements.js`) are cosmetic and roll no dice;
  they show on the pilot screen's Record pane (`ServiceRecord.tsx`). Add a goal
  there with a title in the bitmap font's charset.
- The in-run fight stays 2D. A live 3D arena was prototyped and dropped by
  the owner; do not bring it back unasked. What IS 3D in a raid: the arena
  objects (and the hazard asteroids and meteors) are rendered from lit 3D
  models into sprite sheets once after boot
  (`src/components/three/objectSprites.ts`, mounted by `ArenaObjects3D.tsx`)
  and the 2D engine draws those (`$.objectSprites`). Spin is baked as views
  with the light held still. Off with System -> 3D graphics, or without
  WebGL: the flat shapes in `objects.js`. The bake fences `Math.random`
  (three's UUIDs) - `tests/objects-3d.spec.ts` holds that and the off switch.
- The in-game Shooterboard (`src/components/BoardOverlay.tsx`) lives in the
  command shell like the Hangar and Armory: header + rail (RANKINGS lit) +
  phone tab bar. Main lane = title/tabs, ONE podium (3D pedestals with each
  plate under its own pedestal - the plate row is 76% of a 2.2-aspect stage,
  see the CSS note), then the pack; ops lane = your standing. No floating
  footer over the rows, no animated backdrop (it cost a phone >1s a frame
  under the frosted bars). Your row pins to the list foot when off screen.
  `tests/board-layout.spec.ts` holds it.
- `/about` is the public "about the game" page (not how-to-play; that is in
  the game). Its pilot/drone/sector/boss names live in
  `src/app/about/content.ts` and `tests/about.spec.ts` checks them against the
  engine sources - a new pilot, drone or boss needs a line there and an image
  in `public/about/`. Reading pages (about, terms, privacy, cup, duel) scroll
  inside `<main className="rs-doc-page">`: the game locks the body, so a
  plain page past one screen cannot be scrolled.
- Verify game changes with Playwright (`/opt/pw-browsers/chromium`) against
  `next start`; check TS with `npx tsc --noEmit` and `node --check` for the
  vanilla JS engine files.
