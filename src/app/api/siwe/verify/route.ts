import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { getSession } from '@/lib/session';
import { mergeGuestIntoWallet } from '@/lib/leaderboard';
import { mergeGuestProfileIntoWallet } from '@/lib/profile';

export async function POST(req: NextRequest) {
  try {
    const { message, signature, guestToken } = await req.json();
    const session = await getSession();

    const siweMessage = new SiweMessage(message);
    const { data: fields } = await siweMessage.verify({ signature });

    // Verify nonce matches session
    if (fields.nonce !== session.nonce) {
      return NextResponse.json({ ok: false, error: 'Invalid nonce' }, { status: 422 });
    }

    // Verify domain matches
    const expectedDomain = req.headers.get('host') || '';
    if (fields.domain !== expectedDomain) {
      return NextResponse.json({ ok: false, error: 'Domain mismatch' }, { status: 422 });
    }

    // Carry a guest's leaderboard rank AND owned items/consumables over to
    // the wallet they just connected, so claiming the verified badge never
    // resets their progress. Prefer the client's durable localStorage token
    // (same one every score submission uses - see $.guestToken() in
    // shooterboard.js) over session.guestId: the session cookie is what the
    // durable token was built to survive losing in the first place (iOS
    // Safari ITP, in-app browsers, a cleared cookie jar). Using only
    // session.guestId here meant a player whose cookie had ever reset
    // still had all their real progress under "guest:<token>", but this
    // merge looked for (and found nothing under, or merged the wrong,
    // empty) "guest:<old-session-id>" - the exact "I connected my wallet
    // and lost my progress" report.
    const rawGuestToken = typeof guestToken === 'string' ? guestToken : undefined;
    const clientGuestKey =
      rawGuestToken && /^[a-z0-9-]{8,40}$/i.test(rawGuestToken) ? `guest:${rawGuestToken.toLowerCase()}` : null;
    const guestId = clientGuestKey || session.guestId;
    const walletKey = fields.address.toLowerCase();

    // Store auth in session; clear the nonce so this signed message can
    // never be replayed to re-run verification a second time.
    session.siwe = {
      address: fields.address,
      chainId: fields.chainId,
    };
    session.nonce = undefined;
    await session.save();

    if (guestId) {
      try {
        await mergeGuestIntoWallet(guestId, walletKey);
      } catch {
        // best-effort: a failed merge shouldn't block sign-in
      }
      try {
        await mergeGuestProfileIntoWallet(guestId, walletKey);
      } catch {
        // best-effort: a failed merge shouldn't block sign-in
      }
    }

    return NextResponse.json({ ok: true, address: fields.address });
  } catch {
    // generic message to the client; full error details stay server-side
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 400 });
  }
}
