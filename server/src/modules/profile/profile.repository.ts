import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { CurrentUserResponse, UserProfile, UserSettingsPayload } from './profile.types';

const defaultSettings: UserSettingsPayload = {
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
  security: {},
  language: {
    language: 'en',
    timeZone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    currency: 'USD',
    measurementSystem: 'metric',
    numberFormat: 'en-US'
  },
  privacy: {},
  backup: {},
  integrations: {},
  appearance: { theme: 'system', accentColor: '#150578', compactMode: false, fontSize: 'medium' },
  help: {},
  version: '1.0.0'
};

export class ProfileRepository {
  private users: UserRepository;

  constructor(private database: Database) {
    this.users = new UserRepository(database);
  }

  async getMe(userId: string): Promise<CurrentUserResponse> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const profileResult = await this.database.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
    const settingsResult = await this.database.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profile: profileResult.rows[0] ? this.mapProfile(profileResult.rows[0]) : {},
      settings: settingsResult.rows[0] ? this.mapSettings(settingsResult.rows[0]) : defaultSettings
    };
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const query = `
      INSERT INTO user_profiles (
        user_id, avatar, phone, job_title, company, industry, bio, address,
        social_links, company_email, linkedin, date_of_incorporation, country,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        avatar = COALESCE(EXCLUDED.avatar, user_profiles.avatar),
        phone = COALESCE(EXCLUDED.phone, user_profiles.phone),
        job_title = COALESCE(EXCLUDED.job_title, user_profiles.job_title),
        company = COALESCE(EXCLUDED.company, user_profiles.company),
        industry = COALESCE(EXCLUDED.industry, user_profiles.industry),
        bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
        address = COALESCE(EXCLUDED.address, user_profiles.address),
        social_links = COALESCE(EXCLUDED.social_links, user_profiles.social_links),
        company_email = COALESCE(EXCLUDED.company_email, user_profiles.company_email),
        linkedin = COALESCE(EXCLUDED.linkedin, user_profiles.linkedin),
        date_of_incorporation = COALESCE(EXCLUDED.date_of_incorporation, user_profiles.date_of_incorporation),
        country = COALESCE(EXCLUDED.country, user_profiles.country),
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.database.query(query, [
      userId,
      data.avatar ?? null,
      data.phone ?? null,
      data.jobTitle ?? null,
      data.company ?? null,
      data.industry ?? null,
      data.bio ?? null,
      data.address ?? null,
      data.socialLinks ?? null,
      data.companyEmail ?? null,
      data.linkedin ?? null,
      data.dateOfIncorporation ?? null,
      data.country ?? null
    ]);

    return this.mapProfile(result.rows[0]);
  }

  async updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload> {
    const merged = { ...defaultSettings, ...data };
    const query = `
      INSERT INTO user_settings (
        user_id, notifications, security, language, privacy, backup,
        integrations, appearance, help, version, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        notifications = user_settings.notifications || EXCLUDED.notifications,
        security = user_settings.security || EXCLUDED.security,
        language = user_settings.language || EXCLUDED.language,
        privacy = user_settings.privacy || EXCLUDED.privacy,
        backup = user_settings.backup || EXCLUDED.backup,
        integrations = user_settings.integrations || EXCLUDED.integrations,
        appearance = user_settings.appearance || EXCLUDED.appearance,
        help = user_settings.help || EXCLUDED.help,
        version = EXCLUDED.version,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.database.query(query, [
      userId,
      merged.notifications ?? {},
      merged.security ?? {},
      merged.language ?? {},
      merged.privacy ?? {},
      merged.backup ?? {},
      merged.integrations ?? {},
      merged.appearance ?? {},
      merged.help ?? {},
      merged.version ?? '1.0.0'
    ]);

    return this.mapSettings(result.rows[0]);
  }

  private mapProfile(row: any): UserProfile {
    return {
      avatar: row.avatar ?? undefined,
      phone: row.phone ?? undefined,
      jobTitle: row.job_title ?? undefined,
      company: row.company ?? undefined,
      industry: row.industry ?? undefined,
      bio: row.bio ?? undefined,
      address: row.address ?? {},
      socialLinks: row.social_links ?? [],
      companyEmail: row.company_email ?? undefined,
      linkedin: row.linkedin ?? undefined,
      dateOfIncorporation: row.date_of_incorporation ? String(row.date_of_incorporation).slice(0, 10) : undefined,
      country: row.country ?? undefined
    };
  }

  private mapSettings(row: any): UserSettingsPayload {
    return {
      notifications: row.notifications ?? {},
      security: row.security ?? {},
      language: row.language ?? {},
      privacy: row.privacy ?? {},
      backup: row.backup ?? {},
      integrations: row.integrations ?? {},
      appearance: row.appearance ?? {},
      help: row.help ?? {},
      version: row.version ?? '1.0.0'
    };
  }
}
