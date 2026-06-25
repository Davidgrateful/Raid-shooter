import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { getSession } from '@/lib/session';
import { mergeGuestIntoWallet } from '@/lib/leaderboard';

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();
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

    // Carry a guest's leaderboard rank over to the wallet they just
    // connected, so claiming the verified badge never resets their progress.
    const guestId = session.guestId;
    const walletKey = fields.address.toLowerCase();

    // Store auth in session
    session.siwe = {
      address: fields.address,
      chainId: fields.chainId,
    };
    await session.save();

    if (guestId) {
      try {
        await mergeGuestIntoWallet(guestId, walletKey);
      } catch {
        // best-effort: a failed merge shouldn't block sign-in
      }
    }

    return NextResponse.json({ ok: true, address: fields.address });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Verification failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
