// Role-based access control for the team console.
//
// A permission is a "scope" (verb.noun). A role is a named bundle of scopes.
// The UI hides what a role can't do; every admin API route re-checks the
// scope server-side (the UI is never the security boundary).

export type Scope =
  | 'stats.view'        // see the dashboard / analytics
  | 'players.view'      // see players & leaderboard detail
  | 'players.moderate'  // derank / ban / grant items
  | 'rewards.view'      // see tournaments & payouts
  | 'rewards.manage'    // create seasons, compute winners, grant cosmetics
  | 'payouts.send'      // create & send USDC payout batches
  | 'flagged.review'    // work the anti-cheat queue
  | 'sponsors.manage'   // add/edit sponsors & partners
  | 'content.manage'    // announcements & feedback
  | 'audit.view'        // read the audit log
  | 'admins.manage';    // add/remove admins & change roles

export const ALL_SCOPES: Scope[] = [
  'stats.view', 'players.view', 'players.moderate', 'rewards.view', 'rewards.manage',
  'payouts.send', 'flagged.review', 'sponsors.manage', 'content.manage', 'audit.view', 'admins.manage',
];

export type Role = 'owner' | 'finance' | 'community' | 'moderator' | 'analyst';

export const ROLES: Record<Role, { label: string; desc: string; scopes: Scope[] }> = {
  owner: {
    label: 'Owner',
    desc: 'Full control, including managing admins and roles.',
    scopes: ALL_SCOPES,
  },
  finance: {
    label: 'Finance',
    desc: 'Runs tournaments and USDC payouts. No moderation or content.',
    scopes: ['stats.view', 'rewards.view', 'rewards.manage', 'payouts.send', 'audit.view'],
  },
  community: {
    label: 'Community',
    desc: 'Manages sponsors, announcements, and feedback. No money or bans.',
    scopes: ['stats.view', 'sponsors.manage', 'content.manage'],
  },
  moderator: {
    label: 'Moderator',
    desc: 'Reviews flagged runs and moderates players. No money or content.',
    scopes: ['stats.view', 'players.view', 'players.moderate', 'flagged.review'],
  },
  analyst: {
    label: 'Analyst',
    desc: 'Read-only access to stats and leaderboards.',
    scopes: ['stats.view', 'players.view', 'rewards.view'],
  },
};

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && v in ROLES;
}

export function scopesFor(role: Role): Scope[] {
  return ROLES[role]?.scopes ?? [];
}

export function hasScope(role: Role, scope: Scope): boolean {
  return scopesFor(role).includes(scope);
}
