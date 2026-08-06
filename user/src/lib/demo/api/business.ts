/**
 * Demo mirror of lib/api/business.ts, trimmed to what InvoiceTemplate actually
 * reads. No logo upload in the demo (adds complexity disproportionate to demo
 * value for a session that's cleared on tab close).
 */
import { load, save } from '../store';

export interface BusinessProfile {
  businessName?: string;
  logoUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  businessEmail?: string;
  businessPhone?: string;
  website?: string;
}

export function formatBusinessAddress(b: BusinessProfile): string[] {
  return [
    b.addressLine1,
    b.addressLine2,
    [b.city, b.region, b.postalCode].filter(Boolean).join(', '),
    b.country,
  ].filter(Boolean) as string[];
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  return { businessName: load().business.name };
}

export async function saveBusinessProfile(data: BusinessProfile): Promise<BusinessProfile> {
  const state = load();
  if (data.businessName?.trim()) state.business.name = data.businessName.trim();
  save(state);
  return { businessName: state.business.name };
}
