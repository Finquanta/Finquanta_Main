// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/Finquanta_ai_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.PORT = '3001';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW = '90000';