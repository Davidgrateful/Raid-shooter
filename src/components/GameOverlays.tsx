'use client';

import { useEffect, useState } from 'react';

// Player-facing HTML overlays for operator content + feedback, shown only on
// the menu screen so they never intrude on gameplay:
//   - a dismissible NEWS banner showing the latest active announcement
//   - a Feedback button + modal that posts to /api/feedback
// Both read/write the same endpoints the admin console manages.

interface Announcement { id: string; title: string; body: string }

export function GameOverlays() {
  const [onMenu, setOnMenu] = useState(false);
  const [news, setNews] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false); // news expanded
  const [fbOpen, setFbOpen] = useState(false);
  const [fbText, setFbText] = useState('');
  const [fbSent, setFbSent] = useState(false);
  const [fbBusy, setFbBusy] = useState(false);

  useEffect(() => {
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => { if (d.announcements?.length) setNews(d.announcements[0]); })
      .catch(() => {});
    const onState = (e: Event) => setOnMenu((e as CustomEvent).detail === 'menu');
    window.addEventListener('raidshooter:state', onState as EventListener);
    return () => window.removeEventListener('raidshooter:state', onState as EventListener);
  }, []);

  async function sendFeedback() {
    if (fbText.trim().length < 2) return;
    setFbBusy(true);
    try {
      await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fbText }) });
      setFbSent(true);
      setFbText('');
      setTimeout(() => { setFbOpen(false); setFbSent(false); }, 1400);
    } finally { setFbBusy(false); }
  }

  if (!onMenu) return null;

  return (
    <>
      {/* news banner */}
      {news && !dismissed && (
        <div data-game-ui="" style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 45, maxWidth: '92vw' }}>
          <div className="flex items-center gap-3 rounded-full border border-cyan-400/30 bg-black/70 px-4 py-1.5 text-sm text-white/90 backdrop-blur-md">
            <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">News</span>
            <button onClick={() => setOpen(true)} className="max-w-[60vw] truncate font-medium hover:text-white">{news.title}</button>
            <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* news expanded modal */}
      {open && news && (
        <div data-game-ui="" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="flex items-center justify-center bg-black/60 p-6">
          <div onClick={(e) => e.stopPropagation()} className="max-w-md rounded-2xl border border-white/10 bg-[#0b0e16] p-6 text-white">
            <div className="text-lg font-bold text-cyan-300">{news.title}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{news.body}</p>
            <button onClick={() => setOpen(false)} className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Close</button>
          </div>
        </div>
      )}

      {/* feedback button */}
      <button data-game-ui="" onClick={() => setFbOpen(true)} style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 45 }}
        className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm hover:border-cyan-400/40 hover:text-white">
        ✉ Feedback
      </button>

      {/* feedback modal */}
      {fbOpen && (
        <div data-game-ui="" onClick={() => !fbBusy && setFbOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} className="flex items-center justify-center bg-black/60 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0e16] p-6 text-white">
            <div className="text-base font-semibold">Send feedback to the team</div>
            <p className="mt-1 text-xs text-white/40">Bugs, ideas, anything. We read every message.</p>
            {fbSent ? (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">Thanks — got it! 🙌</div>
            ) : (
              <>
                <textarea value={fbText} onChange={(e) => setFbText(e.target.value)} rows={4} maxLength={500} placeholder="Type your message…"
                  className="mt-3 w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-cyan-400/60" />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setFbOpen(false)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Cancel</button>
                  <button onClick={sendFeedback} disabled={fbBusy || fbText.trim().length < 2} className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-40">{fbBusy ? 'Sending…' : 'Send'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
