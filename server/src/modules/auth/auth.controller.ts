import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, RegisterData, LoginData, RefreshTokenData, VerificationError } from './auth.service';

/**
 * Registration failures the CALLER can fix, as thrown by AuthService.register.
 * Matched on the thrown message because the service throws plain Errors; if
 * those messages change, change these with them.
 */
const USER_FIXABLE = [
  'Password must',
  'Email already exists',
  'You must be at least',
  'valid date of birth',
  'You must accept',
];

const isUserFixable = (msg: string) => USER_FIXABLE.some((m) => msg.includes(m));

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userData = request.body as RegisterData;

      // Basic validation
      if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
        return reply.status(400).send({
          error: 'Missing required fields: email, password, firstName, lastName'
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        return reply.status(400).send({
          error: 'Invalid email format'
        });
      }

      const result = await this.authService.register(userData);
      return reply.status(201).send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Things the user can fix (weak password, duplicate email, too young) are
      // 400s, not 500s. They were all reported as "Internal server error", which
      // is both wrong and alarming — nothing is broken when someone picks a
      // password without a special character.
      if (isUserFixable(msg)) {
        console.warn('REGISTER REJECTED:', msg);
        return reply.status(400).send({ error: msg, detail: msg });
      }

      console.error('REGISTER ERROR:', msg);
      return reply.status(500).send({
        error: 'Internal server error',
        detail: msg
      });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const loginData = request.body as LoginData;

      // Basic validation
      if (!loginData.email || !loginData.password) {
        return reply.status(400).send({
          error: 'Missing required fields: email, password'
        });
      }

      const result = await this.authService.login(loginData);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        return reply.status(401).send({
          error: error.message
        });
      }

      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const { email } = (request.body as { email?: string }) || {};
    try {
      if (email) {
        await this.authService.requestPasswordReset(email);
      }
    } catch (error) {
      // Log but still return success — never reveal whether the email exists,
      // and don't surface email-provider hiccups to the caller.
      console.error('FORGOT PASSWORD ERROR:', error instanceof Error ? error.message : String(error));
    }
    // Always the same response regardless of whether the account exists.
    return reply.status(200).send({ success: true });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token, password } = (request.body as { token?: string; password?: string }) || {};
      if (!token || !password) {
        return reply.status(400).send({ error: 'Missing required fields: token, password' });
      }
      await this.authService.resetPassword(token, password);
      return reply.status(200).send({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not reset password';
      return reply.status(400).send({ error: msg });
    }
  }

  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = (request.body as { token?: string }) || {};
      if (!token) return reply.status(400).send({ error: 'Missing verification token', reason: 'invalid' });
      const status = await this.authService.verifyEmail(token);
      // 'verified' = we just confirmed it; 'already' = a prior hit (user, refresh,
      // or an email link-scanner) confirmed it — both are a success to the user.
      return reply.status(200).send({ success: true, status });
    } catch (error) {
      const reason = error instanceof VerificationError ? error.reason : 'invalid';
      const msg = error instanceof Error ? error.message : 'Could not verify email';
      return reply.status(400).send({ error: msg, reason });
    }
  }

  async resendVerification(request: FastifyRequest, reply: FastifyReply) {
    const { email } = (request.body as { email?: string }) || {};
    let status: 'sent' | 'already_verified' | 'unknown' = 'sent';
    try {
      if (email) status = await this.authService.resendVerification(email);
    } catch (error) {
      console.error('RESEND VERIFICATION ERROR:', error instanceof Error ? error.message : String(error));
    }
    // We surface 'already_verified' so a confirmed user is told to just log in
    // instead of waiting on an email that will never come. 'unknown' is reported
    // as 'sent' so we don't reveal which addresses are registered-but-unverified.
    return reply.status(200).send({ success: true, status: status === 'unknown' ? 'sent' : status });
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const refreshData = request.body as RefreshTokenData;

      // Basic validation
      if (!refreshData.refreshToken) {
        return reply.status(400).send({
          error: 'Missing required field: refreshToken'
        });
      }

      const result = await this.authService.refreshToken(refreshData);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid refresh token') {
        return reply.status(401).send({
          error: error.message
        });
      }

      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  }
}