import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  nonce?: string;
  siwe?: {
    address: string;
    chainId: number;
  };
  // Anonymous, device-scoped identity for guest leaderboard play. Created
  // lazily the first time a wallet-less player posts a score, then kept in
  // the session cookie so they hold (and can improve) their rank.
  guestId?: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_dev_only!!',
  cookieName: 'raid-shooter-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// The leaderboard member key for the current player. Wallet players are
// keyed by their address (verified); guests by an opaque "guest:<id>" so
// the two identity types share one board without ever colliding.
export async function getOrCreateGuestId(
  session: IronSession<SessionData>
): Promise<string> {
  if (!session.guestId) {
    session.guestId = `guest:${crypto.randomUUID()}`;
    await session.save();
  }
  return session.guestId;
}
