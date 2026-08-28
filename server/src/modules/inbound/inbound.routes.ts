import { FastifyInstance, FastifyReply } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { InboundRepository } from './inbound.repository';
import { CaptureRepository } from '../capture/capture.repository';
import { SENDER_STATUSES, SenderStatus, addressFor, normaliseEmail } from './inbound.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Inbound email — the authenticated half.
 *
 * The webhook is a separate plugin (it needs a raw body and has no session).
 * These are the ordinary workspace-scoped routes behind them: what my address
 * is, who I accept mail from, and what has arrived.
 */
export async function inboundRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new InboundRepository(options.database);
  const captures = new CaptureRepository(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  // Registered AFTER the capture module, because ensureSchema adds a column to
  // `document_captures` and cannot do that before the table exists.
  await repo.ensureSchema();

  /** The workspace's address, minted on first ask. */
  fastify.get('/v1/inbound/address', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const address = await repo.ensureAddress(request.businessId!);
      return reply.send({ success: true, data: { ...address, email: addressFor(address) } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read your email address.' });
    }
  }) as any);

  /**
   * Burn it and mint a new one.
   *
   * The whole reason this exists: the address ends up forwarded, pasted into a
   * supplier portal, or on a mailing list, and the only real remedy is a new
   * one. Mail to the old address stops being accepted immediately.
   */
  fastify.post('/v1/inbound/address/rotate', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const address = await repo.rotateAddress(request.businessId!);
      return reply.send({ success: true, data: { ...address, email: addressFor(address) } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not change your email address.' });
    }
  }) as any);

  /** What has arrived, newest first. */
  fastify.get('/v1/inbound/messages', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { limit } = (request.query ?? {}) as { limit?: string };
      const messages = await repo.listMessages(request.businessId!, Number(limit) || 50);
      return reply.send({ success: true, data: messages });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read your email inbox.' });
    }
  }) as any);

  /** Captures still waiting to be reviewed — what the queue badge counts. */
  fastify.get('/v1/inbound/pending', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const pending = await captures.listPendingFromEmail(request.businessId!);
      return reply.send({ success: true, data: pending });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read your review queue.' });
    }
  }) as any);

  /**
   * Just the number, for the header icon.
   *
   * `/pending` returns up to a hundred captures with their extracted fields —
   * fine for the queue, wasteful for a badge that renders one digit on every
   * dashboard load.
   */
  fastify.get('/v1/inbound/pending/count', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: { count: await captures.countPendingFromEmail(request.businessId!) } });
    } catch (error) {
      request.log.error(error);
      // A badge is not worth an error state; it simply does not show.
      return reply.send({ success: true, data: { count: 0 } });
    }
  }) as any);

  fastify.get('/v1/inbound/senders', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await repo.listSenders(request.businessId!) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read your sender list.' });
    }
  }) as any);

  /**
   * Trust or block a sender.
   *
   * Trusting is what releases quarantined mail from that address in future —
   * deliberately forward-looking only. Retro-processing everything a sender has
   * ever sent would turn one click into an unbounded pile of AI calls and a
   * queue full of months-old documents.
   */
  fastify.post('/v1/inbound/senders', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const body = (request.body ?? {}) as { email?: string; status?: string };
      const email = normaliseEmail(body.email ?? '');
      if (!email || !email.includes('@')) {
        return reply.status(400).send({ success: false, error: 'That is not an email address.' });
      }
      if (!(SENDER_STATUSES as readonly string[]).includes(body.status ?? '')) {
        return reply.status(400).send({ success: false, error: 'Status must be trusted or blocked.' });
      }

      await repo.setSenderStatus(
        request.businessId!,
        email,
        body.status as SenderStatus,
        request.user!.id
      );
      return reply.send({ success: true, data: { email, status: body.status } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not update that sender.' });
    }
  }) as any);
}
