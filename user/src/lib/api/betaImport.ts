import { apiFetch } from './client';

/**
 * "Import my real books": copy a workspace from the real site into
 * beta.finquanta.ai. See server/src/modules/beta-import.
 */

export interface BetaImportResult {
  businessId: string;
  businessName: string;
  /** True when this replaced an earlier beta copy of the same workspace. */
  refreshed: boolean;
  counts: Record<string, number>;
  filesCopied: number;
  filesFailed: number;
  membersInvited: number;
}

/**
 * On the real site: a one-time link into beta for this workspace. Owner only.
 * `memberUserIds` are the members allowed to test the copy; they get the
 * "Beta tester" badge on the real workspace.
 */
export async function createBetaImportLink(
  businessId: string,
  memberUserIds: string[]
): Promise<{ url: string; expiresInMinutes: number }> {
  return apiFetch('/v1/beta-export/codes', {
    method: 'POST',
    body: JSON.stringify({ businessId, memberUserIds }),
  });
}

/** On beta: redeem the link's code and copy the workspace in. Can take a minute. */
export async function runBetaImport(code: string): Promise<BetaImportResult> {
  return apiFetch<BetaImportResult>('/v1/beta-import', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
