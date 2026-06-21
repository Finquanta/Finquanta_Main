import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { BusinessProfile, CurrentUserResponse, UserProfile, UserSettingsPayload } from './profile.types';

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

  /** Idempotently create the business onboarding table (safe on every boot). */
  async ensureBusinessSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS business_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        business_name VARCHAR(200),
        business_type VARCHAR(120),
        industry VARCHAR(120),
        niche VARCHAR(160),
        entity_type VARCHAR(60),
        maturity_stage VARCHAR(60),
        revenue_range VARCHAR(60),
        employee_count VARCHAR(60),
        financial_goals TEXT,
        country VARCHAR(120),
        incorporation_location VARCHAR(160),
        onboarding_completed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    // Add columns to pre-existing tables (CREATE TABLE IF NOT EXISTS won't).
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS country VARCHAR(120)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS incorporation_location VARCHAR(160)`);
  }

  async getBusiness(userId: string): Promise<BusinessProfile> {
    const result = await this.database.query('SELECT * FROM business_profiles WHERE user_id = $1', [userId]);
    return result.rows[0] ? this.mapBusiness(result.rows[0]) : {};
  }

  async upsertBusiness(userId: string, data: BusinessProfile): Promise<BusinessProfile> {
    const query = `
      INSERT INTO business_profiles (
        user_id, business_name, business_type, industry, niche, entity_type,
        maturity_stage, revenue_range, employee_count, financial_goals,
        country, incorporation_location,
        onboarding_completed, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        business_name = COALESCE(EXCLUDED.business_name, business_profiles.business_name),
        business_type = COALESCE(EXCLUDED.business_type, business_profiles.business_type),
        industry = COALESCE(EXCLUDED.industry, business_profiles.industry),
        niche = COALESCE(EXCLUDED.niche, business_profiles.niche),
        entity_type = COALESCE(EXCLUDED.entity_type, business_profiles.entity_type),
        maturity_stage = COALESCE(EXCLUDED.maturity_stage, business_profiles.maturity_stage),
        revenue_range = COALESCE(EXCLUDED.revenue_range, business_profiles.revenue_range),
        employee_count = COALESCE(EXCLUDED.employee_count, business_profiles.employee_count),
        financial_goals = COALESCE(EXCLUDED.financial_goals, business_profiles.financial_goals),
        country = COALESCE(EXCLUDED.country, business_profiles.country),
        incorporation_location = COALESCE(EXCLUDED.incorporation_location, business_profiles.incorporation_location),
        onboarding_completed = business_profiles.onboarding_completed OR EXCLUDED.onboarding_completed,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await this.database.query(query, [
      userId,
      data.businessName ?? null,
      data.businessType ?? null,
      data.industry ?? null,
      data.niche ?? null,
      data.entityType ?? null,
      data.maturityStage ?? null,
      data.revenueRange ?? null,
      data.employeeCount ?? null,
      data.financialGoals ?? null,
      data.country ?? null,
      data.incorporationLocation ?? null,
      data.onboardingCompleted ?? false
    ]);
    return this.mapBusiness(result.rows[0]);
  }

  private mapBusiness(row: any): BusinessProfile {
    return {
      businessName: row.business_name ?? undefined,
      businessType: row.business_type ?? undefined,
      industry: row.industry ?? undefined,
      niche: row.niche ?? undefined,
      entityType: row.entity_type ?? undefined,
      maturityStage: row.maturity_stage ?? undefined,
      revenueRange: row.revenue_range ?? undefined,
      employeeCount: row.employee_count ?? undefined,
      financialGoals: row.financial_goals ?? undefined,
      country: row.country ?? undefined,
      incorporationLocation: row.incorporation_location ?? undefined,
      onboardingCompleted: row.onboarding_completed ?? false
    };
  }

  async updateName(userId: string, data: { firstName?: string; lastName?: string }): Promise<{ firstName: string; lastName: string }> {
    const user = await this.users.update(userId, {
      firstName: data.firstName,
      lastName: data.lastName
    });
    if (!user) {
      throw new Error('User not found');
    }
    return { firstName: user.firstName, lastName: user.lastName };
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
