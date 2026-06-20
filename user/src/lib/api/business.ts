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
  onboardingCompleted?: boolean;
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
