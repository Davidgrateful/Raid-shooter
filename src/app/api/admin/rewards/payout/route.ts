import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { getPayout, savePayout } from '@/lib/rewards';
import {
  buildDisperse,
  buildCsv,
  canAutoSend,
  sendBatch,
  tokenConfig,
  type PayoutRow,
} from '@/lib/payout';

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
    await audit({ actor: auth.identity.actor, action: 'payout.mark-sent', target: payout.id, detail: `${payout.totalUsd} ${payout.tokenSymbol}` });
    return NextResponse.json({ ok: true, payout });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
