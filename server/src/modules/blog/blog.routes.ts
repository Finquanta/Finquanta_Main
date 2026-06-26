import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { BlogRepository } from './blog.repository';

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER];

/** Allow only admin / super_admin / owner. Run after `authenticate`. */
function requireAdmin(database: Database) {
  const users = new UserRepository(database);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authed = request as AuthenticatedRequest;
    const id = authed.user?.id;
    if (!id) return reply.status(401).send({ success: false, error: 'Authentication required' });
    const user = await users.findById(id);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
  };
}

export async function blogRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new BlogRepository(options.database);
  const admin = [authenticate, requireAdmin(options.database)];

  // Public: list published posts
  fastify.get('/v1/blog', (async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listPublished() });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Public: a single published post by slug
  fastify.get('/v1/blog/:slug', (async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      const post = await repo.getBySlug(slug);
      if (!post || !post.published) return reply.status(404).send({ success: false, error: 'Post not found' });
      return reply.send({ success: true, data: post });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Admin: list all posts (including drafts)
  fastify.get('/v1/admin/blog', { preHandler: admin }, (async (_request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listAll() });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Admin: create a post
  fastify.post('/v1/admin/blog', { preHandler: admin }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const b = request.body as { title?: string; excerpt?: string; content?: string; coverImageUrl?: string | null; published?: boolean };
      if (!b?.title || !b.title.trim()) return reply.status(400).send({ success: false, error: 'Title is required' });
      const author = `${(request.user as any)?.firstName ?? ''}`.trim() || request.user!.email || null;
      const post = await repo.create({
        title: b.title.trim(), excerpt: b.excerpt, content: b.content,
        coverImageUrl: b.coverImageUrl, published: b.published, authorName: author,
      });
      return reply.status(201).send({ success: true, data: post });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Admin: update a post
  fastify.patch('/v1/admin/blog/:id', { preHandler: admin }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const b = request.body as { title?: string; excerpt?: string; content?: string; coverImageUrl?: string | null; published?: boolean };
      const post = await repo.update(id, b);
      if (!post) return reply.status(404).send({ success: false, error: 'Post not found' });
      return reply.send({ success: true, data: post });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  // Admin: delete a post
  fastify.delete('/v1/admin/blog/:id', { preHandler: admin }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await repo.remove(id);
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
