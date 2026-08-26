import { apiFetch } from './client';

/** A user. Business fields moved to `AdminBusiness` — see listAdminBusinesses. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** Personal phone. Empty until the account supplies one. */
  phone: string;
  role: string;
  status: string;
  joinedAt: string | null;
  dateOfBirth: string | null;
  emailVerified: boolean;
}

export interface AdminBusiness {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  /** Nobody owns this workspace — the last member left it behind. */
  ownerless: boolean;
  /** Who it belonged to, so an accidental departure can be undone knowingly. */
  previousOwnerEmail: string;
  /** Seats — billing is per seat and every member occupies one. */
  memberCount: number;
  /** Display name of the plan being paid for. */
  /** What the workspace is BILLED. Drives the plan picker and the revenue view. */
  plan: string;
  planKey: string;
  /**
   * What the workspace can USE — the same label the customer sees in their own
   * business switcher. Differs from `plan` during a trial or early-access
   * window, which is exactly when showing only one of them is misleading.
   */
  effectivePlan: string;
  effectivePlanKey: string;
  /**
   * What the badge says and how it is tinted, decided server-side by the same
   * rule the dashboard's business switcher uses — so a workspace is never
   * described one way here and another way to its owner.
   */
  badgeLabel: string;
  badgeTone: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  grandfatheredUntil: string | null;
  /** True while a trial or grandfather window grants more than they pay for. */
  onFreeWindow: boolean;
  country: string;
  industry: string;
  /** The business's own phone, separate from any individual's. */
  businessPhone: string;
  status: string;
  createdAt: string | null;
}

export interface AdminBillingOverview {
  distribution: { plan: string; businesses: number; seats: number }[];
  /** Projected, not real — nothing is charging anyone until Stripe lands. */
  projectedMrr: number;
  projectedByPlan: Record<string, number>;
  plans: { key: string; name: string; monthly: number; annual: number; contactSales: boolean }[];
}

export async function getAdminBillingOverview(): Promise<AdminBillingOverview> {
  return apiFetch<AdminBillingOverview>('/v1/admin/billing/overview');
}

/** Move a workspace to any plan, free through Corporate. Audited server-side. */
export async function setAdminBusinessPlan(id: string, plan: string): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}/plan`, {
    method: 'PATCH', body: JSON.stringify({ plan }),
  });
}

/** Begin a trial. Length follows the owner's verification status (7 or 14 days). */
export async function startAdminBusinessTrial(id: string): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}/trial`, { method: 'POST' });
}

export async function extendAdminBusinessTrial(id: string, days: number): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}/trial`, {
    method: 'PATCH', body: JSON.stringify({ days }),
  });
}

/** Grant early access for `months`, or pass null to remove it. */
export async function setAdminBusinessGrandfather(id: string, months: number | null): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}/grandfather`, {
    method: 'PATCH', body: JSON.stringify({ months }),
  });
}

/**
 * Nudge a free-access window by days, rather than setting one from today.
 *
 * Also the only honest way to extend a PAYING customer from the admin panel:
 * their billing date belongs to Stripe — we copy it from webhooks, so editing
 * it here would change nothing about when they are charged and would be undone
 * by the next event. Granting free time on top is something we genuinely can do.
 */
export async function adjustAdminBusinessGrandfather(id: string, days: number): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}/grandfather`, {
    method: 'PATCH', body: JSON.stringify({ days }),
  });
}

/** List all users (admin only — 403 if the caller isn't an admin). */
export async function listAdminUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/v1/admin/users');
}

// ------------------------------------------------------ lifecycle reminders

export interface LifecycleRunResult {
  dryRun: boolean;
  sent: number;
  recipients: { email: string; types: string[] }[];
  byType: Record<string, number>;
}

/**
 * Who WOULD be emailed, without sending anything.
 *
 * Worth reaching for before any real run. The triggers are subtle enough that
 * reading them is not the same as knowing who matches: most workspaces are
 * grandfathered, so the upgrade nudge has far fewer recipients than "everyone
 * on the free plan" suggests.
 */
export async function previewLifecycle(): Promise<LifecycleRunResult> {
  return apiFetch<LifecycleRunResult>('/v1/admin/lifecycle/preview');
}

/** Run the whole batch now rather than waiting for the daily cron. */
export async function runLifecycle(): Promise<LifecycleRunResult> {
  return apiFetch<LifecycleRunResult>('/v1/admin/lifecycle/run', { method: 'POST' });
}

/**
 * Send one reminder to one person immediately.
 *
 * Ignores the cadence, which is the point — but the server still refuses if
 * they have unsubscribed from that type, because honouring an opt-out is a
 * legal obligation rather than a preference.
 */
export async function sendLifecycleEmail(userId: string, type: string): Promise<{ sent: boolean }> {
  return apiFetch(`/v1/admin/users/${userId}/lifecycle-email`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

/** What this person has opted out of, so the panel can say so before sending. */
export async function getAdminEmailPreferences(userId: string): Promise<Record<string, boolean>> {
  return apiFetch(`/v1/admin/users/${userId}/email-preferences`);
}

/** Confirm the current token belongs to an admin and get the caller's role. */
export async function checkAdmin(): Promise<{ id: string; email: string; role: string }> {
  return apiFetch('/v1/admin/me');
}

/** Edit a user: name, role (owner only), and/or status ('active' | 'suspended'). */
export async function updateAdminUser(
  id: string,
  data: { firstName?: string; lastName?: string; role?: string; status?: string; dateOfBirth?: string | null; emailVerified?: boolean }
): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export interface AdminDeletionBlocker {
  id: string;
  name: string;
  otherMembers: number;
  /** Who this workspace could be handed to instead of destroyed. */
  candidates: { userId: string; name: string; email: string; role: string }[];
}

/**
 * Shared workspaces this user OWNS — what deleting the account would take with
 * it. Deleting a user cascades their businesses and every ledger beneath them,
 * so each of these needs a decision first: hand it to a member, or delete it
 * deliberately.
 */
export async function getAdminDeletionBlockers(id: string): Promise<AdminDeletionBlocker[]> {
  return apiFetch<AdminDeletionBlocker[]>(`/v1/admin/users/${id}/deletion-blockers`);
}

/**
 * `successors` maps a workspace to its new owner; `deleteWorkspaces` lists the
 * ones being destroyed on purpose. The server refuses (409) if any shared
 * workspace appears in neither.
 */
export async function deleteAdminUser(
  id: string,
  decisions: { successors?: Record<string, string>; deleteWorkspaces?: string[] } = {}
): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({
      successors: decisions.successors ?? {},
      deleteWorkspaces: decisions.deleteWorkspaces ?? [],
    }),
  });
}

/** Every workspace, one row each (admin only). */
export async function listAdminBusinesses(): Promise<AdminBusiness[]> {
  return apiFetch<AdminBusiness[]>('/v1/admin/businesses');
}

/** Edit a workspace's name and/or country. */
export async function updateAdminBusiness(
  id: string,
  data: { name?: string; country?: string }
): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/** Restrict ('suspended') or reactivate ('active') a workspace. */
export async function setAdminBusinessStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

/** Irreversible — takes the workspace's entire financial history with it. */
export async function deleteAdminBusiness(id: string): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${id}`, { method: 'DELETE' });
}

/** Set a user's password directly (admin-only, subject to role hierarchy). */
export async function setAdminUserPassword(id: string, password: string): Promise<void> {
  await apiFetch(`/v1/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) });
}

export interface AdminUsage {
  configured: boolean;
  monthToDateUsd?: number;
  currency?: string;
  since?: string;
  until?: string;
  error?: string;
}

/** Anthropic month-to-date spend (needs ANTHROPIC_ADMIN_KEY on the backend). */
export async function getAdminUsage(): Promise<AdminUsage> {
  return apiFetch<AdminUsage>('/v1/admin/usage');
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  details: unknown;
  createdAt: string | null;
}

/** Append-only audit trail of admin actions (admin only). */
export async function getAuditLogs(): Promise<AuditLog[]> {
  return apiFetch<AuditLog[]>('/v1/admin/audit');
}

/**
 * One closed account.
 *
 * Every field is a COPY taken just before the delete — the user row it
 * describes is gone, so there is nothing to join back to.
 */
export interface AccountDeletion {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  /** 'self' = they closed it themselves. 'admin' = we removed it. */
  source: 'self' | 'admin' | string;
  actorId: string | null;
  actorEmail: string | null;
  workspacesDestroyed: number;
  createdAt: string | null;
}

/**
 * Accounts that have been deleted (admin only).
 *
 * Deliberately NOT read from the audit log: that only ever recorded admin
 * actions, so people who closed their own account — most of them — were
 * invisible.
 */
export async function getAccountDeletions(): Promise<AccountDeletion[]> {
  return apiFetch<AccountDeletion[]>('/v1/admin/account-deletions');
}

/** Headline numbers for the admin Overview tab. */
export interface AdminOverview {
  /** The window the dated figures cover. Null on either side = open-ended. */
  period: { from: string | null; to: string | null };
  users: { total: number; verified: number; suspended: number; newThisMonth: number; newInPeriod: number; admins: number };
  businesses: { total: number; suspended: number; multiMember: number; withProfile: number; avgMembers: number; newInPeriod: number };
  countries: { country: string; businesses: number }[];
  seats: { billable: number; viewersFree: number };
  /** Every plan, including tiers nobody is on — an empty tier is information. */
  plans: {
    plan: string; name: string; businesses: number; seats: number;
    monthly: number; contactSales: boolean;
  }[];
  churn: {
    active: number; pastDue: number; cancelling: number; canceled: number;
    trialing: number; trialsStarted: number; trialsConverted: number;
    /** Share of everyone who ever subscribed who has since cancelled, as a %. */
    churnRate: number;
    startedInPeriod: number;
    cancelledInPeriod: number;
  };
  /** Price x seats over assigned plans — an intention, not money received. */
  projectedMrr: number;
  projectedArr: number;
  byPlan: Record<string, number>;
}

/**
 * `from`/`to` are plain YYYY-MM-DD and scope only the DATED figures — signups,
 * workspaces created, trials started, cancellations. MRR, plan mix and seat
 * counts are snapshots of today whatever range is asked for, because filtering
 * a snapshot by a date range produces a number that looks precise and means
 * nothing.
 */
export async function getAdminOverview(
  period: { from?: string | null; to?: string | null } = {}
): Promise<AdminOverview> {
  const q = new URLSearchParams();
  if (period.from) q.set('from', period.from);
  if (period.to) q.set('to', period.to);
  const qs = q.toString();
  return apiFetch<AdminOverview>(`/v1/admin/overview${qs ? `?${qs}` : ''}`);
}

/**
 * Give an ownerless workspace an owner. Refused (409) if it already has one —
 * this is for recovering an abandoned workspace, not for taking a business off
 * somebody.
 */
export async function assignAdminBusinessOwner(
  businessId: string,
  who: { userId?: string; email?: string }
): Promise<void> {
  await apiFetch(`/v1/admin/businesses/${businessId}/owner`, {
    method: 'PATCH',
    body: JSON.stringify(who),
  });
}
