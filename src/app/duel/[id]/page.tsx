import Link from 'next/link';
import type { Metadata } from 'next';
import { getDuel, isDuelId, viewOf, type DuelView } from '@/lib/duels';

/*
 * The page a duel link opens. Server-rendered so a link posted in Telegram,
 * Discord or X unfurls with who is challenging and the score to beat; the
 * button hands over to the game (/?duel=ID), which checks whether THIS player
 * may still fly it and starts the seeded raid.
 */

export const dynamic = 'force-dynamic';

async function load(id: string): Promise<DuelView | null> {
  const code = (id || '').toUpperCase();
  if (!isDuelId(code)) return null;
  const d = await getDuel(code);
  return d ? viewOf(d, null) : null;
}

function toBeat(v: DuelView): number | null {
  return v.entries.length ? Math.max(...v.entries.map((e) => e.score)) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const v = await load(id);
  if (!v) return { title: 'Duel not found — Raid Shooter' };
  const target = toBeat(v);
  const title = v.state === 'settled'
    ? `Duel ${v.id} is settled — Raid Shooter`
    : target !== null
      ? `${v.creator.name} challenges you: beat ${target.toLocaleString()} — Raid Shooter`
      : `${v.creator.name} challenges you to a duel — Raid Shooter`;
  return {
    title,
    description: 'Same raid, same waves. You each fly it once, and the higher score wins.',
    openGraph: { title, description: 'Same raid, same waves. You each fly it once, and the higher score wins.' },
  };
}

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await load(id);
  const target = v ? toBeat(v) : null;
  const hours = v ? Math.max(0, Math.ceil((v.expiresAt - Date.now()) / 3600_000)) : 0;
  const [a, b] = v ? [...v.entries].sort((x, y) => y.score - x.score) : [];

  return (
    <main className="rs-doc-page">
      <div className="relative min-h-screen overflow-x-hidden text-white" style={{ background: 'radial-gradient(900px 450px at 80% -10%, rgba(51,230,255,0.08), transparent 60%), #06070c' }}>
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-300">Raid Shooter · Duel {v?.id || ''}</div>

        {!v ? (
          <>
            <h1 className="text-3xl font-black tracking-tight">This duel does not exist.</h1>
            <p className="text-white/60">The link may be mistyped, or the duel ended more than a week ago.</p>
          </>
        ) : v.state === 'settled' && a && b ? (
          <>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              <span className="text-[color:#ffcf4d]">{a.score === b.score ? 'A dead heat' : `${a.name} won`}</span>
            </h1>
            <div className="grid grid-cols-2 gap-3">
              {[a, b].map((e, i) => (
                <div key={i} className="rounded-xl border p-4" style={{ borderColor: i === 0 && a.score !== b.score ? 'rgba(255,207,77,0.55)' : 'rgba(255,255,255,0.12)' }}>
                  <div className="truncate text-sm font-bold">{e.name}</div>
                  <div className="font-mono text-2xl font-black tabular-nums">{e.score.toLocaleString()}</div>
                  <div className="text-xs text-white/45">{e.pilot} · LV {e.level} · {e.kills.toLocaleString()} kills</div>
                </div>
              ))}
            </div>
            <p className="text-white/60">Same raid, same waves. Think you can do better? Start a duel of your own from the command deck.</p>
          </>
        ) : v.state === 'expired' ? (
          <>
            <h1 className="text-3xl font-black tracking-tight">This duel has expired.</h1>
            <p className="text-white/60">Duels stay open for 48 hours, and nobody took this one on in time.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {v.creator.name} challenges you
              {target !== null && <> to beat <span className="font-mono text-[color:#ffcf4d]">{target.toLocaleString()}</span></>}
            </h1>
            <p className="text-white/65">
              Same raid, same waves, same drops. You each fly it once, and the higher score wins. Open for another {hours} hour{hours === 1 ? '' : 's'}.
            </p>
            <Link
              href={`/?duel=${v.id}`}
              className="self-start rounded-lg bg-cyan-400 px-6 py-3 text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-cyan-300"
            >
              Fly this raid →
            </Link>
            <p className="text-xs text-white/35">Free to play in the browser. No wallet needed to accept a duel.</p>
          </>
        )}

        <Link href="/" className="text-xs text-white/40 underline hover:text-white/70">raidshooter.xyz</Link>
      </div>
    </div>
    </main>
  );
}
