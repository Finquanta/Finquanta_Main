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

export interface CurrentUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profile: UserProfile;
  settings: UserSettingsPayload;
}
