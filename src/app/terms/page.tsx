// Starting-point terms of service + tournament rules reflecting how the game
// actually works. This is a template, not legal advice - have it reviewed
// before relying on it, especially the prize/eligibility sections, and fill
// in the operator entity + contact details.

export const metadata = {
  title: 'Terms & Tournament Rules — Raid Shooter',
};

const UPDATED = 'July 2026';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-white/80">
      <h1 className="mb-1 text-2xl font-bold text-white">Terms of Service &amp; Tournament Rules</h1>
      <p className="mb-8 text-white/40">Last updated: {UPDATED}</p>

      <Section title="The game">
        <p>
          Raid Shooter is a free browser arcade game. Playing requires no account, no download,
          and no payment. By playing you agree to these terms.
        </p>
      </Section>

      <Section title="Cosmetics never affect gameplay">
        <p>
          Items sold in the marketplace (ship skins, engine trails, companion drones, and
          convenience unlocks) are <strong>cosmetic or convenience only</strong>. Nothing
          purchasable changes scoring, difficulty, or competitive balance, and runs that use a
          paid consumable are excluded from the ranked leaderboard. Purchases settle on the Base
          blockchain and are non-refundable once the transaction confirms, except where required
          by law.
        </p>
      </Section>

      <Section title="Leaderboard fair play">
        <ul className="list-disc space-y-1 pl-5">
          <li>Scores must come from real, unassisted play in an unmodified client.</li>
          <li>
            Automation, score injection, client tampering, or exploiting bugs is cheating. We may
            remove scores, disqualify runs, and ban players (including their wallet) at our sole
            discretion, with or without notice.
          </li>
          <li>Suspicious runs may be held for review before any prize is paid.</li>
        </ul>
      </Section>

      <Section title="Tournament rules">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Seasons.</strong> Tournaments (&quot;cups&quot;) run for a stated window. The
            in-game banner shows the active cup, its prizes, and the end time. Standings at the
            end time are final after review.
          </li>
          <li>
            <strong>Prizes.</strong> Prize tables are announced per cup (for example: USDC amounts
            and/or exclusive cosmetic items to top ranks). Cash prizes are paid in tokens on the
            Base network to the winner&apos;s connected wallet.
          </li>
          <li>
            <strong>A connected wallet is required to claim.</strong> Guest entries rank on the
            board, but prizes can only be delivered to a wallet. Connect a wallet before the cup
            ends to be payable; unclaimed or unpayable prizes may be forfeited after 14 days.
          </li>
          <li>
            <strong>Review before payout.</strong> Winning runs are reviewed for fair play. Runs
            deemed cheated are disqualified and the next rank moves up.
          </li>
          <li>
            <strong>One player, one entry.</strong> Multiple wallets or identities used to occupy
            several prize ranks may all be disqualified.
          </li>
          <li>
            <strong>Eligibility.</strong> Void where prohibited. Players are responsible for
            ensuring participation and prize receipt are lawful where they live, and for any
            taxes on prizes. No purchase is necessary to play or to win.
          </li>
          <li>
            <strong>Sponsors.</strong> Cups may be presented by a sponsor. Sponsors have no
            influence over gameplay, scoring, or moderation.
          </li>
        </ul>
      </Section>

      <Section title="Service">
        <p>
          The game is provided &quot;as is&quot; without warranties. We may change, suspend, or
          discontinue features (including tournaments) at any time. Our total liability for any
          claim is limited to the greater of $20 or the amount you paid us in the last 12 months.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms or a tournament result: use the in-game Feedback button or
          the community Telegram. See also our{' '}
          <a href="/privacy" className="text-cyan-300 underline">Privacy Policy</a>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
