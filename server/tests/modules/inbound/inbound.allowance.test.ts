import crypto from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUSINESS = '11111111-1111-1111-1111-111111111111';
const MEMBER_EMAIL = 'owner@acme.test';
const LOCAL_PART = 'docs-abcdef0123456789abcd';
const ADDRESS = `${LOCAL_PART}@in.finquanta.ai`;
const SECRET = 'whsec_' + Buffer.from('a-test-signing-key-32-bytes-long').toString('base64');

/**
 * One scan per attachment, and only what the plan can actually keep.
 *
 * The rule this file exists to hold: a batch must not be read further than the
 * workspace can confirm. "Is there at least one scan left" is a yes/no, and a
 * yes would otherwise buy twelve extractions for a workspace that can save
 * three — we would pay for nine documents the user is then refused.
 */

jest.mock('../../../src/infrastructure/object-storage', () => {
  const store = new Map<string, any>();
  return {
    __store: store,
    PostgresBlobDriver: class {},
    S3CompatibleDriver: class {},
    createStorageDriver: () => ({
      put: async (k: string, b: Buffer, m: string) => { store.set(k, { body: b, mime: m }); },
      get: async (k: string) => store.get(k),
      delete: async (k: string) => { store.delete(k); },
    }),
  };
});

jest.mock('../../../src/modules/capture/capture.extraction', () => ({
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  extractDocument: jest.fn(async () => ({
    fields: {
      vendor: 'Northwind', documentDate: '2026-08-20', total: 10, taxAmount: null,
      currency: 'USD', documentNumber: null, suggestedType: 'receipt', lineItems: [],
    },
    confidence: { total: 0.9 },
    documentType: 'receipt',
  })),
}));

jest.mock('../../../src/modules/inbound/inbound.body-extraction', () => ({
  extractFromBody: jest.fn(async () => ({
    isFinancial: false, fields: {}, confidence: {}, documentType: 'other',
  })),
}));

/**
 * The follow-up call that actually reads the mail. The webhook is metadata
 * only, so this is where body and attachment bytes come from.
 */
jest.mock('../../../src/modules/inbound/inbound.fetch', () => {
  const actual = jest.requireActual('../../../src/modules/inbound/inbound.fetch');
  return {
    ...actual,
    fetchReceivedEmail: jest.fn(async () => ({
      text: '',
      attachments: [] as any[],
    })),
    // A SEPARATE endpoint in the real API, and the bug this feature had for
    // days: the retrieve-email response lists attachments but carries no bytes
    // and no download link. Mocked separately so the tests exercise the same
    // two calls production makes.
    listReceivedAttachments: jest.fn(async () => [] as any[]),
  };
});

jest.mock('../../../src/modules/inbound/inbound.attachments', () => ({
  fetchAttachment: jest.fn(async () => ({ body: Buffer.from('%PDF'), contentType: 'application/pdf' })),
}));

jest.mock('../../../src/modules/billing/usage.service', () => ({
  UsageService: class {
    /** null means unlimited, matching what the real service returns. */
    static remaining: number | null = 100;
    async ensureSchema() { /* no schema in a fake */ }
    async check() {
      const remaining = (this.constructor as any).remaining;
      return {
        allowed: remaining === null || remaining > 0,
        used: 0, limit: remaining === null ? null : 25, remaining, period: '2026-08',
      };
    }
    async record() { /* consumption is at confirmation, not here */ }
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
        const c = { id: `capture-${++seq}`, ...input, extractedFields: {}, confidenceScores: {} };
        captures.set(c.id, c);
        return c;
      }
      async saveExtraction() { /* not what this file asserts */ }
      async saveExtractionError() { /* not what this file asserts */ }
    },
  };
});

jest.mock('../../../src/modules/inbound/inbound.repository', () => {
  const addresses = new Map<string, any>();
  const messages = new Map<string, any>();
  let seq = 0;
  return {
    __state: { addresses, messages },
    InboundRepository: class {
      async ensureSchema() { /* no schema in a fake */ }
      async findByLocalPart(p: string) { return addresses.get(p.toLowerCase()) ?? null; }
      async senderStatus() { return null; }
      async isMemberEmail(_b: string, email: string) { return email.toLowerCase() === MEMBER_EMAIL; }
      async findByProviderId(id: string) {
        return [...messages.values()].find((m) => m.providerMessageId === id) ?? null;
      }
      async countToday() { return 0; }
      async createMessage(input: any) {
        const m = { id: `msg-${++seq}`, ...input, error: null };
        messages.set(m.id, m);
        return m;
      }
      async setStatus(id: string, status: string, error: string | null = null) {
        Object.assign(messages.get(id), { status, error });
      }
      async markBodyExtracted() { /* not what this file asserts */ }
      async linkCapture() { /* not what this file asserts */ }
    },
  };
});

import { __drain, inboundWebhookRoutes } from '../../../src/modules/inbound/inbound.webhook';

const mocks = () => ({
  extraction: jest.requireMock('../../../src/modules/capture/capture.extraction') as any,
  usage: jest.requireMock('../../../src/modules/billing/usage.service') as any,
  inbound: jest.requireMock('../../../src/modules/inbound/inbound.repository') as any,
  captures: jest.requireMock('../../../src/modules/capture/capture.repository') as any,
});

const sign = (id: string, ts: string, body: string) =>
  'v1,' + crypto.createHmac('sha256', Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64'))
    .update(`${id}.${ts}.${body}`).digest('base64');

describe('inbound email — one scan per attachment', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.RESEND_INBOUND_SIGNING_SECRET = SECRET;
    app = Fastify();
    await app.register(inboundWebhookRoutes, { database: {} as any });
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    const m = mocks();
    m.extraction.extractDocument.mockClear();
    m.inbound.__state.addresses.clear();
    m.inbound.__state.messages.clear();
    m.captures.__captures.clear();
    m.usage.UsageService.remaining = 100;
    m.inbound.__state.addresses.set(LOCAL_PART, { id: 'addr-1', businessId: BUSINESS, localPart: LOCAL_PART });
  });

  const send = async (count: number) => {
    const id = 'em_' + Math.random();
    const payload = JSON.stringify({
      data: {
        email_id: id,
        from: `Owner <${MEMBER_EMAIL}>`,
        to: [ADDRESS],
        subject: 'Receipts',
        text: '',
        attachments: Array.from({ length: count }, (_, i) => ({
          filename: `r${i}.pdf`, content_type: 'application/pdf', download_url: `https://resend.com/${i}`,
        })),
      },
    });
    // The webhook is metadata only; content comes from the follow-up fetch.
    const fetchMod = jest.requireMock('../../../src/modules/inbound/inbound.fetch') as any;
    fetchMod.fetchReceivedEmail.mockResolvedValue({
      text: '',
      attachments: Array.from({ length: count }, (_, i) => ({
        filename: `r${i}.pdf`,
        contentType: 'application/pdf',
        content: null,
        url: null,
      })),
    });
    fetchMod.listReceivedAttachments.mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        id: `att_${i}`,
        filename: `r${i}.pdf`,
        contentType: 'application/pdf',
        size: 512,
        downloadUrl: `https://cdn.example.test/att_${i}`,
      }))
    );

    const ts = String(Math.floor(Date.now() / 1000));
    const res = await app.inject({
      method: 'POST',
      url: '/v1/inbound/resend',
      payload,
      headers: {
        'content-type': 'application/json',
        'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sign(id, ts, payload),
      },
    });
    await __drain();
    return res;
  };

  it('reads one document per attachment when there is room', async () => {
    await send(6);
    expect(mocks().extraction.extractDocument).toHaveBeenCalledTimes(6);
    expect(mocks().captures.__captures.size).toBe(6);
  });

  it('reads only as many as the workspace can confirm', async () => {
    mocks().usage.UsageService.remaining = 3;

    await send(12);

    // Nine fewer AI calls than a naive "is there any allowance left" check.
    expect(mocks().extraction.extractDocument).toHaveBeenCalledTimes(3);
    expect(mocks().captures.__captures.size).toBe(3);
  });

  it('says why the rest were left', async () => {
    mocks().usage.UsageService.remaining = 2;

    await send(5);

    const message = [...mocks().inbound.__state.messages.values()][0];
    expect(message.error).toContain('Read 2 of 5');
    expect(message.error).toContain('document scans left this month');
  });

  it('does not limit a workspace on an unlimited plan', async () => {
    mocks().usage.UsageService.remaining = null;

    await send(8);

    expect(mocks().extraction.extractDocument).toHaveBeenCalledTimes(8);
  });
});
