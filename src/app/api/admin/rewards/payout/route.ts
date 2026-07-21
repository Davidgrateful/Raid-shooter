import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getPayout, savePayout, getSeason } from '@/lib/rewards';
import { sendToInbox } from '@/lib/inbox';
import type { PayoutBatch } from '@/lib/rewards';
import {
  buildDisperse,
  buildCsv,
  canAutoSend,
  sendBatch,
  tokenConfig,
  type PayoutRow,
} from '@/lib/payout';

// Drop a "you've been paid" note into each paid winner's inbox. Best-effort:
// a messaging failure must never make a real payout look unsent.
async function notifyPaidWinners(payout: PayoutBatch): Promise<void> {
  let cupName = 'the cup';
  try {
    const season = await getSeason(payout.seasonId);
    if (season?.name) cupName = season.name;
  } catch {
    /* fall back to the generic name */
  }
  for (const row of payout.rows) {
    if (!row.paid || !row.usd) continue;
    await sendToInbox(row.address, {
      kind: 'payout',
      title: `You've been paid ${row.usd} ${payout.tokenSymbol}!`,
      body:
        `Your #${row.rank} finish in ${cupName} has been paid: ${row.usd} ${payout.tokenSymbol} ` +
        `sent to your wallet on ${payout.network}.` +
        (row.txHash ? ' Tap to view the transaction.' : ''),
      meta: { txHash: row.txHash, amountUsd: row.usd, rank: row.rank },
    }).catch(() => {});
  }
}

// Admin: act on a created payout batch.
//   action: "export"  -> returns Disperse batch + CSV to sign from your own
//                        wallet (the safe default, no server key needed)
//   action: "send"    -> auto-sends via the server signer (ONLY if
//                        PAYOUT_PRIVATE_KEY is configured AND confirm:true)
//   action: "mark-sent" -> manually record the round as paid after you sent
//                        it yourself (optionally with a txHash note)
export async function POST(req: NextRequest) {
  const auth = await adminAuth(req, 'payouts.send');
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | { payoutId?: string; action?: string; confirm?: boolean; txHash?: string }
    | null;
  const payout = body?.payoutId ? await getPayout(body.payoutId) : null;
  if (!payout) {
    return NextResponse.json({ error: 'Unknown payoutId' }, { status: 400 });
  }

  const token = tokenConfig();
  const rows: PayoutRow[] = payout.rows
    .filter((r) => r.usd && r.usd > 0)
    .map((r) => ({ address: r.address, amountUsd: r.usd as number }));

  if (body?.action === 'export') {
    payout.status = payout.status === 'sent' ? 'sent' : 'exported';
    await savePayout(payout);
    await audit({ actor: auth.identity.actor, action: 'payout.export', target: payout.id });
    return NextResponse.json({
      ok: true,
      payout,
      export: {
        token,
        disperse: buildDisperse(rows, token),
        csv: buildCsv(rows),
      },
    });
  }

  if (body?.action === 'send') {
    if (!canAutoSend()) {
      return NextResponse.json(
        { error: 'Automated payouts are not configured. Set PAYOUT_PRIVATE_KEY, or use Export to sign from your own wallet.' },
        { status: 400 }
      );
    }
    if (!body?.confirm) {
      return NextResponse.json({ error: 'confirm:true is required to move real funds.' }, { status: 400 });
    }
    const result = await sendBatch(rows);
    // write tx hashes back onto the batch
    for (const t of result.txHashes) {
      const row = payout.rows.find((r) => r.address.toLowerCase() === t.address.toLowerCase());
      if (row) {
        row.paid = !!t.txHash;
        row.txHash = t.txHash;
        if (t.error) row.note = t.error;
      }
    }
    payout.status = result.ok ? 'sent' : payout.status;
    await savePayout(payout);
    await notifyPaidWinners(payout);
    await audit({ actor: auth.identity.actor, action: 'payout.send', target: payout.id, detail: `${payout.totalUsd} ${payout.tokenSymbol} to ${rows.length}` });
    return NextResponse.json({ ok: result.ok, payout, result });
  }

  if (body?.action === 'mark-sent') {
    payout.status = 'sent';
    for (const row of payout.rows) {
      row.paid = true;
      if (body?.txHash) row.txHash = body.txHash;
    }
    await savePayout(payout);
    await notifyPaidWinners(payout);
    await audit({ actor: auth.identity.actor, action: 'payout.mark-sent', target: payout.id, detail: `${payout.totalUsd} ${payout.tokenSymbol}` });
    return NextResponse.json({ ok: true, payout });
  }

  // record-onchain: the operator paid from their OWN connected wallet in the
  // browser (client-side USDC transfers). We didn't send anything server-side
  // - we just record the per-recipient tx hashes they got back, mark those
  // rows paid, and notify those winners. A recipient with no hash stays
  // unpaid so a partial run can be finished later.
  if (body?.action === 'record-onchain') {
    const results = Array.isArray((body as { results?: unknown }).results)
      ? ((body as { results: { address?: string; txHash?: string }[] }).results)
      : [];
    const byAddr = new Map<string, string>();
    for (const r of results) {
      if (typeof r?.address === 'string' && typeof r?.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(r.txHash)) {
        byAddr.set(r.address.toLowerCase(), r.txHash);
      }
    }
    let paidCount = 0;
    for (const row of payout.rows) {
      const hash = byAddr.get(row.address.toLowerCase());
      if (hash) {
        row.paid = true;
        row.txHash = hash;
        paidCount++;
      }
    }
    payout.status = payout.rows.every((r) => r.paid) ? 'sent' : payout.status;
    await savePayout(payout);
    await notifyPaidWinners(payout);
    await audit({ actor: auth.identity.actor, action: 'payout.onchain', target: payout.id, detail: `${paidCount} paid from operator wallet` });
    return NextResponse.json({ ok: true, payout, paidCount });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
