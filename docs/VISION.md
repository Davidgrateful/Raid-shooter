# Raid Shooter — Vision

*Written down so it stays the north star as the game grows, not just something
in your head.*

---

## The one-line version

**A browser arcade shooter where skill decides who wins, and money only ever
buys the right to look good doing it.**

## The problem with everything else

Most "web3 games" ship the crypto first and the game second — the wallet is
the point, the gameplay is an excuse for it to exist. Most free-to-play games
do the opposite trade: the gameplay is real, but so is pay-to-win, buried
under XP boosts and "convenience" items that quietly decide who tops the
board.

Raid Shooter refuses both trades. It's a real, fast, skill-first arcade
shooter first. The wallet, the marketplace, the leaderboard economy — all of
it sits on top of that, never in front of it.

## The non-negotiable principle

**Cosmetics never touch a live run or a score. Ever.**

Every feature this game ships gets checked against that line before it
ships. A skin, a trail, a drone silhouette, a pilot glyph on the
leaderboard — all of it is about being *seen*, never about being
*stronger*. The day that stops being true is the day the leaderboard stops
meaning anything, and the leaderboard meaning something is the entire
product.

This is why:
- Consumables (health/shield/revive) are marked **assisted** and excluded
  from tournament-payout trust, even though they still rank — a bounded
  comeback aid, never a score multiplier.
- Enemy AI reads the equipped *pilot ability*, not the equipped *cosmetics* —
  a $50 skin never makes the game easier.
- Every purchase is sanitized server-side against an allowlist before it can
  render on anyone else's screen. A forged payload can never inject a fake
  advantage into someone else's view of the board.

## Who this is for

Not crypto natives looking for another token to flip. **Gamers first** —
people who want a genuinely fun, fast, free arcade shooter, who happen to
also get a real economy layered on top if they want it: a marketplace that
settles on Base, a leaderboard with actual prize pools, sponsorships that
fund real payouts. If someone never connects a wallet, they should still
have a complete, fair, fun game. The wallet is an upgrade path, never an
admission ticket.

## What "alive" means here

A leaderboard is just a spreadsheet unless the people on it can see each
other. That's the thread connecting the last stretch of work:

- **The top 20 talk to each other** — live chat, tagging, pilot glyphs next
  to every name, so the board has faces on it, not just numbers.
- **The board reacts to you in real time** — a new personal best gets
  announced the moment it lands, a purchase gets flexed the moment someone
  equips it. The game notices what you did.
- **Enemies study you back** — adaptive AI that reads your pilot's ability
  and current fight and weighted-randomly counters it. The game is paying
  attention too, not just running a script.
- **Coming back matters** — streaks, weekly gifts, a starter pack — small,
  repeatable reasons to open the tab again tomorrow that cost nothing to
  earn.

None of this is decoration. A leaderboard nobody talks about is a stat page.
A leaderboard people flex on, argue in, and check obsessively is a
community.

## The economic model, plainly

- **Free to play, fully.** No feature, level, or boss is locked behind
  payment. The entire game is completable and competitive at $0.
- **Cosmetics fund the game.** Skins, trails, pilots, drones — all optional,
  all visible, all cheap enough that the first purchase is an easy yes.
- **Sponsors fund the stakes.** Cup tournaments with real prize pools,
  presented by real partners, paid in real USDC/tokens to real winners.
- **The house never touches the scoreboard.** No feature that generates
  revenue is allowed to also generate rank. That wall is what makes every
  other part of this trustworthy.

## What "winning" looks like from here

Not a token price. Not a headline user count for its own sake. Winning
looks like:

- A player who's never touched crypto plays for free, has a genuinely good
  time, and eventually buys a skin because they *want* to be seen wearing
  it — not because they had to.
- A top-20 regular who logs in as much for the chat and the rivalry as for
  the run itself.
- A sponsor who funds a Cup because their community actually shows up and
  plays, not because they were sold a banner ad.
- A leaderboard where the #1 spot means something, because everyone
  watching knows it was earned, not bought.

Everything built from here should be checked against this document, not
just against "does it work." If a feature makes the game more fun, more
alive, or more trustworthy — it's on-vision. If it makes money at the cost
of any of those, it isn't, no matter how much it makes.
