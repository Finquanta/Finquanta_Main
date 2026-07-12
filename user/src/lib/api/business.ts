import { apiFetch } from './client';

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
