import { apiFetch } from './client';

/**
 * Beta feature switches. A feature is Off, in Beta (beta workspaces only) or
 * on for Everyone; admins change the stage in the admin Beta tab.
 */

export type FeatureStage = 'off' | 'beta' | 'all';

export interface AdminBetaFeature {
  key: string;
  name: string;
  description: string;
  stage: FeatureStage;
  updatedAt: string | null;
}

let cached: { businessId: string | null; promise: Promise<string[]> } | null = null;

/** Forget the answer, e.g. after switching workspace. */
export function clearBetaFeaturesCache(): void {
  cached = null;
}

/**
 * Features the active workspace can use. Shared by every caller on the page
 * and remembered per workspace, so the sidebar and a page asking at the same
 * moment make one request.
 */
export function getMyBetaFeaturesShared(): Promise<string[]> {
  const businessId = typeof window !== 'undefined' ? localStorage.getItem('activeBusinessId') : null;
  if (cached && cached.businessId === businessId) return cached.promise;
  const promise = apiFetch<{ features: string[] }>('/v1/beta/me')
    .then((data) => data.features ?? [])
    .catch((error) => {
      // A failed lookup is not remembered: the next caller asks again.
      if (cached?.promise === promise) cached = null;
      throw error;
    });
  cached = { businessId, promise };
  return promise;
}

export async function listAdminBetaFeatures(): Promise<AdminBetaFeature[]> {
  return apiFetch<AdminBetaFeature[]>('/v1/admin/beta/features');
}

/** Audited server-side. Returns the full list after the change. */
export async function setAdminBetaFeatureStage(key: string, stage: FeatureStage): Promise<AdminBetaFeature[]> {
  return apiFetch<AdminBetaFeature[]>(`/v1/admin/beta/features/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ stage }),
  });
}
