import { FastifyInstance } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate } from '../shared/authenticate';
import { ProfileController } from './profile.controller';
import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';

export async function profileRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repository = new ProfileRepository(options.database);
  const service = new ProfileService(repository);
  const controller = new ProfileController(service);

  fastify.get('/v1/me', { preHandler: [authenticate] }, controller.getMe.bind(controller) as any);
  fastify.patch('/v1/me', { preHandler: [authenticate] }, controller.updateName.bind(controller) as any);
  fastify.patch('/v1/me/profile', { preHandler: [authenticate] }, controller.updateProfile.bind(controller) as any);
  fastify.patch('/v1/me/settings', { preHandler: [authenticate] }, controller.updateSettings.bind(controller) as any);
}
