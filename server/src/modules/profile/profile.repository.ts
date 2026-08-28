import { Database } from '../../infrastructure/database';
import { deleteUserAccount } from '../shared/delete-user-account';
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

  /** For the delete-account password confirmation — never exposed in an API response. */
  async getPasswordHash(userId: string): Promise<string | null> {
    const user = await this.users.findById(userId);
    return user?.passwordHash ?? null;
  }

  /**
   * Permanently deletes the user, their business and its whole financial
   * history — irreversible by design. See `deleteUserAccount` for why the
   * ledger has to be torn down in a specific order; the admin panel's delete
   * goes through the same function.
   */
  async deleteAccount(userId: string): Promise<boolean> {
    return deleteUserAccount(this.database, userId);
  }

  async getMe(userId: string): Promise<CurrentUserResponse> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const profileResult = await this.database.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
    const settingsResult = await this.database.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    const verifiedResult = await this.database.query('SELECT email_verified, totp_enabled FROM users WHERE id = $1', [userId]);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: !!verifiedResult.rows[0]?.email_verified,
      twoFactorEnabled: !!verifiedResult.rows[0]?.totp_enabled,
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
    // Branding + contact details — these fill the invoice header.
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT`);
    /**
     * `updateProfile` upserts with ON CONFLICT (user_id), which Postgres will
     * only accept if a unique index on that column actually exists. Without one
     * it raises 42P10 and every profile save returns a 500 — the same trap this
     * codebase already hit on business_profiles.
     *
     * Guarded rather than assumed, and tolerant of failure: if duplicate rows
     * exist the index cannot be created, and that must be a logged problem
     * rather than a server that refuses to boot.
     */
    try {
      await this.database.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles (user_id)`
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[profile] could not ensure user_profiles(user_id) is unique:', error);
    }

    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(200)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(200)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(120)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS region VARCHAR(120)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS postal_code VARCHAR(40)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_email VARCHAR(320)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_phone VARCHAR(40)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website VARCHAR(255)`);
    // Section 9 — signup questions that feed the Health Score and Finna.
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS has_debt VARCHAR(20)`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(60)`);
    // Company Brain overview card — when the business started, and how it
    // describes itself. Neither was asked at onboarding, so both are edited in
    // place on the card and stay null until the user fills them in.
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS founded_date DATE`);
    await this.database.query(`ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS description TEXT`);

    // ---- Re-key from one profile per USER to one per BUSINESS ----------------
    //
    // The table was keyed by user_id, so an account with several workspaces had
    // a single shared profile: switching workspace kept the same name, industry
    // and logo, and editing one changed all of them. Every other business fact
    // in the product is scoped by business_id; this now matches.
    //
    // user_id is deliberately KEPT and still populated. The admin panel and the
    // members list join on it, and dropping it would break both.
    await this.database.query(
      `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_id UUID
         REFERENCES businesses(id) ON DELETE CASCADE`
    );

    // Existing rows adopt that owner's earliest workspace — the one their data
    // was actually describing.
    await this.database.query(`
      UPDATE business_profiles bp
         SET business_id = (
           SELECT b.id FROM businesses b
            WHERE b.owner_id = bp.user_id
            ORDER BY b.created_at LIMIT 1
         )
       WHERE bp.business_id IS NULL
    `);

    // One row per user was enforced by the primary key; it now has to allow
    // several, one per workspace.
    await this.database.query(`ALTER TABLE business_profiles DROP CONSTRAINT IF EXISTS business_profiles_pkey`);
    await this.database.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_business_profiles_business
         ON business_profiles(business_id) WHERE business_id IS NOT NULL`
    );
    await this.database.query(
      `CREATE INDEX IF NOT EXISTS idx_business_profiles_user ON business_profiles(user_id)`
    );

    // Give every other workspace its own copy of the owner's profile, so the
    // split is invisible until someone edits one: nothing suddenly looks blank,
    // and nobody gets bounced back into onboarding because their second
    // workspace has no `onboarding_completed`.
    await this.database.query(`
      INSERT INTO business_profiles (
        business_id, user_id, business_name, business_type, industry, niche, entity_type,
        maturity_stage, revenue_range, employee_count, financial_goals, country,
        incorporation_location, onboarding_completed, logo_url, address_line1, address_line2,
        city, region, postal_code, business_email, business_phone, website,
        has_debt, primary_goal, founded_date, description, created_at, updated_at
      )
      SELECT b.id, src.user_id, src.business_name, src.business_type, src.industry, src.niche,
             src.entity_type, src.maturity_stage, src.revenue_range, src.employee_count,
             src.financial_goals, src.country, src.incorporation_location, src.onboarding_completed,
             src.logo_url, src.address_line1, src.address_line2, src.city, src.region,
             src.postal_code, src.business_email, src.business_phone, src.website,
             src.has_debt, src.primary_goal, src.founded_date, src.description, NOW(), NOW()
        FROM businesses b
        CROSS JOIN LATERAL (
          SELECT * FROM business_profiles p
           WHERE p.user_id = b.owner_id
           ORDER BY p.business_id NULLS LAST
           LIMIT 1
        ) src
       WHERE NOT EXISTS (SELECT 1 FROM business_profiles x WHERE x.business_id = b.id)
    `);
  }

  /**
   * The profile for one workspace, and only that workspace.
   *
   * There is deliberately NO fallback to another of the user's rows. An earlier
   * version fell back to "any profile this user owns" as a safety net for
   * businesses that missed the backfill, and that was itself the leak: a
   * workspace with no profile of its own — a newly created one, say — displayed
   * another workspace's name, industry and logo, which then got saved back onto
   * it. A workspace without a profile is simply blank, which is the truth.
   */
  async getBusiness(businessId: string): Promise<BusinessProfile> {
    const result = await this.database.query(
      'SELECT * FROM business_profiles WHERE business_id = $1', [businessId]
    );
    return result.rows[0] ? this.mapBusiness(result.rows[0]) : {};
  }

  async upsertBusiness(businessId: string, userId: string, data: BusinessProfile): Promise<BusinessProfile> {
    const query = `
      INSERT INTO business_profiles (
        business_id, user_id, business_name, business_type, industry, niche, entity_type,
        maturity_stage, revenue_range, employee_count, financial_goals,
        country, incorporation_location,
        logo_url, address_line1, address_line2, city, region, postal_code,
        business_email, business_phone, website,
        has_debt, primary_goal,
        onboarding_completed, founded_date, description, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW(),NOW())
      ON CONFLICT (business_id) WHERE business_id IS NOT NULL DO UPDATE SET
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
        logo_url = COALESCE(EXCLUDED.logo_url, business_profiles.logo_url),
        address_line1 = COALESCE(EXCLUDED.address_line1, business_profiles.address_line1),
        address_line2 = COALESCE(EXCLUDED.address_line2, business_profiles.address_line2),
        city = COALESCE(EXCLUDED.city, business_profiles.city),
        region = COALESCE(EXCLUDED.region, business_profiles.region),
        postal_code = COALESCE(EXCLUDED.postal_code, business_profiles.postal_code),
        business_email = COALESCE(EXCLUDED.business_email, business_profiles.business_email),
        business_phone = COALESCE(EXCLUDED.business_phone, business_profiles.business_phone),
        website = COALESCE(EXCLUDED.website, business_profiles.website),
        has_debt = COALESCE(EXCLUDED.has_debt, business_profiles.has_debt),
        primary_goal = COALESCE(EXCLUDED.primary_goal, business_profiles.primary_goal),
        onboarding_completed = business_profiles.onboarding_completed OR EXCLUDED.onboarding_completed,
        founded_date = COALESCE(EXCLUDED.founded_date, business_profiles.founded_date),
        description = COALESCE(EXCLUDED.description, business_profiles.description),
        updated_at = NOW()
      RETURNING *
    `;
    const result = await this.database.query(query, [
      businessId,
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
      data.logoUrl ?? null,
      data.addressLine1 ?? null,
      data.addressLine2 ?? null,
      data.city ?? null,
      data.region ?? null,
      data.postalCode ?? null,
      data.businessEmail ?? null,
      data.businessPhone ?? null,
      data.website ?? null,
      data.hasDebt ?? null,
      data.primaryGoal ?? null,
      data.onboardingCompleted ?? false,
      // An empty string would fail the DATE cast; treat "cleared" as null.
      data.foundedDate || null,
      data.description ?? null
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
      hasDebt: row.has_debt ?? undefined,
      primaryGoal: row.primary_goal ?? undefined,
      employeeCount: row.employee_count ?? undefined,
      financialGoals: row.financial_goals ?? undefined,
      country: row.country ?? undefined,
      incorporationLocation: row.incorporation_location ?? undefined,
      logoUrl: row.logo_url ?? undefined,
      addressLine1: row.address_line1 ?? undefined,
      addressLine2: row.address_line2 ?? undefined,
      city: row.city ?? undefined,
      region: row.region ?? undefined,
      postalCode: row.postal_code ?? undefined,
      businessEmail: row.business_email ?? undefined,
      businessPhone: row.business_phone ?? undefined,
      website: row.website ?? undefined,
      // pg returns DATE as a Date object; the client wants a plain YYYY-MM-DD.
      foundedDate: row.founded_date
        ? new Date(row.founded_date).toISOString().slice(0, 10)
        : undefined,
      description: row.description ?? undefined,
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
