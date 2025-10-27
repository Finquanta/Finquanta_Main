import { buildNativeTestServer } from '../../src/tests/server-native';
import request from 'supertest';

describe('Financial Transaction System Integration', () => {
  let server: any;
  let baseUrl: string;
  let close: () => Promise<void>;
  let authToken: string;

  beforeAll(async () => {
    const testServer = await buildNativeTestServer();
    server = testServer.server;
    baseUrl = `http://localhost:${testServer.port}`;
    close = testServer.close;

    // Register a user and get auth token
    const registerResponse = await request(baseUrl)
      .post('/api/v1/auth/register')
      .send({
        email: 'financial-test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      });

    authToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    await close();
  });

  describe('API Endpoints', () => {
    it('should access financial transaction endpoints', async () => {
      // Test create transaction endpoint exists
      const createResponse = await request(baseUrl)
        .post('/api/v1/financial/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'income',
          category: 'Salary',
          amount: 5000,
          date: '2024-01-01'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('success', true);
      expect(createResponse.body).toHaveProperty('data');
    });

    it('should retrieve transactions', async () => {
      // Test get transactions endpoint exists
      const getResponse = await request(baseUrl)
        .get('/api/v1/financial/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('success', true);
      expect(getResponse.body).toHaveProperty('data');
      expect(getResponse.body.data).toHaveProperty('transactions');
    });

    it('should require authentication for financial endpoints', async () => {
      // Test without auth token
      const response = await request(baseUrl)
        .get('/api/v1/financial/transactions');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle financial summary endpoint', async () => {
      // Test financial summary endpoint exists
      const response = await request(baseUrl)
        .get('/api/v1/financial/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('System Health', () => {
    it('should have financial endpoints registered', async () => {
      // Test that financial endpoints are properly registered
      const apiResponse = await request(baseUrl)
        .get('/api');

      expect(apiResponse.status).toBe(200);
      expect(apiResponse.body).toHaveProperty('message', 'Fiscal AI API Server');
    });

    it('should handle invalid financial endpoints gracefully', async () => {
      // Test invalid endpoint returns proper error
      const response = await request(baseUrl)
        .get('/api/v1/financial/invalid-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});