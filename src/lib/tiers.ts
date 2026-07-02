// Shared score → tier mapping, kept in one place so the web leaderboard,
// the OG card, and the in-game board can't drift apart.

export const TIER_COLORS: Record<string, string> = {
  BRONZE: '#cd7f32',
  SILVER: '#cfd3d6',
  GOLD: '#ffcf33',
  PLATINUM: '#39d6e6',
  DIAMOND: '#6fb7ff',
  MASTER: '#c77dff',
};

export function tierFromScore(score: number): string {
  if (score >= 250000) return 'MASTER';
  if (score >= 100000) return 'DIAMOND';
  if (score >= 50000) return 'PLATINUM';
  if (score >= 20000) return 'GOLD';
  if (score >= 5000) return 'SILVER';
  return 'BRONZE';
}

// A readable player label: chosen call sign, else a shortened wallet, else
// an anonymised guest tag.
export function displayName(name: string | undefined, address: string): string {
  if (name && name.trim()) return name.toUpperCase();
  if (/^0x[0-9a-f]{40}$/i.test(address)) return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return 'GUEST';
}
