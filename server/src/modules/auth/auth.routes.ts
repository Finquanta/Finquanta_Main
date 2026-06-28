import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Database } from '../../infrastructure/database';

interface AuthRoutesOptions extends FastifyPluginOptions {
  database?: Database;
}

export async function authRoutes(fastify: FastifyInstance, options: AuthRoutesOptions) {
  const database = options.database || new Database();
  const authService = new AuthService(database);
  const authController = new AuthController(authService);

  // Routes without schemas for debugging
  fastify.post('/register', authController.register.bind(authController));
  fastify.post('/login', authController.login.bind(authController));
  fastify.post('/refresh', authController.refreshToken.bind(authController));
  fastify.post('/forgot-password', authController.forgotPassword.bind(authController));
  fastify.post('/reset-password', authController.resetPassword.bind(authController));
  fastify.post('/verify-email', authController.verifyEmail.bind(authController));
  fastify.post('/resend-verification', authController.resendVerification.bind(authController));
}