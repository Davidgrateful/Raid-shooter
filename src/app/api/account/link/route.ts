import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifySiwe } from '@/lib/siwe-verify';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { tryLock, unlock } from '@/lib/lock';
import { getLinks, isEvmAddress, linkAddress, MAX_LINKS, resolveAccount, unlinkAddress } from '@/lib/accounts';
import { mergeGuestIntoWallet } from '@/lib/leaderboard';
import { mergeProfileInto } from '@/lib/profile';
import { linkStatement } from '@/lib/linkMessage';

export const dynamic = 'force-dynamic';

/*==============================================================================
Linked sign-ins (src/lib/accounts.ts)

  GET     the account, the address signed in right now, its linked sign-ins
  POST    link: { message, signature } - a SIWE message signed by the wallet
          being linked, carrying a nonce from /api/siwe/nonce and naming this
          account in its statement (linkStatement below). The session proves
          the account; the signature proves the new address. Anything the new
          address already had (items, kits, pilot XP, board row) merges in.
  DELETE  unlink: { address } - never the sign-in in use right now
==============================================================================*/

async function current() {
  const session = await getSession();
  if (!session.siwe) return { session, account: null as string | null, signer: null as string | null };
  const account = session.siwe.address.toLowerCase();
  return { session, account, signer: (session.siwe.signer || account).toLowerCase() };
}

export async function GET() {
  const { account, signer } = await current();
  if (!account) return NextResponse.json({ signedIn: false });
  return NextResponse.json({ signedIn: true, account, signer, links: await getLinks(account), max: MAX_LINKS });
}

const REFUSED: Record<string, string> = {
  same_address: 'That is the wallet this account already uses - pick a different one.',
  linked_elsewhere: 'That sign-in already belongs to another Raid Shooter account.',
  account_is_linked: 'Sign in with your main wallet to link more sign-ins.',
  has_own_links: 'That wallet has sign-ins of its own linked. Unlink them there first.',
  too_many: `An account can carry ${MAX_LINKS} linked sign-ins.`,
};

export async function POST(req: NextRequest) {
  const { session, account } = await current();
  if (!account) return NextResponse.json({ ok: false, error: 'sign_in_required' }, { status: 401 });
  if (!(await rateLimit('link', `${account}|${clientIp(req)}`, 10, 60_000))) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message : '';
  const signature = typeof body?.signature === 'string' ? body.signature : '';
  if (!message || !signature) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });

  const verified = await verifySiwe(message, signature);
  if (!verified.ok) return NextResponse.json({ ok: false, error: verified.reason }, { status: 400 });
  const fields = verified.fields;
  if (!session.nonce || fields.nonce !== session.nonce) {
    return NextResponse.json({ ok: false, error: 'Invalid nonce' }, { status: 422 });
  }
  if (fields.domain !== (req.headers.get('host') || '')) {
    return NextResponse.json({ ok: false, error: 'Domain mismatch' }, { status: 422 });
  }
  if (fields.statement !== linkStatement(account)) {
    return NextResponse.json({ ok: false, error: 'wrong_statement' }, { status: 422 });
  }
  // one use: this signature can never be replayed
  session.nonce = undefined;
  await session.save();

  const address = fields.address.toLowerCase();
  const lock = await tryLock(`link:${address}`).catch(() => null);
  if (!lock) return NextResponse.json({ ok: false, error: 'busy' }, { status: 409 });
  try {
    const wasOwn = (await resolveAccount(address)) === address;
    const refused = await linkAddress(account, address);
    if (refused) return NextResponse.json({ ok: false, error: refused, message: REFUSED[refused] }, { status: 409 });
    // whatever that address already earned or bought now belongs to this
    // account; best-effort, like the guest merge at sign-in
    if (wasOwn) {
      await mergeGuestIntoWallet(address, account).catch(() => {});
      await mergeProfileInto(address, account).catch(() => {});
    }
  } finally {
    await unlock(`link:${address}`, lock).catch(() => {});
  }

  // the wallet connected right now is the one just linked
  session.siwe = { ...session.siwe!, signer: address };
  await session.save();
  return NextResponse.json({ ok: true, account, signer: address, links: await getLinks(account) });
}

export async function DELETE(req: NextRequest) {
  const { account, signer } = await current();
  if (!account) return NextResponse.json({ ok: false, error: 'sign_in_required' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const address = typeof body?.address === 'string' ? body.address.toLowerCase() : '';
  if (!isEvmAddress(address)) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  if (address === signer) {
    return NextResponse.json({ ok: false, error: 'in_use', message: 'You are signed in with that one. Sign in another way to remove it.' }, { status: 409 });
  }
  const ok = await unlinkAddress(account, address);
  if (!ok) return NextResponse.json({ ok: false, error: 'not_linked' }, { status: 404 });
  return NextResponse.json({ ok: true, links: await getLinks(account) });
}
