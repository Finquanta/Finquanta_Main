import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  PORT: process.env.PORT || '3001',
  HOST: process.env.HOST || '0.0.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database (if needed later)
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT (if needed later)
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',

  // API Keys
  API_KEY: process.env.API_KEY,
};