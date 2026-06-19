import { CurrentUserResponse, UserProfile, UserSettingsPayload } from './profile.types';

export interface ProfileRepositoryPort {
  getMe(userId: string): Promise<CurrentUserResponse>;
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload>;
  updateName(userId: string, data: { firstName?: string; lastName?: string }): Promise<{ firstName: string; lastName: string }>;
}

export class ProfileService {
  constructor(private repository: ProfileRepositoryPort) {}

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
