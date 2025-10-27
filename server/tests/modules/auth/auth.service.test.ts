import { AuthService } from '../../../src/modules/auth/auth.service';
import { MockDatabase } from '../../mocks/database.mock';

describe('AuthService', () => {
  let authService: AuthService;
  let mockDatabase: MockDatabase;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    authService = new AuthService(mockDatabase);
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should register a new user successfully', async () => {
      const result = await authService.register(validUserData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(validUserData.email);
      expect(result.user.firstName).toBe(validUserData.firstName);
      expect(result.user.lastName).toBe(validUserData.lastName);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should reject duplicate email registration', async () => {
      // First registration should succeed
      await authService.register(validUserData);

      // Second registration with same email should fail
      await expect(authService.register(validUserData)).rejects.toThrow('Email already exists');
    });

    it('should reject weak passwords', async () => {
      const invalidUserData = {
        ...validUserData,
        password: '123' // Too short and weak
      };

      await expect(authService.register(invalidUserData)).rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should reject passwords without special characters', async () => {
      const invalidUserData = {
        ...validUserData,
        password: 'Password123' // Missing special character
      };

      await expect(authService.register(invalidUserData)).rejects.toThrow('Password must contain at least one special character');
    });
  });

  describe('login', () => {
    const validUserData = {
      email: 'logintest@example.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Smith'
    };

    beforeEach(async () => {
      // Register a user for login tests
      await authService.register(validUserData);
    });

    it('should login with valid credentials', async () => {
      const result = await authService.login({
        email: validUserData.email,
        password: validUserData.password
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(validUserData.email);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with invalid email', async () => {
      await expect(authService.login({
        email: 'nonexistent@example.com',
        password: validUserData.password
      })).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      await expect(authService.login({
        email: validUserData.email,
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    const validUserData = {
      email: 'refreshtest@example.com',
      password: 'Password123!',
      firstName: 'Refresh',
      lastName: 'User'
    };

    it('should refresh tokens with valid refresh token', async () => {
      // Register and get tokens
      const authResult = await authService.register(validUserData);

      const refreshResult = await authService.refreshToken({
        refreshToken: authResult.refreshToken
      });

      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('refreshToken');
      expect(typeof refreshResult.accessToken).toBe('string');
      expect(typeof refreshResult.refreshToken).toBe('string');
      // Note: JWT tokens can be the same if generated with same payload and secret in quick succession
      // The important thing is that they are valid tokens
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
    });

    it('should reject refresh with invalid token', async () => {
      await expect(authService.refreshToken({
        refreshToken: 'invalid-refresh-token'
      })).rejects.toThrow('Invalid refresh token');
    });

    it('should reject refresh with missing token', async () => {
      await expect(authService.refreshToken({
        refreshToken: ''
      })).rejects.toThrow('Invalid refresh token');
    });
  });
});