# Raid Shooter — Roadmap

**Status:** Live at raidshooter.xyz. This doc is the working reference for what's
shipped, what's in front of us, and the open decisions that need an owner.
Update it as things move — it should always reflect reality, not intentions.

Last updated: 2026-07-08

---

## 0. How to read this doc

- **Shipped** = merged to `main`, deployed, and live for players today.
- **Now** = actively being worked or next up, roughly in priority order.
- **Next** = agreed direction, not yet started.
- **Later / Ideas** = worth doing, not committed, needs more thought or data first.
- Every item under Now/Next should end up with an owner's name next to it before
  work starts. Nothing here is a promise to players until it's shipped.

---

## 1. Where we are (shipped)

**Core game**
- Vanilla JS canvas engine, 12 pilots (1 free starter + 11 purchase-only),
  6 combat drones, 20 regular enemy types + 6 bosses (3 cosmic, 3 alien —
  Plasma Medusa, Hive Queen, Xeno Monarch), random boss rotation per wave.
- Game feel pass: hitstop on big kills, low-HP danger vignette + heartbeat,
  off-screen hunter arrows.
- iPhone/Android performance fixes (transform-based parallax, Web Audio,
  DPR caps) — the "shooting lags" issue is resolved.

**Leaderboards & competition**
- All-time Shooterboard, weekly ladder (resets Monday), sponsored Cup
  (time-boxed tournament board), Daily Run (one seeded attempt/day).
- Durable guest identity (survives cookie loss / iOS Safari ITP) so
  guest scores and names stick without a wallet.
- Manual refresh + live auto-refresh indicator on every board.
- Fixed a bug where legitimate high scores were silently rejected by
  overly tight validation caps.
- Boosted/assisted runs (drones, XP boost, consumables) now count on the
  board — tuned so paid help is a bounded aid, not a score multiplier.

**Monetization**
- Cosmetics + pilots marketplace on Base (wallet checkout via Reown/SIWE).
  Every non-free pilot is now purchase-only (buy-to-fly) — no more
  grinding around the store.
- Consumables (health/shield/revive/XP boost), sponsor system with an
  admin-managed slot.

**Admin / ops**
- `/admin` Mission Control: KPI tiles, player table (moderate/derank/ban),
  cross-board moderation (a derank now clears all-time + every cup +
  weekly, not just one board), a Restore/Re-add safety net for
  accidental removals, flagged-run review queue, feedback + announcements,
  sponsor + rewards management.
- Bot defense (Cloudflare Turnstile, gated behind env vars).

**What's NOT live yet** — merged to `main` but waiting on your next
Vercel deploy (check before assuming any of the above is actually in
front of players):
- Everything from this session (bosses, hangar redesign, admin restore
  tooling, buy-to-fly pilots) needs a deploy to go live.
- iPhone wallet connect needs `raidshooter.xyz` re-added in the Reown
  dashboard — that's config, not code, and only the account owner can do it.

---

## 2. Now (next 2–4 weeks)

Ordered roughly by impact. Pick owners before starting.

1. **Deploy & verify.** Push the current `main` live, redo the operator
   env-var checklist (SESSION_SECRET, KV_REST_API_*, REOWN project ID +
   allowed domains, TURNSTILE keys). Nothing else on this list matters
   if the last month of work isn't actually in front of players.
2. **Roguelite level-up drafting.** Pick 1-of-3 temporary buffs on every
   level clear. This is the single biggest retention lever we haven't
   built yet — everything else is polish by comparison. (The How-To
   screen already advertises "draft upgrades each wave" — either this
   ships or that copy comes out.)
3. **Finish the alien boss set.** 3 of 6 drafted bosses are live
   (Plasma Medusa, Hive Queen, Xeno Monarch). Build the remaining 3
   (Ocular Drifter's laser beam, Void Leviathan's tentacle hazard,
   Carrion Bloom's petal-shield) — each needs a small new hazard
   subsystem, not just a reskin.
4. **Social growth loop.** Auto-generated shareable score card (one-tap
   share to X with score + rank baked into an image) — highest
   organic-reach-per-effort feature we scoped and haven't built.
   Post-run "follow to enter the cup" modal ties directly into sponsor
   revenue.
5. **Watch the buy-to-fly change.** We just made every non-starter pilot
   purchase-only. Track day-1/day-7 retention and free-to-paid
   conversion closely for two weeks — if new-player retention drops,
   the cheap fix is reinstating 1-2 pilots as free grind-unlocks.

## 3. Next (this quarter)

- **Combo + music juice.** Milestone flash/sound at ×8 cap, screen tint
  that escalates with combo, music intensity tied to combo/boss state.
- **First-run micro-tutorial.** 2-3 fading on-screen hints (move / dash /
  combo matters) instead of relying on the static How-To screen.
- **Powerup variety audit.** Confirm the current pickup table still feels
  varied against the new enemy/boss roster; add if it's gone stale.
- **Referral leaderboard.** A board of top recruiters — turns growth
  itself into a competitive loop, reuses the referral system already built.
- **TG / Discord presence.** Persistent social footer in the menu +
  admin-editable event/announcement ribbon (admin announcements tool
  already exists — this is just surfacing it in-game).

## 4. Later / Ideas (not committed)

- Verified-follow via X OAuth (real verification + real reward, needs API keys).
- Telegram mini-app version (big reach, big build — separate project really).
- Ghost replays on the leaderboard (watch a top run play back).
- Ocular Drifter / Void Leviathan / Carrion Bloom if not done in "Now" (see #3).
- Ranked seasons beyond the sponsored Cup format (a rotating always-on ladder).

---

## 5. Financing: token launch

Flagged as a real workstream, not a checkbox — a token is a fundraising and
legal decision as much as a product one, and needs an owner outside
engineering before any code gets written.

**Open questions to resolve before building anything:**
- **Purpose.** Is this a fundraising token (sold to raise capital) or a
  utility/rewards token (earned through play, spent in the existing Base
  marketplace)? These have very different legal exposure and different
  builds. Cosmetics-only marketplace rule (`CLAUDE.md`: "the marketplace
  must NEVER affect a live run or score") should extend to any token
  utility too — a token that buys competitive advantage undermines the
  leaderboard's credibility the same way a pay-to-win item would.
- **Regulatory.** Needs actual legal review (securities analysis, target
  jurisdictions, KYC/AML if there's a public sale) before a contract goes
  out. This is not something to backsolve after launch.
- **Tokenomics.** Supply, allocation (team/treasury/community/liquidity),
  vesting, and — critically — where the treasury address lives. The
  existing marketplace already has a treasury wallet on Base; decide
  whether the token reuses that infra or stands up its own.
- **Mechanism.** Public sale vs. LBP vs. airdrop-to-players (rewards
  existing Shooterboard/Cup ranks, which builds naturally on data we
  already have) vs. some mix.
- **Integration surface, once scope is defined:** wallet connect (Reown/
  SIWE) already exists and would extend cleanly; a claim page; on-chain
  treasury reporting alongside the existing `/api/market/diag`-style
  transparency the game already does for cosmetics revenue.

**Recommended next step:** a short internal memo (non-engineering) settling
purpose + regulatory posture before any technical scoping starts. Once
that's answered, this becomes a real, sized roadmap item instead of a
placeholder.

---

## 6. Known issues / operator checklist

Pulled from `CLAUDE.md` — reminders for whoever's watching the operator
inbox, since these have ready-made fixes already built:

| Symptom | Cause | Fix |
|---|---|---|
| Bot spam / fake leaderboard entries | Turnstile not switched on | Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, redeploy |
| "My purchase disappeared" | KV not connected → profiles fall back to memory | Check `/api/market/diag` → `profilesPersistent`; set `KV_REST_API_URL`/`TOKEN` |
| Leaderboard resets / players can't see each other | Same root cause as above | Check `/api/leaderboard/diag` → `persistent` |
| Anyone can fake a sign-in | `SESSION_SECRET` not set in prod | Set a 32+ char random string |
| Wallet won't connect (esp. iPhone) | `NEXT_PUBLIC_REOWN_PROJECT_ID` missing, or domain not allow-listed in the Reown dashboard | Get a project ID at cloud.reown.com, add `raidshooter.xyz` to allowed domains |

---

## 7. Working agreements

- The marketplace (and any future token) never affects a live run or
  score — cosmetics/rewards only. This is the credibility of the
  leaderboard; don't trade it for revenue.
- Diagnostic endpoints return booleans/previews only, never secrets or
  the treasury address.
- Gated features degrade gracefully — missing env key means silent
  no-op, never a broken screen.
- Ship to `main`, verify with a real deploy + Playwright pass on
  mobile and desktop before calling something "done."
