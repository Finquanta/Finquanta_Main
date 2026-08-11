export interface UserProfile {
  avatar?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  industry?: string;
  bio?: string;
  address?: Record<string, string>;
  socialLinks?: Array<{ platform: string; url: string; visible: boolean }>;
  companyEmail?: string;
  linkedin?: string;
  dateOfIncorporation?: string;
  country?: string;
}

export interface UserSettingsPayload {
  notifications?: Record<string, any>;
  security?: Record<string, any>;
  language?: Record<string, any>;
  privacy?: Record<string, any>;
  backup?: Record<string, any>;
  integrations?: Record<string, any>;
  appearance?: Record<string, any>;
  help?: Record<string, any>;
  version?: string;
}

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
  // Section 9 — asked at signup, used by the Health Score and Finna for context.
  // hasDebt: 'Yes' | 'No' | 'Not sure'. primaryGoal: one of PRIMARY_GOALS.
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
  // Company Brain overview card. Not asked at onboarding — edited on the card.
  /** YYYY-MM-DD. */
  foundedDate?: string;
  description?: string;
  onboardingCompleted?: boolean;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  profile: UserProfile;
  settings: UserSettingsPayload;
}
