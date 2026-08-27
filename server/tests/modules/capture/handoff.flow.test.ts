import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUSINESS = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

/**
 * The QR handoff, driven end to end through the real route handlers.
 *
 * This is the test that answers "where does the QR code take me": a desktop
 * opens a session, a LOGGED-OUT phone presents the token and uploads a photo,
 * and the desktop's next poll receives the capture. Every layer below the
 * routes is faked — no database, no object store, no Anthropic call — so the
 * thing under test is the route logic itself, which is where the interesting
 * rules live.
 *
 * Mock factories keep their state inside themselves because `jest.mock` is
 * hoisted above the imports; a factory closing over a module-scope `const`
 * would read it before it was initialised.
 */

jest.mock('../../../src/modules/shared/authenticate', () => ({
  authenticate: jest.fn(async (request: any) => {
    request.user = { id: USER, email: 'owner@example.com' };
  }),
}));

jest.mock('../../../src/modules/shared/business-context', () => ({
  withBusiness: () => async (request: any) => { request.businessId = BUSINESS; },
}));

jest.mock('../../../src/infrastructure/object-storage', () => {
  const store = new Map<string, { body: Buffer; mime: string }>();
  return {
    __store: store,
    PostgresBlobDriver: class {},
    S3CompatibleDriver: class {},
    createStorageDriver: () => ({
      put: async (key: string, body: Buffer, mime: string) => { store.set(key, { body, mime }); },
      get: async (key: string) => store.get(key),
      delete: async (key: string) => { store.delete(key); },
    }),
  };
});

/** The AI call. Never made — this returns a fixed reading. */
jest.mock('../../../src/modules/capture/capture.extraction', () => ({
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  extractDocument: jest.fn(async () => ({
    fields: {
      vendor: 'Caffè Roma', documentDate: '2026-08-25', total: 42.5, taxAmount: null,
      currency: 'EUR', documentNumber: 'R-991', suggestedType: 'receipt', lineItems: [],
    },
    confidence: { vendor: 0.95, total: 0.92, documentDate: 0.9 },
    documentType: 'receipt',
  })),
}));

/** The demo scan endpoint shares captureRoutes, so its counters need faking too. */
jest.mock('../../../src/modules/ai-usage/ai-usage.repository', () => {
  const counts = new Map<string, number>();
  return {
    __counts: counts,
    AiUsageRepository: class {
      async ensureSchema() { /* no schema in a fake */ }
      async peek(key: string) { return counts.get(key) ?? 0; }
      async incrementAndGet(key: string) {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next;
      }
    },
  };
});

jest.mock('../../../src/modules/billing/usage.service', () => ({
  UsageService: class {
    static allowed = true;
    static recorded: unknown[] = [];
    async ensureSchema() { /* no schema in a fake */ }
    async check() {
      const cls = this.constructor as any;
      return { allowed: cls.allowed, used: 3, limit: 25, remaining: 22, period: '2026-08' };
    }
    async record(...args: unknown[]) { (this.constructor as any).recorded.push(args); }
  },
}));

jest.mock('../../../src/modules/capture/capture.repository', () => {
  const captures = new Map<string, any>();
  let seq = 0;
  return {
    __captures: captures,
    CaptureRepository: class {
      async ensureSchema() { /* no schema in a fake */ }
      async create(input: any) {
        const capture = {
          id: `capture-${++seq}`,
          ...input,
          extractedFields: {}, confidenceScores: {},
          destination: null, destinationRecordId: null,
          status: 'pending_review', extractionError: null,
          createdAt: new Date().toISOString(), confirmedAt: null,
        };
        captures.set(capture.id, capture);
        return capture;
      }
      async saveExtraction(id: string, _b: string, fields: any, confidence: any, documentType: string) {
        Object.assign(captures.get(id), { extractedFields: fields, confidenceScores: confidence, documentType });
      }
      async saveExtractionError(id: string, _b: string, message: string) {
        Object.assign(captures.get(id), { extractionError: message });
      }
      async findById(id: string, businessId: string) {
        const c = captures.get(id);
        return c && c.businessId === businessId ? c : null;
      }
      async markDiscarded(id: string) { Object.assign(captures.get(id), { status: 'discarded' }); }
      async storageKeyFor(id: string) { return captures.get(id)?.storageKey ?? null; }
      async markConfirmed() { /* not exercised here */ }
    },
  };
});

jest.mock('../../../src/modules/capture/capture.handoff.repository', () => {
  const actual = jest.requireActual('../../../src/modules/capture/capture.handoff.repository');
  const crypto = require('crypto');
  const sessions = new Map<string, any>();
  let seq = 0;

  const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

  return {
    ...actual,
    __sessions: sessions,
    HandoffRepository: class {
      async ensureSchema() { /* no schema in a fake */ }
      async purgeExpired() { /* nothing to purge in a fake */ }
      async create(businessId: string, userId: string) {
        const token = crypto.randomBytes(32).toString('base64url');
        const session = {
          id: `session-${++seq}`,
          tokenHash: hash(token),
          businessId,
          userId,
          captureId: null,
          status: 'waiting',
          expiresAt: new Date(Date.now() + actual.HANDOFF_TTL_MINUTES * 60_000).toISOString(),
        };
        sessions.set(session.id, session);
        return { session, token };
      }
      async findByToken(token: string) {
        const h = hash(token);
        for (const s of sessions.values()) {
          if (s.tokenHash === h && new Date(s.expiresAt).getTime() > Date.now()) return s;
        }
        return null;
      }
      async findForOwner(id: string, businessId: string, userId: string) {
        const s = sessions.get(id);
        return s && s.businessId === businessId && s.userId === userId ? s : null;
      }
      async attachCapture(id: string, captureId: string) {
        const s = sessions.get(id);
        // The conditional UPDATE, in miniature: only a waiting session claims.
        if (!s || s.status !== 'waiting') return false;
        s.captureId = captureId;
        s.status = 'uploaded';
        return true;
      }
      async markConsumed(id: string) { sessions.get(id).status = 'consumed'; }
      async expireNow(id: string) { sessions.get(id).expiresAt = new Date(Date.now() - 1000).toISOString(); }
    },
  };
});

import { captureRoutes } from '../../../src/modules/capture/capture.routes';

/** A multipart body, built by hand so no extra test dependency is needed. */
function multipart(filename: string, mime: string, bytes: Buffer) {
  const boundary = '----FinquantaTestBoundary';
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, bytes, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe('QR handoff — desktop to phone and back', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    await app.register(captureRoutes, { database: {} as any });
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  const openSession = async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/captures/handoff' });
    return JSON.parse(res.payload).data as { id: string; token: string; ttlMinutes: number };
  };

  it('mints a session with a token and a five-minute life', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/captures/handoff' });

    expect(res.statusCode).toBe(201);
    const { data } = JSON.parse(res.payload);
    expect(data.token).toBeTruthy();
    expect(data.ttlMinutes).toBe(5);
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('lets a logged-out phone check the token, and tells it nothing else', async () => {
    const { token } = await openSession();

    const res = await app.inject({ method: 'GET', url: `/v1/captures/handoff/token/${token}` });

    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.payload);
    expect(data.valid).toBe(true);
    // No workspace name, no user, nothing an intercepted QR code could use.
    expect(Object.keys(data).sort()).toEqual(['expiresAt', 'valid']);
  });

  it('refuses a token that was never issued', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/captures/handoff/token/not-a-real-token' });
    expect(res.statusCode).toBe(404);
  });

  it('carries a photo from the phone to the desktop poll', async () => {
    const { id, token } = await openSession();

    // Nothing has arrived yet.
    const waiting = await app.inject({ method: 'GET', url: `/v1/captures/handoff/${id}` });
    expect(JSON.parse(waiting.payload).data).toMatchObject({ status: 'waiting', capture: null });

    // The phone sends its photo — no auth header anywhere in this request.
    const sent = await app.inject({
      method: 'POST',
      url: `/v1/captures/handoff/token/${token}`,
      ...multipart('receipt.jpg', 'image/jpeg', JPEG),
    });
    expect(sent.statusCode).toBe(200);

    // The phone is told it worked and NOTHING else. No fields, no total, no id.
    expect(JSON.parse(sent.payload).data).toEqual({ sent: true });

    // The desktop's next poll gets the whole thing.
    const arrived = await app.inject({ method: 'GET', url: `/v1/captures/handoff/${id}` });
    const { data } = JSON.parse(arrived.payload);

    expect(data.status).toBe('uploaded');
    expect(data.capture.extractedFields).toMatchObject({ vendor: 'Caffè Roma', total: 42.5, currency: 'EUR' });
    expect(data.capture.captureMethod).toBe('qr_handoff');
    // Attributed to the person who opened the session; nobody is logged in on
    // the phone, and that is the only honest answer.
    expect(data.capture.capturedBy).toBe(USER);
  });

  it('does not deliver the same capture twice', async () => {
    const { id, token } = await openSession();
    await app.inject({
      method: 'POST',
      url: `/v1/captures/handoff/token/${token}`,
      ...multipart('receipt.jpg', 'image/jpeg', JPEG),
    });

    const first = await app.inject({ method: 'GET', url: `/v1/captures/handoff/${id}` });
    expect(JSON.parse(first.payload).data.status).toBe('uploaded');

    // A stale poll must not open a second review popup for the same document.
    const second = await app.inject({ method: 'GET', url: `/v1/captures/handoff/${id}` });
    expect(JSON.parse(second.payload).data).toMatchObject({ status: 'consumed', capture: null });
  });

  it('burns the token after one upload', async () => {
    const { token } = await openSession();

    const first = await app.inject({
      method: 'POST',
      url: `/v1/captures/handoff/token/${token}`,
      ...multipart('a.jpg', 'image/jpeg', JPEG),
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/captures/handoff/token/${token}`,
      ...multipart('b.jpg', 'image/jpeg', JPEG),
    });
    expect(second.statusCode).toBe(404);
  });

  it('stops accepting uploads once the desktop closes the dialog', async () => {
    const { id, token } = await openSession();

    const cancelled = await app.inject({ method: 'POST', url: `/v1/captures/handoff/${id}/cancel` });
    expect(cancelled.statusCode).toBe(200);

    const late = await app.inject({
      method: 'POST',
      url: `/v1/captures/handoff/token/${token}`,
      ...multipart('too-late.jpg', 'image/jpeg', JPEG),
    });
    expect(late.statusCode).toBe(404);
  });

  it('refuses a file type the reader cannot open', async () => {
    const { token } = await openSession();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/captures/handoff/token/${token}`,
      ...multipart('notes.txt', 'text/plain', Buffer.from('hello')),
    });

    expect(res.statusCode).toBe(400);
  });

  it('will not let one workspace poll another workspace’s session', async () => {
    const { id } = await openSession();
    const { __sessions } = jest.requireMock('../../../src/modules/capture/capture.handoff.repository') as any;
    __sessions.get(id).businessId = 'a-different-workspace';

    const res = await app.inject({ method: 'GET', url: `/v1/captures/handoff/${id}` });
    expect(res.statusCode).toBe(404);
  });

  it('refuses to draw a QR code for a workspace with no scans left', async () => {
    const { UsageService } = jest.requireMock('../../../src/modules/billing/usage.service') as any;
    UsageService.allowed = false;
    try {
      const res = await app.inject({ method: 'POST', url: '/v1/captures/handoff' });
      // 402, so the desktop opens the upgrade prompt rather than showing a code
      // that was never going to work.
      expect(res.statusCode).toBe(402);
    } finally {
      UsageService.allowed = true;
    }
  });

  it('refuses the phone’s upload if the allowance ran out while it was fetched', async () => {
    const { token } = await openSession();
    const { UsageService } = jest.requireMock('../../../src/modules/billing/usage.service') as any;
    UsageService.allowed = false;
    try {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/captures/handoff/token/${token}`,
        ...multipart('receipt.jpg', 'image/jpeg', JPEG),
      });
      expect(res.statusCode).toBe(402);
    } finally {
      UsageService.allowed = true;
    }
  });
});
