import { CurrentUserResponse, UserProfile, UserSettingsPayload } from './profile.types';

export interface ProfileRepositoryPort {
  getMe(userId: string): Promise<CurrentUserResponse>;
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload>;
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

  async updateSettings(userId: string, data: UserSettingsPayload): Promise<UserSettingsPayload> {
    const frequency = data.notifications?.frequency;
    if (frequency && !['immediate', 'hourly', 'daily', 'weekly'].includes(String(frequency))) {
      throw new Error('Invalid notification frequency');
    }

    return this.repository.updateSettings(userId, data);
  }
}
