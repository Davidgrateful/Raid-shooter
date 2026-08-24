'use client';

import { useCallback, useEffect, useState } from 'react';

/*==============================================================================
Menu data

Everything the command centre shows that lives on the server rather than in the
engine: the live cup, the daily streak, the weekly drop, operator news, the
player's inbox and where they currently stand on the board.

All of it is fetched once when the player lands on the menu. Every field is
optional by design - a missing key or an offline endpoint degrades to "that
card isn't shown", never to a broken screen.
==============================================================================*/

export interface CupSeason {
  id: string;
  name: string;
  live: boolean;
  prize1Usd?: number;
  poolUsd?: number;
  endsAt: number | null;
  sponsorName: string | null;
}

export interface StreakState {
  days: number;
  claimedAt: number;
  goal: number;
  pilotGoal?: number;
  pilotClaimed?: boolean;
}

export interface WeeklyGift {
  available: boolean;
  claimed?: boolean;
  item: { id: string; title: string } | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
}

export interface RankState {
  rank: number;
  total: number;
  score: number;
}

export function guestToken(): string | null {
  try {
    const raw = localStorage.getItem('radiusraid');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guesttoken?: string };
    return typeof parsed.guesttoken === 'string' && parsed.guesttoken.length >= 8 ? parsed.guesttoken : null;
  } catch {
    return null;
  }
}

export function timeLeft(endsAt: number | null | undefined): string {
  if (!endsAt) return '';
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'ENDED';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}D ${h}H`;
  if (h > 0) return `${h}H ${m}M`;
  return `${m}M`;
}

interface MenuData {
  cup: CupSeason | null;
  streak: StreakState | null;
  gift: WeeklyGift | null;
  news: Announcement | null;
  unread: number;
  hasInbox: boolean;
  rank: RankState | null;
  refreshStreak: () => void;
  refreshGift: () => void;
}

export function useMenuData(active: boolean): MenuData {
  const [cup, setCup] = useState<CupSeason | null>(null);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [gift, setGift] = useState<WeeklyGift | null>(null);
  const [news, setNews] = useState<Announcement | null>(null);
  const [unread, setUnread] = useState(0);
  const [hasInbox, setHasInbox] = useState(false);
  const [rank, setRank] = useState<RankState | null>(null);

  const refreshStreak = useCallback(() => {
    const gt = guestToken();
    // record today's visit first, then read the full state back - the record
    // response omits claimedAt, which the claim card needs
    fetch('/api/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestToken: gt || undefined }),
    })
      .then(() => fetch(`/api/streak${gt ? `?guestToken=${encodeURIComponent(gt)}` : ''}`))
      .then((r) => r.json())
      .then(setStreak)
      .catch(() => {});
  }, []);

  const refreshGift = useCallback(() => {
    fetch('/api/claim/weekly').then((r) => r.json()).then(setGift).catch(() => {});
  }, []);

  // one-time content that doesn't change while the tab is open
  useEffect(() => {
    fetch('/api/season')
      .then((r) => r.json())
      .then((d) => setCup(d.season && d.season.live ? d.season : null))
      .catch(() => {});
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => { if (d.announcements?.length) setNews(d.announcements[0]); })
      .catch(() => {});
  }, []);

  // per-visit state: refreshed every time the player comes back to the menu,
  // because a finished run can have moved all of it
  useEffect(() => {
    if (!active) return;
    refreshStreak();
    refreshGift();

    const gt = guestToken();
    fetch(`/api/inbox${gt ? `?guestToken=${encodeURIComponent(gt)}` : ''}`)
      .then((r) => r.json())
      .then((d) => { setUnread(d.unread || 0); setHasInbox((d.messages || []).length > 0); })
      .catch(() => {});

    // where the player stands right now. Resolved the same way the board does
    // it: wallet address when signed in, guest id otherwise.
    let cancelled = false;
    (async () => {
      try {
        const session = await fetch('/api/siwe/session').then((r) => r.json());
        const me: string | null = session.authenticated && session.address
          ? String(session.address).toLowerCase()
          : session.guestId || null;
        if (!me) return;
        const board = await fetch('/api/leaderboard?limit=1000').then((r) => r.json());
        const rows: { address: string; score: number }[] = board.entries || [];
        const idx = rows.findIndex((e) => e.address === me);
        if (cancelled) return;
        setRank(idx >= 0
          ? { rank: idx + 1, total: typeof board.total === 'number' ? board.total : rows.length, score: rows[idx].score }
          : null);
      } catch {
        /* board offline - the rank card falls back to the local best */
      }
    })();
    return () => { cancelled = true; };
  }, [active, refreshStreak, refreshGift]);

  return { cup, streak, gift, news, unread, hasInbox, rank, refreshStreak, refreshGift };
}
