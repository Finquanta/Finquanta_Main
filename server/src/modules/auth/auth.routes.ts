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

  fastify.post('/register', authController.register.bind(authController));

  fastify.post('/login', authController.login.bind(authController));

  fastify.post('/refresh', authController.refreshToken.bind(authController));
}