import { apiFetch } from './client';

/**
 * Finna Council (spec 07).
 *
 * The Council never runs on its own — `convene` is the only call that spends
 * anything, and only a user action reaches it. Everything else here is free:
 * re-opening a past session reads stored JSON, no AI involved.
 */

export type Vote = 'support' | 'oppose' | 'conditional';
export type SessionStatus = 'running' | 'complete' | 'failed';

export interface MemberPosition {
  member: string;
  position: string;
  vote?: Vote;
}

export interface CouncilVerdict {
  verdict: string;
  votes: { member: string; vote: Vote; because: string }[];
  keyTension: string;
  conditions: string[];
  watchItems: string[];
  nextAction: string;
}

/** How a decision actually turned out. The user's judgement, never the model's. */
export type Outcome = 'worked' | 'mixed' | 'did_not_work' | 'not_done';

export interface CouncilSession {
  id: string;
  businessId: string;
  question: string;
  status: SessionStatus;
  openings: MemberPosition[];
  crossExamination: MemberPosition[];
  verdict: CouncilVerdict | null;
  /** The Decision node this wrote into the Company Brain, if any. */
  brainNodeId: string | null;
  error: string | null;
  outcome: Outcome | null;
  outcomeNote: string | null;
  outcomeRecordedAt: string | null;
  /** When this decision becomes worth looking back at. */
  reviewDueAt: string | null;
  /** An earlier session this one reverses, when the Council spotted one. */
  contradictsSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouncilQuota {
  allowed: boolean;
  scope: 'business' | 'global' | null;
  used: number;
  limit: number;
  globalUsed: number;
  globalLimit: number;
}

export interface CouncilOverview {
  members: { key: string; name: string }[];
  quota: CouncilQuota;
  sessions: CouncilSession[];
}

export const getCouncilOverview = () => apiFetch<CouncilOverview>('/v1/council/overview');

/** The only call that costs money. Two Anthropic requests behind it. */
export const conveneCouncil = (question: string) =>
  apiFetch<CouncilSession>('/v1/council/sessions', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });

/** Free — reads the stored transcript. */
export const getCouncilSession = (id: string) =>
  apiFetch<CouncilSession>(`/v1/council/sessions/${id}`);

/** Record how it turned out. Free — no AI involved in judging your own call. */
export const recordCouncilOutcome = (id: string, outcome: Outcome, note?: string) =>
  apiFetch<CouncilSession>(`/v1/council/sessions/${id}/outcome`, {
    method: 'PATCH',
    body: JSON.stringify({ outcome, note: note ?? null }),
  });
