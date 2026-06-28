import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { NewsletterRepository } from './newsletter.repository';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function newsletterRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new NewsletterRepository(options.database);

  // Public — anyone on the landing page can subscribe to the newsletter.
  fastify.post('/v1/newsletter/subscribe', (async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as { email?: string; source?: string }) || {};
      const email = (body.email || '').trim().toLowerCase();
      if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
        return reply.status(400).send({ success: false, error: 'Please enter a valid email address.' });
      }
      const source = body.source === 'hero' ? 'hero' : 'newsletter';
      const created = await repo.subscribe(email, source);
      return reply.send({ success: true, data: { subscribed: true, alreadySubscribed: !created } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
