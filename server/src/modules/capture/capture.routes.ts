import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { authenticate, AuthenticatedRequest } from '../shared/authenticate';
import { withBusiness } from '../shared/business-context';
import { createStorageDriver, PostgresBlobDriver, StorageDriver } from '../../infrastructure/object-storage';
import { UsageService } from '../billing/usage.service';
import { AiUsageRepository } from '../ai-usage/ai-usage.repository';
import { observedAddress } from '../ai-usage/ai-usage.routes';
import { CaptureRepository } from './capture.repository';
import { HANDOFF_TTL_MINUTES, HandoffRepository } from './capture.handoff.repository';
import { ACCEPTED_TYPES, extractDocument } from './capture.extraction';
import { ingestDocument } from './capture.service';
import { DESTINATIONS, Destination, DocumentType, isDocumentType } from './capture.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Document Capture — photograph or upload a financial document and get a
 * pre-filled entry to review.
 *
 * THE CAP IS CHECKED TWICE, on purpose.
 *
 *   - Before extraction, so somebody out of scans is told immediately rather
 *     than after reviewing a scan they cannot save. It also means we do not pay
 *     Anthropic to read a document that was never going to be recorded.
 *   - At confirmation, which is what actually consumes the allowance, and is
 *     the only check that closes the two-tabs race.
 *
 * Consumption happens at CONFIRMATION, not capture (spec section 11): backing
 * out of a bad scan must not cost the customer one of their own.
 */

/** The demo's free scan, per visitor per day. Small — it is pure cost. */
const DEMO_SCAN_IP_LIMIT = Number(process.env.DEMO_SCAN_IP_DAILY_LIMIT || 3);
/** Across every anonymous visitor. This is the number that actually bounds
 * the spend; the per-IP one only stops a single machine. */
const DEMO_SCAN_GLOBAL_LIMIT = Number(process.env.DEMO_SCAN_GLOBAL_DAILY_LIMIT || 100);
const DEMO_SCAN_GLOBAL_KEY = 'demo-scan:global';

export async function captureRoutes(fastify: FastifyInstance, options: { database: Database }) {
  const repo = new CaptureRepository(options.database);
  const aiUsage = new AiUsageRepository(options.database);
  const handoffs = new HandoffRepository(options.database);
  const usage = new UsageService(options.database);
  const storage: StorageDriver = createStorageDriver(options.database);
  const pre = [authenticate, withBusiness(options.database)];

  // The dev driver keeps its blobs in Postgres and needs its table.
  if (storage instanceof PostgresBlobDriver) await storage.ensureSchema();
  await repo.ensureSchema();
  await aiUsage.ensureSchema();
  await handoffs.ensureSchema();
  await usage.ensureSchema();
  // Cheap, and it only has to happen once a process: expired sessions are dead
  // credentials taking up space, and nothing else ever deletes them.
  handoffs.purgeExpired().catch((e) => fastify.log.error(e));

  /**
   * The scan meter. Its own endpoint so the button can show what is left before
   * anyone picks a file.
   */
  fastify.get('/v1/captures/usage', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      return reply.send({ success: true, data: await usage.check(request.businessId!, 'document_scans') });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read your scan allowance.' });
    }
  }) as any);

  /**
   * Upload one document and read it.
   *
   * Returns the capture with whatever could be extracted. A failed extraction
   * is NOT an error response: the user still gets the popup, with blank fields
   * to type into and the image beside them. Refusing the whole upload because
   * the model had a bad day would be worse than the manual entry they had before.
   */
  fastify.post('/v1/captures', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;
      const userId = request.user!.id;

      // Cheapest check first: no allowance means no upload and no AI call.
      const allowance = await usage.check(businessId, 'document_scans');
      if (!allowance.allowed) {
        return reply.status(402).send({
          success: false,
          error: 'You have used all of this month’s document scans.',
          data: { feature: 'documentScans', used: allowance.used, limit: allowance.limit },
        });
      }

      const file = await (request as any).file();
      if (!file) return reply.status(400).send({ success: false, error: 'No file uploaded' });

      if (!ACCEPTED_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: 'Upload a JPEG, PNG, WebP or PDF. iPhone HEIC photos are converted before upload.',
        });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ success: false, error: 'That file is too large (max 10MB).' });
        }
        throw err;
      }
      if ((file as any).truncated) {
        return reply.status(413).send({ success: false, error: 'That file is too large (max 10MB).' });
      }

      const requested = (file.fields?.documentType as any)?.value;
      const documentType: DocumentType = isDocumentType(requested) ? requested : 'other';

      // 201 whatever the reading did: the capture exists and is reviewable by
      // hand even when extraction failed.
      const capture = await ingestDocument(
        { repo, storage, onError: (e) => request.log.error(e) },
        {
        businessId,
        userId,
        captureMethod: 'photo',
        buffer,
        mimeType: file.mimetype,
        filename: file.filename ?? null,
        documentType,
      });

      return reply.status(201).send({ success: true, data: capture });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not process that document.' });
    }
  }) as any);

  /** The stored image, for the review popup to show beside the fields. */
  fastify.get('/v1/captures/:id/file', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const key = await repo.storageKeyFor(id, request.businessId!);
      if (!key) return reply.status(404).send({ success: false, error: 'Capture not found' });
      const object = await storage.get(key);
      return reply.header('Content-Type', object.mime).send(object.body);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not load that document.' });
    }
  }) as any);

  /**
   * Green-light a capture. Called BEFORE the entry is created, so an over-cap
   * workspace never ends up with a saved entry that was refused — the client
   * creates the record only once this has said yes, then links it below.
   */
  fastify.post('/v1/captures/:id/confirm', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const businessId = request.businessId!;
      const body = (request.body ?? {}) as { destination?: string };

      const destination = (DESTINATIONS as readonly string[]).includes(body.destination ?? '')
        ? (body.destination as Destination)
        : 'none';

      const capture = await repo.findById(id, businessId);
      if (!capture) return reply.status(404).send({ success: false, error: 'Capture not found' });
      if (capture.status === 'confirmed') {
        // Idempotent: a double-click must not consume two scans.
        return reply.send({ success: true, data: { alreadyConfirmed: true } });
      }

      const allowance = await usage.check(businessId, 'document_scans');
      if (!allowance.allowed) {
        return reply.status(402).send({
          success: false,
          error: 'You have used all of this month’s document scans.',
          data: { feature: 'documentScans', used: allowance.used, limit: allowance.limit },
        });
      }

      await repo.markConfirmed(id, businessId, destination, null);
      await usage.record(businessId, 'document_scans', 1, request.user!.id);

      return reply.send({ success: true, data: { confirmed: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not confirm that document.' });
    }
  }) as any);

  /** Point a confirmed capture at whatever it became. Best effort — the entry
   * already exists, so a failure here must never surface as a failed save. */
  fastify.patch('/v1/captures/:id/link', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { destination?: string; destinationRecordId?: string };
      const destination = (DESTINATIONS as readonly string[]).includes(body.destination ?? '')
        ? (body.destination as Destination)
        : 'none';
      await repo.markConfirmed(id, request.businessId!, destination, body.destinationRecordId ?? null);
      return reply.send({ success: true, data: { linked: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not link that document.' });
    }
  }) as any);

  /** Thrown away without saving. The image goes too — it was never wanted. */
  fastify.post('/v1/captures/:id/discard', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const businessId = request.businessId!;
      const key = await repo.storageKeyFor(id, businessId);
      await repo.markDiscarded(id, businessId);
      if (key) {
        // Storage cleanup must not fail the discard: the row is already marked,
        // and an orphaned blob is a housekeeping problem, not a user-facing one.
        try { await storage.delete(key); } catch (e) { request.log.error(e); }
      }
      return reply.send({ success: true, data: { discarded: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not discard that document.' });
    }
  }) as any);

  /* ------------------------------------------------------------------ *
   * QR handoff — photograph a document with your phone, from your desk.
   *
   * The desktop's file picker is not a camera. Someone sitting at a computer
   * holding a paper receipt has no way to photograph it without emailing it to
   * themselves first, and that is the complaint this answers.
   *
   * Two of the five routes below are UNAUTHENTICATED, which is unique in this
   * server and is the whole design problem. The token in the QR code is the
   * only credential the phone has, so it is deliberately weak in every
   * dimension except the one it needs: it can add one document to one
   * workspace, once, within ten minutes, and it can read nothing back.
   * ------------------------------------------------------------------ */

  /** Open a session. The desktop turns the returned token into a QR code. */
  fastify.post('/v1/captures/handoff', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const businessId = request.businessId!;

      // Checked before a QR code is ever shown. Walking to fetch a receipt and
      // scanning a code, only to be told you were out of scans the whole time,
      // is the worst version of this.
      const allowance = await usage.check(businessId, 'document_scans');
      if (!allowance.allowed) {
        return reply.status(402).send({
          success: false,
          error: 'You have used all of this month’s document scans.',
          data: { feature: 'documentScans', used: allowance.used, limit: allowance.limit },
        });
      }

      const { session, token } = await handoffs.create(businessId, request.user!.id);
      return reply.status(201).send({
        success: true,
        // The raw token is returned exactly once and never stored in the clear.
        data: { id: session.id, token, expiresAt: session.expiresAt, ttlMinutes: HANDOFF_TTL_MINUTES },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not start a phone session.' });
    }
  }) as any);

  /**
   * The desktop's poll. Answers "has the phone sent anything yet?".
   *
   * Polling rather than a websocket or a pub/sub vendor: the desktop already
   * knows its own session id, the wait is measured in seconds, and this needs
   * no new infrastructure. The capture comes back HERE, over the desktop's own
   * authenticated session — never to the phone.
   */
  fastify.get('/v1/captures/handoff/:id', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const session = await handoffs.findForOwner(id, request.businessId!, request.user!.id);
      if (!session) return reply.status(404).send({ success: false, error: 'Session not found' });

      if (session.status !== 'uploaded' || !session.captureId) {
        const expired = new Date(session.expiresAt).getTime() <= Date.now();
        return reply.send({
          success: true,
          data: { status: expired && session.status === 'waiting' ? 'expired' : session.status, capture: null },
        });
      }

      const capture = await repo.findById(session.captureId, request.businessId!);
      // Closed on handover, so a stale poll cannot re-deliver the same document
      // and open a second review popup for it.
      await handoffs.markConsumed(session.id);
      return reply.send({ success: true, data: { status: 'uploaded', capture } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not check that session.' });
    }
  }) as any);

  /** Closing the dialog kills the token, rather than leaving a live credential
   * on a screen its owner has walked away from. */
  fastify.post('/v1/captures/handoff/:id/cancel', { preHandler: pre }, (async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await handoffs.expireNow(id, request.businessId!, request.user!.id);
      return reply.send({ success: true, data: { cancelled: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not cancel that session.' });
    }
  }) as any);

  /**
   * PUBLIC. The phone checks its token before showing a camera button.
   *
   * Says only whether the token is live and when it dies. No workspace name, no
   * user, no document — nothing that would make an intercepted QR code worth
   * more than the single upload it already grants.
   */
  // Typed as a plain FastifyRequest, not AuthenticatedRequest: there is no user
  // on this route, and a type that says otherwise is an invitation for someone
  // to reach for `request.user!.id` here and crash.
  fastify.get('/v1/captures/handoff/token/:token', (async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const session = await handoffs.findByToken(token);
      if (!session || session.status !== 'waiting') {
        return reply.status(404).send({ success: false, error: 'This code has expired or has already been used.' });
      }
      return reply.send({ success: true, data: { valid: true, expiresAt: session.expiresAt } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not check that code.' });
    }
  }) as any);

  /**
   * PUBLIC. The phone sends its photo.
   *
   * The reply carries NOTHING back. Not the fields, not the total, not even the
   * capture id — the phone is an unauthenticated device that proved only that
   * it holds a token, and financial data does not travel to it. Everything read
   * off the document goes to the desktop, which is logged in.
   */
  fastify.post('/v1/captures/handoff/token/:token', (async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };
      const session = await handoffs.findByToken(token);
      if (!session || session.status !== 'waiting') {
        return reply.status(404).send({ success: false, error: 'This code has expired or has already been used.' });
      }

      // Re-checked here, not just when the code was generated: the allowance
      // may have been spent in another tab while the phone was being fetched.
      const allowance = await usage.check(session.businessId, 'document_scans');
      if (!allowance.allowed) {
        return reply.status(402).send({ success: false, error: 'This workspace has no document scans left this month.' });
      }

      const file = await (request as any).file();
      if (!file) return reply.status(400).send({ success: false, error: 'No file uploaded' });

      if (!ACCEPTED_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ success: false, error: 'Upload a JPEG, PNG, WebP or PDF.' });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ success: false, error: 'That photo is too large (max 10MB).' });
        }
        throw err;
      }
      if ((file as any).truncated) {
        return reply.status(413).send({ success: false, error: 'That photo is too large (max 10MB).' });
      }

      /**
       * Claimed BEFORE the work, not after.
       *
       * `attachCapture` only succeeds while the session is still `waiting`, so
       * two phones racing the same token cannot both upload. Doing it first
       * would mean holding a capture id we do not have yet, so instead the
       * capture is created and then the claim is attempted — and a claim that
       * loses the race discards what it just made rather than leaving an
       * orphan sitting in the workspace's books.
       */
      const capture = await ingestDocument(
        { repo, storage, onError: (e) => request.log.error(e) },
        {
        businessId: session.businessId,
        // Attributed to whoever opened the session on the desktop. Nobody is
        // logged in on the phone, and "the person who asked for this" is the
        // only honest answer.
        userId: session.userId,
        captureMethod: 'qr_handoff',
        buffer,
        mimeType: file.mimetype,
        filename: file.filename ?? null,
        documentType: 'other',
      });

      const claimed = await handoffs.attachCapture(session.id, capture.id);
      if (!claimed) {
        await repo.markDiscarded(capture.id, session.businessId);
        return reply.status(409).send({ success: false, error: 'This code has already been used.' });
      }

      return reply.send({ success: true, data: { sent: true } });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not send that photo.' });
    }
  }) as any);

  /* ------------------------------------------------------------------ *
   * PUBLIC — the Try-It Demo's free scan.
   *
   * The demo has never spent a penny before this: its Finna answers are
   * computed locally from the demo's own state, with no model behind them.
   * This is the FIRST thing in the demo that costs real money, so it is capped
   * in two independent ways before a single byte is read.
   *
   * NOTHING IS STORED. No blob, no `document_captures` row. An anonymous
   * visitor has no workspace to own one, and keeping a stranger's financial
   * document on the strength of an unauthenticated POST is not a trade worth
   * making. The extraction goes straight back in the response, the demo holds
   * it in the visitor's own browser, and a real signup replays it like every
   * other thing they made.
   * ------------------------------------------------------------------ */
  fastify.post('/v1/demo/capture', (async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      /**
       * The global ceiling is PEEKED, not incremented, before the per-visitor
       * check. A caller already over their own limit must still be measured
       * against the shared budget, but charging them for a request we are about
       * to refuse would let anyone exhaust the day with rejections alone. Same
       * reasoning as ai-usage.routes.ts, which this borrows its counters from.
       */
      if ((await aiUsage.peek(DEMO_SCAN_GLOBAL_KEY)) >= DEMO_SCAN_GLOBAL_LIMIT) {
        return reply.status(429).send({
          success: false,
          error: 'The demo scanner has had a busy day. Sign up and you get your own allowance.',
        });
      }

      const ipKey = `demo-scan:ip:${observedAddress(request)}`;
      if ((await aiUsage.peek(ipKey)) >= DEMO_SCAN_IP_LIMIT) {
        return reply.status(429).send({
          success: false,
          error: 'That is all the free scans for now. Sign up to keep going.',
        });
      }

      const file = await (request as any).file();
      if (!file) return reply.status(400).send({ success: false, error: 'No file uploaded' });
      if (!ACCEPTED_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({ success: false, error: 'Upload a JPEG, PNG, WebP or PDF.' });
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({ success: false, error: 'That file is too large (max 10MB).' });
        }
        throw err;
      }
      if ((file as any).truncated) {
        return reply.status(413).send({ success: false, error: 'That file is too large (max 10MB).' });
      }

      // Charged only now, when we are genuinely about to spend.
      await aiUsage.incrementAndGet(ipKey);
      await aiUsage.incrementAndGet(DEMO_SCAN_GLOBAL_KEY);

      const result = await extractDocument(buffer, file.mimetype, 'other');
      return reply.send({
        success: true,
        data: {
          fields: result.fields,
          confidence: result.confidence,
          documentType: result.documentType,
        },
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not read that document.' });
    }
  }) as any);
}
