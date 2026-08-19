import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { ProfileController } from './profile.controller';
import { ProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';

/** Business logos: PNG or JPEG only, and small enough to embed in an invoice. */
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB

export async function profileRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repository = new ProfileRepository(options.database);
  const service = new ProfileService(repository, options.database);
  const controller = new ProfileController(service);

  fastify.get('/v1/me', { preHandler: [authenticate] }, controller.getMe.bind(controller) as any);
  fastify.patch('/v1/me', { preHandler: [authenticate] }, controller.updateName.bind(controller) as any);
  fastify.patch('/v1/me/profile', { preHandler: [authenticate] }, controller.updateProfile.bind(controller) as any);
  // The business profile is per workspace now, so these three need the active
  // business resolved onto the request — `authenticate` alone is not enough.
  const withBiz = [authenticate, withBusiness(options.database)];
  fastify.get('/v1/me/business', { preHandler: withBiz }, controller.getBusiness.bind(controller) as any);
  fastify.put('/v1/me/business', { preHandler: withBiz }, controller.updateBusiness.bind(controller) as any);
  fastify.patch('/v1/me/settings', { preHandler: [authenticate] }, controller.updateSettings.bind(controller) as any);
  fastify.get('/v1/me/deletion-blockers', { preHandler: [authenticate] }, controller.deletionBlockers.bind(controller) as any);
  fastify.delete('/v1/me', { preHandler: [authenticate] }, controller.deleteAccount.bind(controller) as any);

  /**
   * Upload a business logo (PNG/JPEG) for the invoice header.
   *
   * The image is stored as a data URI on the business profile rather than as a
   * file on disk — a logo is small, it needs no separate serving route, and it
   * survives a redeploy (Render's filesystem is ephemeral).
   */
  fastify.post('/v1/me/business/logo', { preHandler: withBiz }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const file = await (request as any).file();
      if (!file) return reply.status(400).send({ success: false, error: 'No file uploaded' });

      if (!ALLOWED_LOGO_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ success: false, error: 'Logo must be a PNG or JPEG image' });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ success: false, error: 'Logo is too large (max 1MB)' });
        }
        throw err;
      }
      if ((file as any).truncated || buffer.length > MAX_LOGO_BYTES) {
        return reply.status(413).send({ success: false, error: 'Logo is too large (max 1MB)' });
      }

      const mime = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
      const logoUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      // Scoped to the active workspace, so each business can carry its own logo.
      const saved = await repository.upsertBusiness(request.businessId!, request.user!.id, { logoUrl });
      return reply.send({ success: true, data: saved });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not upload logo' });
    }
  }) as any);
}
