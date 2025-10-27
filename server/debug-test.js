const request = require('supertest');
const { buildTestServer } = require('./src/tests/server');

async function debugTest() {
  console.log('Starting debug test...');

  try {
    const server = await buildTestServer();
    console.log('Server built successfully');

    // Test a simple route
    console.log('Testing GET /api/v1/auth/register (should fail with 404/405)...');
    const response = await request(server.server)
      .get('/api/v1/auth/register')
      .expect(404);

    console.log('Route test passed:', response.status);

    await server.close();
    console.log('Server closed successfully');
  } catch (error) {
    console.error('Debug test failed:', error);
  }
}

debugTest();