import { Database } from '../../infrastructure/database';
import { BusinessProfile, CurrentUserResponse, UserProfile, UserSettingsPayload } from './profile.types';
import { ensureGoalForPrimaryGoal } from './onboarding-goal';
import { PasswordManager } from '../auth/password';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { DEFAULT_BUSINESS_NAME } from '../auth/auth.service';

export interface ProfileRepositoryPort {
  getMe(userId: string): Promise<CurrentUserResponse>;
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload>;
  updateName(userId: string, data: { firstName?: string; lastName?: string }): Promise<{ firstName: string; lastName: string }>;
  getBusiness(userId: string): Promise<BusinessProfile>;
  upsertBusiness(userId: string, data: BusinessProfile): Promise<BusinessProfile>;
  getPasswordHash(userId: string): Promise<string | null>;
  deleteAccount(userId: string): Promise<boolean>;
}

export class ProfileService {
  private passwordManager = new PasswordManager();

  /**
   * `database` is optional so existing tests can construct the service with a
   * repository alone; without it, the auto-created goal is simply skipped.
   */
  constructor(private repository: ProfileRepositoryPort, private database?: Database) {}

  /**
   * Permanently deletes the account. Requires the current password again —
   * otherwise a hijacked, already-open session could destroy the account (and,
   * via cascade, the whole business's financial history) with no further proof
   * of identity.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    if (!password) throw new Error('Missing password');
    const passwordHash = await this.repository.getPasswordHash(userId);
    if (!passwordHash) throw new Error('User not found');
    const valid = await this.passwordManager.verify(password, passwordHash);
    if (!valid) throw new Error('Incorrect password');
    await this.repository.deleteAccount(userId);
  }

  async getMe(userId: string): Promise<CurrentUserResponse> {
    return this.repository.getMe(userId);
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    if (data.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.companyEmail)) {
      throw new Error('Invalid company email');
    }

    if (data.linkedin && !/^https?:\/\/.+/i.test(data.linkedin)) {
      throw new Error('Invalid LinkedIn URL');
    }

    return this.repository.updateProfile(userId, data);
  }

  async getBusiness(userId: string): Promise<BusinessProfile> {
    return this.repository.getBusiness(userId);
  }

  async updateBusiness(userId: string, data: BusinessProfile): Promise<BusinessProfile> {
    const profile = await this.repository.upsertBusiness(userId, data);

    // Registration creates the workspace before anyone has said what the
    // business is called, so it starts as a placeholder. This is the first
    // moment we learn the real name — without it the label stays "My Business"
    // for the life of the account, since the old ensureSchema backfill that used
    // to supply it now finds the row already present and skips it.
    //
    // Only the untouched placeholder is renamed: a name set deliberately in the
    // workspace switcher must survive a later onboarding edit.
    if (this.database && profile.businessName?.trim()) {
      try {
        const businesses = new BusinessesRepository(this.database);
        const owned = await businesses.listForUser(userId);
        const primary = owned[0];
        if (primary && primary.name === DEFAULT_BUSINESS_NAME) {
          await businesses.rename(primary.id, profile.businessName.trim());
        }
      } catch {
        /* the profile is what must be saved; a stale workspace label is cosmetic */
      }
    }

    // Section 9: their chosen primary goal becomes a real goal on the dashboard.
    // Saving the profile is the thing that must succeed here — if the goal can't
    // be created, the user still gets their profile saved and simply has no
    // starter goal, which they can add by hand.
    if (this.database) {
      try {
        await ensureGoalForPrimaryGoal(this.database, userId, profile);
      } catch {
        /* a missing starter goal is not worth failing onboarding over */
      }
    }

    return profile;
  }

  async updateName(userId: string, data: { firstName?: string; lastName?: string }): Promise<{ firstName: string; lastName: string }> {
    if (data.firstName !== undefined && !data.firstName.trim()) {
      throw new Error('Invalid first name');
    }
    if (data.lastName !== undefined && !data.lastName.trim()) {
      throw new Error('Invalid last name');
    }
    if (data.firstName === undefined && data.lastName === undefined) {
      throw new Error('Invalid name update');
    }

    return this.repository.updateName(userId, {
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim()
    });
  }

  async updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload> {
    const frequency = data.notifications?.frequency;
    if (frequency && !['immediate', 'hourly', 'daily', 'weekly'].includes(String(frequency))) {
      throw new Error('Invalid notification frequency');
    }

    return this.repository.updateSettings(userId, data);
  }
}
