import { buildNativeTestServer } from '../../../src/tests/server-native';
import request from 'supertest';

// The breached-password check calls the HaveIBeenPwned range API over the
// network. It fails open, so these tests pass offline and fail the moment the
// machine has internet — 'Password123!' really is in the corpus. Stub it so the
// suite is deterministic either way; the check itself is covered separately.
jest.mock('../../../src/infrastructure/pwned', () => ({
  isPasswordPwned: jest.fn().mockResolvedValue(false),
}));

// register and login both verify a Turnstile token, and verifyTurnstile returns
// false for a missing one in every environment before posting to Cloudflare.
// These tests exercise the controller, not the captcha, so the check is stubbed
// rather than every request being given a fake token that Cloudflare would
// reject anyway.
jest.mock('../../../src/infrastructure/turnstile', () => ({
  verifyTurnstile: jest.fn().mockResolvedValue(true),
}));


/**
 * Registration now requires a date of birth (minimum age 16) and explicit
 * acceptance of all three legal agreements, so every fixture that registers has
 * to carry them. Computed rather than hardcoded so it can't age across the
 * limit as years pass.
 */
const signupRequirements = {
  dateOfBirth: new Date(
    new Date().setFullYear(new Date().getFullYear() - 30)
  ).toISOString().slice(0, 10),
  acceptedTerms: true,
  acceptedPrivacy: true,
  acceptedRisk: true
};

describe('AuthController', () => {
  let server: any;
  let baseUrl: string;
  let close: () => Promise<void>;
  let mockDatabase: any;

  beforeAll(async () => {
    const testServer = await buildNativeTestServer();
    server = testServer.server;
    baseUrl = `http://localhost:${testServer.port}`;
    close = testServer.close;
    mockDatabase = testServer.database;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    // Clear the mock database before each test to ensure clean state
    mockDatabase.clearUsers();
  });

  describe('POST /api/v1/auth/register', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      ...signupRequirements
    };

    it('should register a new user successfully', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(validUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(validUser.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email registration', async () => {
      // First registration should succeed
      await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(validUser)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(validUser)
        // 409 would be the more precise status for a duplicate, but register
        // deliberately answers 400 for everything the user can fix — weak
        // password, duplicate email, under-age — and the frontend reads that.
        // Changing the contract to satisfy this assertion would be the tail
        // wagging the dog; the assertion is what was stale.
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Email already exists');
    });

    it('should reject invalid email format', async () => {
      const invalidUser = {
        ...validUser,
        email: 'invalid-email'
      };

      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject weak passwords', async () => {
      const invalidUser = {
        ...validUser,
        password: '123' // Too short and weak
      };

      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing required fields', async () => {
      const incompleteUser = {
        email: validUser.email
        // Missing password, firstName, lastName
      };

      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(incompleteUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const testUser = {
      email: 'logintest@example.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Smith',
      ...signupRequirements
    };

    beforeEach(async () => {
      // Register a user for login tests
      await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with invalid email', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email
          // Missing password
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      const testUser = {
        email: 'refreshtest@example.com',
        password: 'Password123!',
        firstName: 'Refresh',
        lastName: 'User',
        ...signupRequirements
      };

      const registerResponse = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send(testUser);

      refreshToken = registerResponse.body.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid refresh token');
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Authentication Endpoints Security', () => {
    it('should reject malformed JSON requests', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle empty request body', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should have proper CORS headers', async () => {
      const response = await request(baseUrl)
        .post('/api/v1/auth/register')
        .send({
          email: 'cors@example.com',
          password: 'Password123!',
          firstName: 'CORS',
          lastName: 'Test',
          ...signupRequirements
        });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});