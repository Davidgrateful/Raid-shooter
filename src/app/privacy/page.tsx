// Starting-point privacy policy reflecting what the app actually collects.
// This is a template, not legal advice - have it reviewed before relying on
// it for GDPR/CCPA compliance, and fill in the contact + entity details.

export const metadata = {
  title: 'Privacy Policy — Raid Shooter',
};

const UPDATED = 'June 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-white/80">
      <h1 className="mb-1 text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-8 text-white/40">
        Last updated: {UPDATED} · See also our{' '}
        <a href="/terms" className="text-cyan-300 underline">Terms &amp; Tournament Rules</a>
      </p>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Wallet address</strong> — only if you connect a wallet. Used to verify
            purchases and show a verified badge on the leaderboard.
          </li>
          <li>
            <strong>Anonymous guest id</strong> — a random identifier stored in a cookie so
            wallet-less players keep their leaderboard rank between visits.
          </li>
          <li>
            <strong>Gameplay data</strong> — scores, runs played, session length, pilot/drone
            choices, and a call sign you choose. No real name is required.
          </li>
          <li>
            <strong>Purchases</strong> — items bought and the on-chain transaction that paid
            for them. Payments settle on the Base blockchain, which is public by nature.
          </li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> collect emails, passwords, or payment-card details, and we
          do not run third-party advertising trackers.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use a single, essential, encrypted session cookie to keep you signed in and to hold
          your anonymous guest id. It is not used for advertising or cross-site tracking.
        </p>
      </Section>

      <Section title="Who we share data with">
        <p>We rely on a few service providers to run the game:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Hosting and serverless functions (our deployment platform).</li>
          <li>A managed Redis store for leaderboard, profile, and stats data.</li>
          <li>Wallet connection and the Base blockchain RPC, when you connect a wallet.</li>
        </ul>
        <p className="mt-2">We do not sell your data.</p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live (e.g. the EU under GDPR, or California under CCPA), you may
          have the right to access, correct, or delete your data, and to object to its processing.
          To make a request, contact us at the address below. We can remove a leaderboard entry
          and the gameplay data tied to your wallet or guest id on request.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          Leaderboard and gameplay data is kept while the game is live so rankings persist.
          Aggregated, non-identifying statistics may be kept longer. You can request deletion at
          any time.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions or data requests:{' '}
          <span className="text-cyan-300">[add your contact email]</span>.
        </p>
      </Section>

      <p className="mt-10 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300/90">
        Note for the operator: this is a starting template that reflects how the app currently
        works. Fill in the contact email and legal entity, and have it reviewed before launch.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
