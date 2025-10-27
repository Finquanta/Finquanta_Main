import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, RegisterData, LoginData, RefreshTokenData } from './auth.service';

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
      if (error instanceof Error) {
        if (error.message === 'Email already exists') {
          return reply.status(409).send({
            error: error.message
          });
        }
        if (error.message.includes('Password must')) {
          return reply.status(400).send({
            error: error.message
          });
        }
      }

      return reply.status(500).send({
        error: 'Internal server error'
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