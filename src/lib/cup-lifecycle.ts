// Cup lifecycle: the settlement that runs when a sponsored cup's window
// closes. Recording ALREADY stops the instant endsAt passes (the submit path
// gates on `now <= endsAt`), so this is the AFTER-the-buzzer work:
//   1. flip the season status draft/active -> 'ended' so the UI reads closed,
//   2. broadcast a "thanks for participating" line to global chat, and
//   3. drop a personal "thanks for playing" note into every ranked
//      participant's inbox.
// It's idempotent - guarded by season.endedNotified - so it can be triggered
// lazily from any read path (public season/leaderboard GETs) without a cron,
// and firing it twice concurrently at worst repeats a broadcast once.
//
// Kept OUT of rewards.ts to avoid an import cycle (cup.ts/chat.ts already
// import types from leaderboard.ts; rewards.ts is imported widely).

import { listSeasons, upsertSeason, type Season } from '@/lib/rewards';
import { getCupTop } from '@/lib/cup';
import { postMessage as postChatMessage } from '@/lib/chat';
import { sendToInbox } from '@/lib/inbox';

function defaultThanks(season: Season): string {
  return `${season.name} has ended - thanks to everyone who played! Winners are being settled now.`;
}

// Settle a single season that has passed its endsAt. Safe to call on any
// season; only acts on one that is past-due and not already settled.
async function settleSeason(season: Season): Promise<boolean> {
  const now = Date.now();
  const expired = !!season.endsAt && now > season.endsAt;
  if (!expired || season.endedNotified) return false;

  // 1. persist the ended state up front so a concurrent caller sees the guard
  const ended: Season = { ...season, status: 'ended', endedNotified: true };
  await upsertSeason(ended);

  const thanks = season.thanksMessage || defaultThanks(season);

  // 2. global chat shout-out (best-effort - never let messaging fail the flip)
  await postChatMessage({
    key: 'system',
    name: 'RAID SHOOTER',
    text: thanks,
    verified: true,
  }).catch(() => {});

  // 3. personal inbox note to each ranked participant (top 100 of the cup)
  try {
    const top = await getCupTop(season.id, 100);
    for (let i = 0; i < top.length; i++) {
      const entry = top[i];
      await sendToInbox(entry.address, {
        kind: 'cup',
        title: `${season.name} - thanks for playing!`,
        body:
          `You finished #${i + 1} in ${season.name}. ${thanks}` +
          (entry.address.startsWith('guest:')
            ? ' Connect a wallet to be eligible for prize payouts in future cups.'
            : ''),
        meta: { rank: i + 1 },
      }).catch(() => {});
    }
  } catch {
    // cup board unavailable - the status flip + chat shout already happened
  }

  return true;
}

// Lazily settle any expired-but-unsettled cups. Fire-and-forget friendly:
// callers can `void settleExpiredSeasons()` from a read path so it never
// slows the response. Returns how many were settled this call.
export async function settleExpiredSeasons(): Promise<number> {
  let settled = 0;
  try {
    const all = await listSeasons();
    for (const s of all) {
      if (await settleSeason(s)) settled++;
    }
  } catch {
    // season store unavailable - nothing to settle
  }
  return settled;
}
