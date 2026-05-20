import { ProfileService } from '../../../src/modules/profile/profile.service';

describe('ProfileService', () => {
  const repository = {
    getMe: jest.fn(),
    updateProfile: jest.fn(),
    updateSettings: jest.fn()
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns account, profile, and settings for current user', async () => {
    repository.getMe.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'user',
      profile: { company: 'Analytical Engines' },
      settings: { language: { language: 'en' } }
    });

    const service = new ProfileService(repository);
    const result = await service.getMe('user-1');

    expect(result.email).toBe('a@example.com');
    expect(result.profile.company).toBe('Analytical Engines');
  });

  it('rejects invalid notification frequency', async () => {
    const service = new ProfileService(repository);

    await expect(service.updateSettings('user-1', {
      notifications: { frequency: 'every-second' }
    })).rejects.toThrow('Invalid notification frequency');
  });
});
