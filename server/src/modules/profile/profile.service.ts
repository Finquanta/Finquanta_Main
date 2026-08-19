import { Database } from '../../infrastructure/database';
import { BusinessProfile, CurrentUserResponse, UserProfile, UserSettingsPayload } from './profile.types';
import { ensureGoalForPrimaryGoal } from './onboarding-goal';
import { PasswordManager } from '../auth/password';
import { BusinessesRepository } from '../businesses/businesses.repository';
import { PLACEHOLDER_BUSINESS_NAMES } from '../auth/auth.service';
import {
  OwnedBusinessNeedingSuccessor, ownedBusinessesNeedingSuccessor, transferOwnership,
} from '../shared/transfer-ownership';

export interface ProfileRepositoryPort {
  getMe(userId: string): Promise<CurrentUserResponse>;
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload>;
  updateName(userId: string, data: { firstName?: string; lastName?: string }): Promise<{ firstName: string; lastName: string }>;
  getBusiness(businessId: string): Promise<BusinessProfile>;
  upsertBusiness(businessId: string, userId: string, data: BusinessProfile): Promise<BusinessProfile>;
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
  /**
   * Close an account.
   *
   * `successors` maps a business id to the member who should inherit it, and it
   * is REQUIRED for every workspace this user owns that other people are in.
   *
   * Deleting a user cascades their owned businesses and every ledger beneath
   * them, so without this a sole owner closing their account also erases four
   * colleagues' books — from a button labelled "delete my account", with
   * nothing on screen saying anyone else was affected. Refusing until somebody
   * is nominated is the only version of this that cannot destroy other
   * people's records by surprise.
   *
   * A workspace they own alone still goes with them. There is nobody to hand it
   * to, and taking it with you is what closing an account means.
   */
  async deleteAccount(
    userId: string,
    password: string,
    successors: Record<string, string> = {}
  ): Promise<void> {
    if (!password) throw new Error('Missing password');
    const passwordHash = await this.repository.getPasswordHash(userId);
    if (!passwordHash) throw new Error('User not found');
    const valid = await this.passwordManager.verify(password, passwordHash);
    if (!valid) throw new Error('Incorrect password');

    // Checked AFTER the password, so this cannot be used to enumerate somebody
    // else's workspaces with a guessed password.
    const needSuccessor = await this.deletionBlockers(userId);
    const missing = needSuccessor.filter((b: OwnedBusinessNeedingSuccessor) => !successors[b.id]);
    if (missing.length > 0) {
      const err = new Error('SUCCESSOR_REQUIRED') as Error & { businesses?: unknown };
      err.businesses = missing;
      throw err;
    }

    /**
     * Transfer BEFORE deleting, one workspace at a time.
     *
     * Each transfer is its own transaction, so a failure part-way leaves the
     * earlier workspaces safely re-owned and the account still standing —
     * recoverable. Deleting first and transferring after would be the opposite:
     * unrecoverable the moment anything went wrong.
     */
    for (const business of needSuccessor) {
      await transferOwnership(this.database!, business.id, successors[business.id]!);
    }

    await this.repository.deleteAccount(userId);
  }

  /**
   * Which owned workspaces need somebody nominated before this account can go.
   *
   * `database` is optional on this service (the profile unit tests construct it
   * without one), so an absent connection means no shared workspaces can be
   * checked — and with no connection there is no cascade to worry about either,
   * since deletion itself goes through the repository.
   */
  async deletionBlockers(userId: string): Promise<OwnedBusinessNeedingSuccessor[]> {
    if (!this.database) return [];
    return ownedBusinessesNeedingSuccessor(this.database, userId);
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

  async getBusiness(businessId: string): Promise<BusinessProfile> {
    return this.repository.getBusiness(businessId);
  }

  async updateBusiness(businessId: string, userId: string, data: BusinessProfile): Promise<BusinessProfile> {
    const profile = await this.repository.upsertBusiness(businessId, userId, data);

    // Registration creates the workspace before anyone has said what the
    // business is called, so it starts as a placeholder. This is the first
    // moment we learn the real name — without it the label stays "My Business"
    // for the life of the account, since the old ensureSchema backfill that used
    // to supply it now finds the row already present and skips it.
    //
    // Only the untouched placeholder is renamed: a name set deliberately in the
    // workspace switcher must survive a later onboarding edit.
    //
    // Now that profiles are per workspace, this renames the workspace being
    // edited rather than whichever one happens to be first — otherwise naming
    // your second business would relabel your first.
    if (this.database && profile.businessName?.trim()) {
      try {
        const businesses = new BusinessesRepository(this.database);
        const owned = await businesses.listForUser(userId);
        const active = owned.find((b) => b.id === businessId);
        // Membership, not equality: accounts created before the default became
        // 'My Finances' still hold 'My Business', and they must keep renaming.
        if (active && PLACEHOLDER_BUSINESS_NAMES.includes(active.name)) {
          await businesses.rename(active.id, profile.businessName.trim());
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
    /*
     * An empty last name is allowed, and rejecting it was a real bug.
     *
     * The name editor in the top bar is ONE field. It splits what you type on
     * whitespace: the first word becomes firstName, the rest lastName. Type a
     * single word — a mononym, or just your first name — and lastName is '',
     * which this used to reject as 'Invalid last name'. Both editors swallowed
     * the error silently, so the name simply snapped back with no explanation.
     *
     * Only firstName is required. Plenty of people go by one name, and someone
     * removing their surname has to be able to send an empty one to clear it —
     * omitting the field instead would leave the old surname in place.
     */
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
