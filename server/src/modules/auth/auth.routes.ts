import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';

interface AuthRoutesOptions extends FastifyPluginOptions {
  database?: Database;
}

export async function authRoutes(fastify: FastifyInstance, options: AuthRoutesOptions) {
  const database = options.database || new Database();
  const authService = new AuthService(database);
  const authController = new AuthController(authService);

  // Tight per-IP limits on the sensitive endpoints (brute force, enumeration,
  // email/credential spam), overriding the generous global limit. The refresh
  // endpoint stays on the global limit — active sessions call it routinely.
  const limit = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 minute' } } });

  fastify.post('/register', limit(5), authController.register.bind(authController));
  fastify.post('/login', limit(10), authController.login.bind(authController));
  fastify.post('/refresh', authController.refreshToken.bind(authController));
  fastify.post('/logout', authController.logout.bind(authController));
  fastify.post('/forgot-password', limit(5), authController.forgotPassword.bind(authController));
  fastify.post('/reset-password', limit(10), authController.resetPassword.bind(authController));
  fastify.post('/verify-email', limit(20), authController.verifyEmail.bind(authController));
  fastify.post('/resend-verification', limit(3), authController.resendVerification.bind(authController));

  // Second step of login for a 2FA-enabled account — brute-forceable (a
  // 6-digit code), so it's tightly rate-limited like login itself.
  fastify.post('/2fa/verify', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, authController.twoFactorLoginVerify.bind(authController));

  // Enrollment/disable act on the SIGNED-IN user's own account, so brute
  // force doesn't apply the same way — just the global rate limit.
  fastify.post('/2fa/setup', { preHandler: [authenticate] }, authController.twoFactorSetup.bind(authController) as any);
  fastify.post('/2fa/confirm', { preHandler: [authenticate] }, authController.twoFactorConfirm.bind(authController) as any);
  fastify.post('/2fa/disable', { preHandler: [authenticate] }, authController.twoFactorDisable.bind(authController) as any);
}