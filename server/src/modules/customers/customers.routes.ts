import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { CustomersRepository, CustomerInput } from './customers.repository';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function customerRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new CustomersRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  fastify.get('/v1/customers', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.list(request.businessId!) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.get('/v1/customers/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const customer = await repo.getById(request.businessId!, id);
      if (!customer) return reply.status(404).send({ success: false, error: 'Customer not found' });
      return reply.send({ success: true, data: customer });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.post('/v1/customers', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body as CustomerInput) || ({} as CustomerInput);
      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, error: 'A customer name is required' });
      }
      if (body.email && !EMAIL_RE.test(body.email.trim())) {
        return reply.status(400).send({ success: false, error: 'Please enter a valid email address' });
      }
      const created = await repo.create(request.businessId!, body);
      return reply.status(201).send({ success: true, data: created });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.patch('/v1/customers/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body as Partial<CustomerInput>) || {};
      if (body.name !== undefined && !body.name?.trim()) {
        return reply.status(400).send({ success: false, error: 'A customer name is required' });
      }
      if (body.email && !EMAIL_RE.test(body.email.trim())) {
        return reply.status(400).send({ success: false, error: 'Please enter a valid email address' });
      }
      const updated = await repo.update(request.businessId!, id, body);
      if (!updated) return reply.status(404).send({ success: false, error: 'Customer not found' });
      return reply.send({ success: true, data: updated });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);

  fastify.delete('/v1/customers/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await repo.remove(request.businessId!, id);
      if (!ok) return reply.status(404).send({ success: false, error: 'Customer not found' });
      return reply.send({ success: true, data: { id } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }) as any);
}
