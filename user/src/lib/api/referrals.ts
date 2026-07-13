import { apiFetch } from './client';

export type ReferralStage = 'signed_up' | 'verified' | 'qualified';

export interface ReferredUser {
  email: string;
  name: string;
  signedUpAt: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  stage: ReferralStage;
}

export interface MyReferrals {
  code: string;
  signedUp: number;
  verified: number;
  /** Cleared all three stages — the number that counts. */
  qualified: number;
  referred: ReferredUser[];
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  code: string;
  signedUp: number;
  verified: number;
  qualified: number;
}

export interface AdminReferrals {
  totals: { signedUp: number; verified: number; qualified: number; referrers: number };
  leaderboard: LeaderboardRow[];
}

export const getMyReferrals = () => apiFetch<MyReferrals>('/v1/referrals/me');
export const getAdminReferrals = () => apiFetch<AdminReferrals>('/v1/admin/referrals');

/** The link a user shares. Built from wherever the app is actually running. */
export function referralLink(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://finquanta.ai';
  return `${origin}/signup?ref=${code}`;
}

/** Where a captured ?ref= code is parked until the user finishes signing up. */
const REF_KEY = 'finquantaReferralCode';

/**
 * Remember the code someone arrived with.
 *
 * Stored rather than sent immediately because signup isn't instant — they may
 * read the landing page, leave, and come back. First code wins, so an existing
 * attribution can't be overwritten by a later link.
 */
export function captureReferralCode(code: string | null | undefined): void {
  if (typeof window === 'undefined' || !code) return;
  if (localStorage.getItem(REF_KEY)) return;
  localStorage.setItem(REF_KEY, code.trim().toUpperCase());
}

export function storedReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(REF_KEY) ?? undefined;
}

export function clearReferralCode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REF_KEY);
}
