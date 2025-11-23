// Type definitions for comprehensive settings system
export interface UserSettings {
  notifications: NotificationSettings;
  security: SecuritySettings;
  language: LanguageSettings;
  privacy: PrivacySettings;
  backup: BackupSettings;
  integrations: IntegrationSettings;
  appearance: AppearanceSettings;
  profile: ProfileSettings;
  help: HelpSettings;
  filter?: boolean;
  newsUpdates?: boolean;
  reminders?: boolean;
  pushNotifications?: boolean;
  paymentUpdate?: boolean;
  balanceNotification?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  inAppNotifications?: boolean;
  marketingEmails?: boolean;
  lastUpdated: Date;
  version: string;
}

// Settings validation schemas
export const settingsValidation = {
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  apiKeys: {
    maxKeys: 10,
    nameMaxLength: 100,
    urlMaxLength: 500
  },
  webhooks: {
    maxWebhooks: 5,
    urlMaxLength: 500
  },
  sessionInfo: {
    maxSessions: 5,
    sessionTimeoutMinutes: 30
  }
};

export interface NotificationSettings {
  filter: boolean;
  newsUpdates: boolean;
  reminders: boolean;
  pushNotifications: boolean;
  paymentUpdate: boolean;
  balanceNotification: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  inAppNotifications: boolean;
  marketingEmails?: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: 'app' | 'sms' | 'email';
  activeSessions: SessionInfo[];
  passwordLastChanged: Date;
  apiKeys: ApiKey[];
  recoveryEmail: string;
  loginAlerts: boolean;
}

export interface LanguageSettings {
  language: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  measurementSystem: 'metric' | 'imperial';
  numberFormat: string;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'connections';
  dataSharing: boolean;
  thirdPartyDataSharing: boolean;
  analyticsTracking: boolean;
  searchEngineIndexing: boolean;
  cookieConsent: 'all' | 'essential' | 'none';
}

export interface BackupSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupRetention: number;
  backupHistory: BackupEntry[];
  lastBackup?: Date;
}

export interface IntegrationSettings {
  connectedApps: ConnectedApp[];
  apiIntegrations: ApiIntegration[];
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto' | 'system';
  accentColor: string;
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export interface ProfileSettings {
  avatar: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  company: string;
  industry: string;
  bio: string;
  address: Address;
  socialLinks: SocialLink[];
}

export interface HelpSettings {
  supportTickets: SupportTicket[];
  bugReports: BugReport[];
  featureRequests: FeatureRequest[];
  tutorials: Tutorial[];
}

export interface ConnectedApp {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
  permissions: string[];
  connectedAt: Date;
}

export interface ApiIntegration {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  permissions: string[];
  apiKey: string;
  createdAt: Date;
  lastUsed?: Date;
}

export interface BackupEntry {
  id: string;
  timestamp: Date;
  size: number;
  type: 'automatic' | 'manual';
  status: 'completed' | 'failed' | 'in-progress';
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
  responses: TicketResponse[];
  lastResponse?: Date;
  messages?: Array<{ sender: string; content: string; timestamp: Date }>;
}

export interface BugReport {
  id: string;
  title: string;
  description: string;
  steps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  screenshots: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: 'enhancement' | 'bug_fix' | 'new_feature' | 'integration';
  status: 'open' | 'in-progress' | 'approved' | 'rejected';
  votes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketResponse {
  id: string;
  message: string;
  timestamp: Date;
  author: 'user' | 'support' | 'system';
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'getting_started' | 'features' | 'troubleshooting' | 'advanced';
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  format: 'video' | 'article' | 'interactive';
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialLink {
  platform: 'linkedin' | 'twitter' | 'github' | 'website' | 'instagram' | 'facebook';
  url: string;
  visible: boolean;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  location: string;
  ipAddress: string;
  lastActive: Date;
  isActive: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  isActive?: boolean;
}

// Default settings object
export const defaultSettings: UserSettings = {
  notifications: {
    filter: true,
    newsUpdates: true,
    reminders: true,
    pushNotifications: true,
    paymentUpdate: true,
    balanceNotification: true,
    emailNotifications: true,
    smsNotifications: false,
    inAppNotifications: true,
    marketingEmails: false,
    frequency: 'daily'
  },
  security: {
    twoFactorEnabled: false,
    twoFactorMethod: 'app',
    activeSessions: [],
    passwordLastChanged: new Date(),
    apiKeys: [],
    recoveryEmail: '',
    loginAlerts: true
  },
  language: {
    language: 'en',
    timeZone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    currency: 'USD',
    measurementSystem: 'metric',
    numberFormat: 'en-US'
  },
  privacy: {
    profileVisibility: 'private',
    dataSharing: false,
    thirdPartyDataSharing: false,
    analyticsTracking: true,
    searchEngineIndexing: false,
    cookieConsent: 'essential'
  },
  backup: {
    autoBackup: true,
    backupFrequency: 'weekly',
    backupRetention: 30,
    backupHistory: []
  },
  integrations: {
    connectedApps: [],
    apiIntegrations: []
  },
  appearance: {
    theme: 'system',
    accentColor: '#150578',
    compactMode: false,
    fontSize: 'medium'
  },
  profile: {
    avatar: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    company: '',
    industry: '',
    bio: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    socialLinks: []
  },
  help: {
    supportTickets: [],
    bugReports: [],
    featureRequests: [],
    tutorials: []
  },
  filter: true,
  newsUpdates: true,
  reminders: true,
  pushNotifications: true,
  paymentUpdate: true,
  balanceNotification: true,
  emailNotifications: true,
  smsNotifications: false,
  inAppNotifications: true,
  marketingEmails: false,
  lastUpdated: new Date(),
  version: '1.0.0'
};
