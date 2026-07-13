import { apiFetch, serverApiUrl, fetchWithRetry } from './client';

export interface BusinessProfile {
  businessName?: string;
  businessType?: string;
  industry?: string;
  niche?: string;
  entityType?: string;
  maturityStage?: string;
  revenueRange?: string;
  employeeCount?: string;
  financialGoals?: string;
  country?: string;
  incorporationLocation?: string;
  // Asked at signup; feeds the Financial Health Score and Finna's advice.
  // hasDebt: 'Yes' | 'No' | 'Not sure'. primaryGoal creates a starter goal.
  hasDebt?: string;
  primaryGoal?: string;
  // Branding + contact details — these fill the invoice header.
  logoUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  businessEmail?: string;
  businessPhone?: string;
  website?: string;
  onboardingCompleted?: boolean;
}

/** Upload a business logo (PNG or JPEG, max 1MB) for the invoice header. */
export async function uploadBusinessLogo(file: File): Promise<BusinessProfile> {
  const form = new FormData();
  form.append('file', file);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetchWithRetry(serverApiUrl('/v1/me/business/logo'), {
    method: 'POST',
    // Don't set Content-Type — the browser adds the multipart boundary itself.
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.message || 'Could not upload logo');
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

/** Multi-line business address for the invoice header. */
export function formatBusinessAddress(b: BusinessProfile): string[] {
  return [
    b.addressLine1,
    b.addressLine2,
    [b.city, b.region, b.postalCode].filter(Boolean).join(', '),
    b.country,
  ].filter(Boolean) as string[];
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  return apiFetch<BusinessProfile>('/v1/me/business');
}

export async function saveBusinessProfile(data: BusinessProfile): Promise<BusinessProfile> {
  return apiFetch<BusinessProfile>('/v1/me/business', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
