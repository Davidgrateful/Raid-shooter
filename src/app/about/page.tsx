/* eslint-disable @next/next/no-img-element -- small static webp shots, sized in CSS */
import Link from 'next/link';
import type { Metadata } from 'next';
import s from './about.module.css';
import { PILOTS, DRONES, SECTORS, BOSSES, type PilotFact } from './content';

// Public "about the game" page: what Raid Shooter is, who flies it and what
// is in it - the link to share when someone asks. Not a how-to-play guide
// (that lives in the game). Static: every name comes from ./content.ts, which
// tests/about.spec.ts keeps in step with the engine.

export const metadata: Metadata = {
  title: 'About — Raid Shooter',
  description:
    'Raid Shooter is a free arcade raid shooter in your browser: 13 pilots, 12 drones, 10 sectors, 12 bosses, daily runs, duels and cups. Skill tops the board; cosmetics settle on Base.',
  openGraph: {
    title: 'About Raid Shooter',
    description: 'A free arcade raid shooter in your browser: 13 pilots, 12 drones, 10 sectors, 12 bosses.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Raid Shooter' }],
  },
};

const FACTS: [number, string][] = [
  [PILOTS.length, 'Pilots'],
  [DRONES.length, 'Drones'],
  [SECTORS.length, 'Sectors'],
  [BOSSES.length, 'Bosses'],
  [10, 'Achievements'],
];

function PilotCard({ p }: { p: PilotFact }) {
  return (
    <article className={s.card} data-pilot={p.id}>
      <img className={s.cardImg} src={`/about/pilot-${p.id}.webp`} alt={`${p.name} on the hangar pad`} width={480} height={360} loading="lazy" />
      <div className={s.cardBody}>
        <div className={s.cardName}>
          <span>{p.name}</span>
          {p.premium && <span className={s.tag}>PREMIUM</span>}
        </div>
        <div className={s.spec}>
          <span className={s.specLabel}>ABILITY</span>
          <span className={`${s.specVal} ${s.ability}`}>{p.ability}</span>
          <span className={s.specText}>{p.abilityText}</span>
        </div>
        <div className={s.spec}>
          <span className={s.specLabel}>SHOT</span>
          <span className={`${s.specVal} ${s.shot}`}>{p.shot}</span>
          <span className={s.specText}>{p.shotText}</span>
        </div>
      </div>
    </article>
  );
}

export default function AboutPage() {
  return (
    <main className={`rs-doc-page ${s.page}`}>
      <div className={s.wrap}>
        <nav className={s.bar} aria-label="Site">
          <Link href="/" className={s.brand}>RAID SHOOTER</Link>
          <div className={s.barLinks}>
            <Link href="/leaderboard">Shooterboard</Link>
            <Link href="/cup">Cup</Link>
            <Link href="/">Play</Link>
          </div>
        </nav>

        <header className={s.hero}>
          <img className={s.heroImg} src="/about/raid-boss.webp" alt="A pilot fighting the Asteroid King across a pulsar beam" width={1140} height={607} />
          <div className={s.heroShade} />
          <div className={s.heroBody}>
            <div className={s.kicker}>About the game</div>
            <h1 className={s.title}>RAID SHOOTER</h1>
            <p className={s.lede}>
              A free arcade raid shooter that runs in your browser, on a laptop or a phone, with nothing to install.
              Pick a pilot, fly into a sector full of enemy fleets, draft upgrades between levels and see how deep
              the raid goes before your hull gives out.
            </p>
            <div className={s.ctaRow}>
              <Link href="/" className={s.cta}>Play free</Link>
              <Link href="/leaderboard" className={s.ctaGhost}>See the Shooterboard</Link>
            </div>
          </div>
        </header>

        <div className={s.facts} aria-label="The game in numbers">
          {FACTS.map(([n, label]) => (
            <div key={label} className={s.fact}>
              <span className={s.factNum}>{n}</span>
              <span className={s.factLabel}>{label}</span>
            </div>
          ))}
        </div>

        <section className={s.section} aria-labelledby="about-raid">
          <div className={s.secHead}>
            <div className={s.secNo}>01 / THE RAID</div>
            <h2 id="about-raid" className={s.h2}>One run, as deep as you can take it</h2>
            <p className={s.p}>
              A raid has no fixed end. Waves come faster and harder, and the only question is how far in you get.
              Every run is built a little differently from the last, because of the upgrades you choose along the way.
            </p>
          </div>
          <div className={s.loop}>
            <div className={s.beat}>
              <div className={s.beatTitle}>FIGHT</div>
              <div className={s.beatText}>Enemy fleets pour in from every side. Chain kills quickly to build a combo for bigger scores.</div>
            </div>
            <div className={s.beat}>
              <div className={s.beatTitle}>REFIT</div>
              <div className={s.beatText}>Clearing a level patches your hull and opens a draft. Pick one upgrade: rapid fire, multi shot, pierce, thrusters and more.</div>
            </div>
            <div className={s.beat}>
              <div className={s.beatTitle}>BOSS</div>
              <div className={s.beatText}>A boss guards every fifth level. Bring it down and you get a second pick from the draft.</div>
            </div>
            <div className={s.beat}>
              <div className={s.beatTitle}>WARP</div>
              <div className={s.beatText}>Then the raid warps into the next sector: new hazards, new scenery and new music.</div>
            </div>
          </div>
          <p className={s.p}>
            The arena is not empty space. <strong>Rocks, crates, fuel tanks, satellites, ice, mines and crystals</strong> are
            solid. They block fire in both directions and pay out score when you break them. Fuel tanks and mines blow up,
            catching anything that sits too close.
          </p>
        </section>

        <section className={s.section} aria-labelledby="about-pilots">
          <div className={s.secHead}>
            <div className={s.secNo}>02 / PILOTS</div>
            <h2 id="about-pilots" className={s.h2}>Thirteen pilots, thirteen ways to fly</h2>
            <p className={s.p}>
              Every pilot flies a different airframe. Each one has an <strong className={s.ability}>ability</strong> that
              changes how a run goes, and a <strong className={s.shot}>shot</strong> that behaves in its own way: some seek,
              some splash, some bounce off the walls. ONYIX is free from the first run. Pilots level up as they fly, and
              every level trims a little of the damage they take.
            </p>
          </div>
          <div className={`${s.pilots} ${s.pilotsStd}`}>
            {PILOTS.filter((p) => !p.premium).map((p) => <PilotCard key={p.id} p={p} />)}
          </div>
          <div className={s.subhead}>PREMIUM PILOTS</div>
          <div className={`${s.pilots} ${s.pilotsPrem}`}>
            {PILOTS.filter((p) => p.premium).map((p) => <PilotCard key={p.id} p={p} />)}
          </div>
        </section>

        <section className={s.section} aria-labelledby="about-drones">
          <div className={s.secHead}>
            <div className={s.secNo}>03 / DRONES</div>
            <h2 id="about-drones" className={s.h2}>A wingman that flies its own way</h2>
            <p className={s.p}>
              A drone rides alongside your plane and lends it one small, steady edge. It also earns your pilot
              10 to 25% more XP. On every fifth kill in a combo, the drone and pilot pull off a{' '}
              <strong className={s.combo}>combo move</strong>{' '}together: the drone&apos;s own shape, glowing in your
              pilot&apos;s colour. All 156 pilot and drone pairings look different, in the raid and in the 3D hangar.
            </p>
          </div>
          <div className={s.drones}>
            {DRONES.map((d) => (
              <article key={d.id} className={s.card} data-drone={d.id}>
                <img className={s.droneImg} src={`/about/drone-${d.id}.webp`} alt={`The ${d.name} drone model`} width={320} height={227} loading="lazy" />
                <div className={s.cardBody}>
                  <div className={s.cardName}>
                    <span>{d.name}</span>
                    {d.reward && <span className={s.tag}>WON</span>}
                  </div>
                  <span className={s.specText}>{d.does}</span>
                  <div className={s.spec}>
                    <span className={s.specLabel}>COMBO MOVE</span>
                    <span className={`${s.specVal} ${s.combo}`}>{d.combo}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={s.section} aria-labelledby="about-sectors">
          <div className={s.secHead}>
            <div className={s.secNo}>04 / SECTORS AND BOSSES</div>
            <h2 id="about-sectors" className={s.h2}>Ten sectors, each with its own danger</h2>
            <p className={s.p}>
              The raid moves to a new sector every five levels. Each sector has its own hazard, its own mix of arena
              objects and its own far-off landmark on the horizon. After the tenth sector, the loop starts again from the
              first.
            </p>
          </div>
          <div className={s.split}>
            <ol className={s.sectorList}>
              {SECTORS.map((x, i) => (
                <li key={x.name} className={s.sectorRow}>
                  <span className={s.sectorNo}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={s.sectorName}>{x.name}</span>
                  <span className={s.sectorHazard}>{x.hazard}</span>
                </li>
              ))}
            </ol>
            <aside className={s.bossBox} aria-label="Bosses">
              <div className={s.bossLabel}>WARNING: BOSSES</div>
              <div className={s.bossGrid}>
                {BOSSES.map((b) => <span key={b}>{b}</span>)}
              </div>
              <p className={s.bossNote}>
                Six roaming bosses can appear in any sector. Six more each guard a home sector of their own and are made
                from what that sector is made of: lightning, scrap, pulsar beams, mines, comets and crystal.
              </p>
            </aside>
          </div>
        </section>

        <section className={s.section} aria-labelledby="about-modes">
          <div className={s.secHead}>
            <div className={s.secNo}>05 / WAYS TO PLAY</div>
            <h2 id="about-modes" className={s.h2}>Score alone, race a rival, or play for prizes</h2>
          </div>
          <div className={s.modes}>
            <div className={s.mode}>
              <div className={s.modeName}>SHOOTERBOARD</div>
              <p className={s.modeText}>The endless raid and the main leaderboard. Every score on it was flown, not bought. Each entry shows the pilot, drone and finish that set it.</p>
              <Link href="/leaderboard" className={s.modeLink}>Open the Shooterboard →</Link>
            </div>
            <div className={s.mode}>
              <div className={s.modeName}>DAILY RUN</div>
              <p className={s.modeText}>One attempt a day, and every pilot meets the same waves, so skill and pilot choice decide it, not luck. It has its own board, which resets every day. There is a rotating daily goal for bonus XP too.</p>
            </div>
            <div className={s.mode}>
              <div className={s.modeName}>DUELS</div>
              <p className={s.modeText}>Challenge someone with a link. You both fly the same seeded raid, one run each, within 48 hours. The challenger races the first pilot&apos;s ghost plane as a rival on screen.</p>
            </div>
            <div className={s.mode}>
              <div className={s.modeName}>CUPS</div>
              <p className={s.modeText}>Timed tournaments with prize tiers paid in USDC or $RAIDSHOOTER. Winning runs are reviewed before anyone is paid.</p>
              <Link href="/cup" className={s.modeLink}>See the current cup →</Link>
            </div>
          </div>
        </section>

        <section className={s.section} aria-labelledby="about-hangar">
          <div className={s.secHead}>
            <div className={s.secNo}>06 / HANGAR AND ARMORY</div>
            <h2 id="about-hangar" className={s.h2}>Your plane, on the pad, in 3D</h2>
          </div>
          <div className={s.hangar}>
            <img className={s.hangarImg} src="/about/hangar-bay.webp" alt="Tank Rex and the Decoy Gecko drone linking up on the 3D hangar pad" width={640} height={480} loading="lazy" />
            <ul className={s.list}>
              <li><span>In the <strong>3D hangar</strong>, every pilot lands on the bay pad, idles and test-fires its shot. Equip a drone and the pair link up with their own show.</span></li>
              <li><span>The <strong>Armory</strong> sells pilots, drones, hull finishes, engine trails and field kits. Payment settles on <strong>Base</strong>, and every purchase is tied to your wallet.</span></li>
              <li><span><strong>Field kits</strong> (health, shield, revive, XP boost) are used up during a run. A run that used one is marked as assisted.</span></li>
              <li><span>Holders of <strong>$RAIDSHOOTER</strong> rank as Holder, Commander or Admiral. Each tier brings a badge on the board and cosmetics of its own. Some items, like the Champion trail and crest, cannot be bought, only won.</span></li>
              <li><span>Want it lighter? Turn 3D graphics off under System. The raid itself is 2D either way.</span></li>
            </ul>
          </div>
        </section>

        <section className={s.section} aria-labelledby="about-fair">
          <div className={s.secHead}>
            <div className={s.secNo}>07 / FAIR PLAY</div>
            <h2 id="about-fair" className={s.h2}>What money can and cannot do</h2>
            <p className={s.p}>
              We keep the line between looks and gameplay in plain view. Anything that changes a fight is kept modest,
              and anything that could buy a score is flagged.
            </p>
          </div>
          <div className={s.ledger}>
            <div className={s.ledgerCol}>
              <div className={s.ledgerHead} style={{ color: 'var(--rs-green)' }}>LOOKS ONLY</div>
              <div className={s.ledgerItem}><strong>Hull finishes and engine trails</strong> never touch a run.</div>
              <div className={s.ledgerItem}><strong>Holder perks</strong> are a board badge and cosmetics.</div>
              <div className={s.ledgerItem}><strong>Achievements</strong> are a record of what you have done, nothing more.</div>
            </div>
            <div className={s.ledgerCol}>
              <div className={s.ledgerHead} style={{ color: 'var(--rs-gold)' }}>CHANGES A FIGHT</div>
              <div className={s.ledgerItem}><strong>Pilots</strong> fly differently: speed, armour, ability and shot.</div>
              <div className={s.ledgerItem}><strong>Drones</strong> give one modest passive edge each.</div>
              <div className={s.ledgerItem}><strong>Field kits</strong> are spent during a run, and those runs are marked as assisted.</div>
            </div>
          </div>
          <p className={s.p}>
            Every raid gets a single-use ticket when it launches. A score claiming more flight time than has really passed
            is refused, and anything unusual is sent for review before a prize is paid.
          </p>
        </section>

        <div className={s.closer}>
          <h2 className={s.closerTitle}>The hangar is open.</h2>
          <div className={s.ctaRow}>
            <Link href="/" className={s.cta}>Play free</Link>
            <Link href="/cup" className={s.ctaGhost}>Current cup</Link>
          </div>
        </div>

        <footer className={s.foot}>
          <span>Raid Shooter · free arcade raids on Base</span>
          <span className={s.footLinks}>
            <Link href="/leaderboard">Shooterboard</Link>
            <Link href="/cup">Cup</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
