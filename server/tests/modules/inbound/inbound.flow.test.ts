import crypto from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUSINESS = '11111111-1111-1111-1111-111111111111';
const MEMBER_EMAIL = 'owner@acme.test';
const LOCAL_PART = 'docs-abcdef0123456789abcd';
const ADDRESS = `${LOCAL_PART}@in.finquanta.ai`;

const SECRET = 'whsec_' + Buffer.from('a-test-signing-key-32-bytes-long').toString('base64');

/**
 * Inbound email, driven end to end through the real webhook handler.
 *
 * Everything below the route is faked — no database, no object store, no
 * Anthropic call — so what is under test is the decision logic: who is trusted,
 * what gets read, and above all **what never costs money**.
 *
 * Mock factories keep their state inside themselves because `jest.mock` is
 * hoisted above the imports.
 */

jest.mock('../../../src/infrastructure/object-storage', () => {
  const store = new Map<string, { body: Buffer; mime: string }>();
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

/** The document AI call. Its call count is the cost guarantee. */
jest.mock('../../../src/modules/capture/capture.extraction', () => ({
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  extractDocument: jest.fn(async () => ({
    fields: {
      vendor: 'Northwind Supplies', documentDate: '2026-08-20', total: 240.5, taxAmount: 40,
      currency: 'GBP', documentNumber: 'INV-88', suggestedType: 'vendor_bill', lineItems: [],
    },
    confidence: { vendor: 0.96, total: 0.94 },
    documentType: 'vendor_bill',
  })),
}));

/** The body AI call. Also call-counted. */
jest.mock('../../../src/modules/inbound/inbound.body-extraction', () => ({
  extractFromBody: jest.fn(async () => ({
    isFinancial: true,
    fields: {
      vendor: 'Stripe', documentDate: '2026-08-21', total: 1200, taxAmount: null,
      currency: 'USD', documentNumber: 'ch_123', suggestedType: 'customer_payment_proof',
      lineItems: [],
    },
    confidence: { vendor: 0.9, total: 0.98 },
    documentType: 'customer_payment_proof',
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
  };
});

jest.mock('../../../src/modules/inbound/inbound.attachments', () => ({
  fetchAttachment: jest.fn(async () => ({
    body: Buffer.from('%PDF-1.4 fake'),
    contentType: 'application/pdf',
  })),
}));

jest.mock('../../../src/modules/billing/usage.service', () => ({
  UsageService: class {
    static allowed = true;
    async ensureSchema() { /* no schema in a fake */ }
    async check() {
      return { allowed: (this.constructor as any).allowed, used: 1, limit: 25, remaining: 24, period: '2026-08' };
    }
    async record() { /* consumption happens at confirmation, not here */ }
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
        const c = {
          id: `capture-${++seq}`, ...input,
          extractedFields: {}, confidenceScores: {}, status: 'pending_review',
          extractionError: null, createdAt: new Date().toISOString(), confirmedAt: null,
        };
        captures.set(c.id, c);
        return c;
      }
      async saveExtraction(id: string, _b: string, fields: any, confidence: any, documentType: string) {
        Object.assign(captures.get(id), { extractedFields: fields, confidenceScores: confidence, documentType });
      }
      async saveExtractionError(id: string, _b: string, message: string) {
        Object.assign(captures.get(id), { extractionError: message });
      }
    },
  };
});

jest.mock('../../../src/modules/inbound/inbound.repository', () => {
  const addresses = new Map<string, any>();
  const senders = new Map<string, any>();
  const messages = new Map<string, any>();
  let seq = 0;

  return {
    __state: { addresses, senders, messages },
    InboundRepository: class {
      async ensureSchema() { /* no schema in a fake */ }
      async findByLocalPart(part: string) {
        return addresses.get(part.toLowerCase()) ?? null;
      }
      async senderStatus(businessId: string, email: string) {
        return senders.get(`${businessId}|${email.toLowerCase()}`) ?? null;
      }
      async isMemberEmail(_businessId: string, email: string) {
        return email.toLowerCase() === MEMBER_EMAIL;
      }
      async findByProviderId(id: string) {
        return [...messages.values()].find((m) => m.providerMessageId === id) ?? null;
      }
      async countToday(businessId: string) {
        return [...messages.values()].filter((m) => m.businessId === businessId).length;
      }
      async createMessage(input: any) {
        const existing = [...messages.values()].find((m) => m.providerMessageId === input.providerMessageId);
        if (existing) return existing;
        const m = { id: `msg-${++seq}`, ...input, bodyExtracted: false, error: null };
        messages.set(m.id, m);
        return m;
      }
      async setStatus(id: string, status: string, error: string | null = null) {
        Object.assign(messages.get(id), { status, error });
      }
      async markBodyExtracted(id: string) { messages.get(id).bodyExtracted = true; }
      async linkCapture() { /* the link is not what these tests are about */ }
    },
  };
});

import { __drain, checkSignature, describeSecret, inboundWebhookRoutes, normalisePayload, verifySignature } from '../../../src/modules/inbound/inbound.webhook';

const mocks = () => ({
  extraction: jest.requireMock('../../../src/modules/capture/capture.extraction') as any,
  body: jest.requireMock('../../../src/modules/inbound/inbound.body-extraction') as any,
  inbound: jest.requireMock('../../../src/modules/inbound/inbound.repository') as any,
  usage: jest.requireMock('../../../src/modules/billing/usage.service') as any,
  captures: jest.requireMock('../../../src/modules/capture/capture.repository') as any,
});

function sign(id: string, timestamp: string, body: string): string {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64');
  return 'v1,' + crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

describe('inbound email — signature and payload', () => {
  const body = '{"hello":"world"}';
  const ts = String(Math.floor(Date.now() / 1000));

  it('accepts a correctly signed payload', () => {
    expect(verifySignature({
      secret: SECRET, id: 'msg_1', timestamp: ts, signatureHeader: sign('msg_1', ts, body), body,
    })).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifySignature({
      secret: SECRET, id: 'msg_1', timestamp: ts,
      signatureHeader: sign('msg_1', ts, body), body: body + ' ',
    })).toBe(false);
  });

  it('rejects a replayed timestamp', () => {
    const old = String(Math.floor(Date.now() / 1000) - 60 * 60);
    expect(verifySignature({
      secret: SECRET, id: 'msg_1', timestamp: old, signatureHeader: sign('msg_1', old, body), body,
    })).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    // timingSafeEqual throws on mismatched lengths — the guard must catch it.
    expect(() => verifySignature({
      secret: SECRET, id: 'msg_1', timestamp: ts, signatureHeader: 'v1,short', body,
    })).not.toThrow();
  });

  /**
   * SVIX'S OWN PUBLISHED TEST VECTOR.
   *
   * The point of this one is that every value comes from outside this codebase,
   * so it cannot pass by agreeing with my own mistake. When real deliveries were
   * being rejected, the first question was whether the bug was mine or the
   * configuration's — a self-consistent test could not answer that and this can.
   */
  it('matches the reference Svix vector', () => {
    expect(checkSignature({
      secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
      id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
      timestamp: '1614265330',
      signatureHeader: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
      body: '{"test": 2432232314}',
      // The vector is from 2021; without pinning the clock the tolerance check
      // would reject it before the HMAC was ever computed.
      now: 1614265330 * 1000,
    })).toEqual({ ok: true });
  });

  it('names the reason rather than just failing', () => {
    const at = (r: any) => (r.ok ? 'ok' : r.reason);

    expect(at(checkSignature({
      secret: '', id: 'a', timestamp: ts, signatureHeader: 'v1,x', body,
    }))).toBe('no-secret');

    expect(at(checkSignature({
      secret: SECRET, id: '', timestamp: ts, signatureHeader: 'v1,x', body,
    }))).toBe('missing-headers');

    const old = String(Math.floor(Date.now() / 1000) - 60 * 60);
    expect(at(checkSignature({
      secret: SECRET, id: 'a', timestamp: old, signatureHeader: sign('a', old, body), body,
    }))).toBe('timestamp-out-of-tolerance');

    // An API key pasted where the signing secret belongs — a real mistake, and
    // one that must not be reported as "the secret does not match".
    expect(at(checkSignature({
      secret: 're_AbC123_notAsigningSecret!!', id: 'a', timestamp: ts,
      signatureHeader: 'v1,' + 'x'.repeat(44), body,
    }))).toBe('secret-not-base64');

    expect(at(checkSignature({
      secret: SECRET, id: 'a', timestamp: ts, signatureHeader: sign('b', ts, body), body,
    }))).toBe('no-match');
  });

  it('survives a secret pasted with a trailing newline', () => {
    // How a stray byte actually gets into a hosting dashboard's env var.
    expect(checkSignature({
      secret: `${SECRET}
`, id: 'msg_1', timestamp: ts,
      signatureHeader: sign('msg_1', ts, body), body,
    })).toEqual({ ok: true });

    expect(describeSecret(`${SECRET}
`).hadSurroundingWhitespace).toBe(true);
    expect(describeSecret(SECRET).looksBase64).toBe(true);
  });

  it('reads the fields it needs out of a provider payload', () => {
    const mail = normalisePayload({
      data: {
        email_id: 'em_1',
        from: 'Jane <jane@vendor.test>',
        to: [ADDRESS],
        subject: 'Invoice 88',
        text: 'See attached.',
        attachments: [{ filename: 'inv.pdf', content_type: 'application/pdf; charset=x', download_url: 'https://resend.com/a' }],
      },
    });
    expect(mail).toMatchObject({
      providerMessageId: 'em_1',
      to: [ADDRESS],
      subject: 'Invoice 88',
    });
    expect(mail!.attachments[0]).toMatchObject({ contentType: 'application/pdf' });
  });

  it('returns null for a payload with no message id', () => {
    expect(normalisePayload({ data: { from: 'a@b.test' } })).toBeNull();
  });
});

describe('inbound email — the flow', () => {
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
    m.body.extractFromBody.mockClear();
    m.inbound.__state.addresses.clear();
    m.inbound.__state.senders.clear();
    m.inbound.__state.messages.clear();
    m.captures.__captures.clear();
    m.usage.UsageService.allowed = true;
    // One workspace with one live address.
    m.inbound.__state.addresses.set(LOCAL_PART, { id: 'addr-1', businessId: BUSINESS, localPart: LOCAL_PART });
  });

  const deliver = async (over: Record<string, unknown> = {}, id = 'em_' + Math.random()) => {
    const data: any = {
      email_id: id,
      from: `Owner <${MEMBER_EMAIL}>`,
      to: [ADDRESS],
      subject: 'Invoice 88',
      text: 'Please find the invoice attached.',
      attachments: [{ filename: 'inv.pdf', content_type: 'application/pdf', download_url: 'https://resend.com/a' }],
      ...over,
    };

    /**
     * Mirror the real two-step flow: the webhook carries metadata, and the
     * follow-up fetch is where the body and the bytes actually come from.
     */
    const fetchMod = jest.requireMock('../../../src/modules/inbound/inbound.fetch') as any;
    fetchMod.fetchReceivedEmail.mockResolvedValue({
      text: data.text ?? '',
      attachments: (data.attachments ?? []).map((a: any) => ({
        filename: a.filename ?? null,
        contentType: a.content_type,
        content: a.download_url ? Buffer.from('%PDF-1.4 fake').toString('base64') : null,
        url: null,
      })),
    });

    const payload = JSON.stringify({ data });
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await app.inject({
      method: 'POST',
      url: '/v1/inbound/resend',
      payload,
      headers: {
        'content-type': 'application/json',
        'svix-id': id,
        'svix-timestamp': ts,
        'svix-signature': sign(id, ts, payload),
      },
    });
    // The reply comes back before the reading finishes — wait for it.
    await __drain();
    return res;
  };

  it('refuses an unsigned delivery', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/inbound/resend',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('reads an attachment from a member into a pending capture', async () => {
    const res = await deliver();
    expect(res.statusCode).toBe(200);

    const { extraction, captures, inbound } = mocks();
    expect(extraction.extractDocument).toHaveBeenCalledTimes(1);

    const created = [...captures.__captures.values()];
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      businessId: BUSINESS,
      captureMethod: 'email',
      // Nobody was there — the email is the actor.
      capturedBy: null,
      status: 'pending_review',
    });
    expect(created[0].extractedFields).toMatchObject({ vendor: 'Northwind Supplies', total: 240.5 });
    expect([...inbound.__state.messages.values()][0].status).toBe('processed');
  });

  it('reads a batch of receipts sent in one email', async () => {
    // The normal way to use this: select a month of receipts, send them once.
    const many = Array.from({ length: 12 }, (_, i) => ({
      filename: `receipt-${i}.pdf`,
      content_type: 'application/pdf',
      download_url: `https://resend.com/a/${i}`,
    }));

    await deliver({ attachments: many });

    const { extraction, captures, inbound } = mocks();
    expect(extraction.extractDocument).toHaveBeenCalledTimes(12);
    expect(captures.__captures.size).toBe(12);
    expect([...inbound.__state.messages.values()][0]).toMatchObject({
      status: 'processed',
      attachmentCount: 12,
      error: null,
    });
  });

  it('says so when a batch is bigger than it will read', async () => {
    const tooMany = Array.from({ length: 25 }, (_, i) => ({
      filename: `receipt-${i}.pdf`,
      content_type: 'application/pdf',
      download_url: `https://resend.com/a/${i}`,
    }));

    await deliver({ attachments: tooMany });

    const { extraction, inbound } = mocks();
    expect(extraction.extractDocument).toHaveBeenCalledTimes(20);

    const message = [...inbound.__state.messages.values()][0];
    // The count is the TRUE one, not the truncated one — and the overflow is
    // reported rather than silently dropped.
    expect(message.attachmentCount).toBe(25);
    expect(message.error).toContain('Read 20 of 25');
    expect(message.error).toContain('over the 20-per-email limit');
  });

  it('lets one unreadable attachment fail without losing the rest', async () => {
    // One served by URL that cannot be downloaded, one inline and fine.
    const attachments = jest.requireMock('../../../src/modules/inbound/inbound.attachments') as any;
    attachments.fetchAttachment.mockRejectedValueOnce(new Error('gone'));

    const fetchMod = jest.requireMock('../../../src/modules/inbound/inbound.fetch') as any;
    await deliver({});
    fetchMod.fetchReceivedEmail.mockResolvedValue({
      text: '',
      attachments: [
        { filename: 'broken.pdf', contentType: 'application/pdf', content: null, url: 'https://resend.com/x' },
        {
          filename: 'fine.pdf', contentType: 'application/pdf',
          content: Buffer.from('%PDF-1.4').toString('base64'), url: null,
        },
      ],
    });

    mocks().captures.__captures.clear();
    mocks().inbound.__state.messages.clear();
    mocks().extraction.extractDocument.mockClear();
    await deliver({}, 'em_partial');

    expect(mocks().captures.__captures.size).toBe(1);
    expect([...mocks().inbound.__state.messages.values()][0].status).toBe('processed');
  });

  it('drops mail for an address nobody owns', async () => {
    const res = await deliver({ to: ['docs-not-a-real-address@in.finquanta.ai'] });

    expect(res.statusCode).toBe(200);
    const { extraction, inbound } = mocks();
    expect(extraction.extractDocument).not.toHaveBeenCalled();
    expect(inbound.__state.messages.size).toBe(0);
  });

  it('handles the same message twice without doubling anything', async () => {
    await deliver({}, 'em_same');
    await deliver({}, 'em_same');

    const { extraction, captures, inbound } = mocks();
    expect(extraction.extractDocument).toHaveBeenCalledTimes(1);
    expect(captures.__captures.size).toBe(1);
    expect(inbound.__state.messages.size).toBe(1);
  });

  /** THE COST GUARANTEE. */
  it('quarantines a stranger and spends nothing reading them', async () => {
    const res = await deliver({ from: 'stranger@example.test' });
    expect(res.statusCode).toBe(200);

    const { extraction, body, captures, inbound } = mocks();
    expect(extraction.extractDocument).not.toHaveBeenCalled();
    expect(body.extractFromBody).not.toHaveBeenCalled();
    expect(captures.__captures.size).toBe(0);
    expect([...inbound.__state.messages.values()][0]).toMatchObject({
      status: 'quarantined',
      senderTrusted: false,
    });
  });

  it('reads a stranger once they are trusted', async () => {
    const { inbound } = mocks();
    inbound.__state.senders.set(`${BUSINESS}|supplier@example.test`, 'trusted');

    await deliver({ from: 'supplier@example.test' });

    expect(mocks().extraction.extractDocument).toHaveBeenCalledTimes(1);
  });

  it('ignores a blocked sender outright', async () => {
    const { inbound } = mocks();
    inbound.__state.senders.set(`${BUSINESS}|spam@example.test`, 'blocked');

    await deliver({ from: 'spam@example.test' });

    expect(mocks().extraction.extractDocument).not.toHaveBeenCalled();
    expect([...mocks().inbound.__state.messages.values()][0].status).toBe('ignored');
  });

  it('falls back to the body when there is nothing worth opening', async () => {
    // A payment notice: no attachment, the money is described in the text.
    await deliver({ attachments: [], text: 'You received a payment of $1,200.00 from Acme Ltd.' });

    const { extraction, body, captures } = mocks();
    expect(extraction.extractDocument).not.toHaveBeenCalled();
    expect(body.extractFromBody).toHaveBeenCalledTimes(1);

    const created = [...captures.__captures.values()];
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ mimeType: 'text/plain', captureMethod: 'email' });
    expect(created[0].extractedFields).toMatchObject({ vendor: 'Stripe', total: 1200 });
  });

  it('creates nothing when the body turns out not to be financial', async () => {
    const { body } = mocks();
    body.extractFromBody.mockResolvedValueOnce({
      isFinancial: false,
      fields: {}, confidence: {}, documentType: 'other',
    });

    await deliver({ attachments: [], text: 'Our newsletter for August!' });

    expect(mocks().captures.__captures.size).toBe(0);
    expect([...mocks().inbound.__state.messages.values()][0].status).toBe('ignored');
  });

  it('skips an attachment type not worth paying to read', async () => {
    await deliver({
      attachments: [{ filename: 'logo.gif', content_type: 'image/gif', download_url: 'https://resend.com/l' }],
      text: '',
    });

    const { extraction, body } = mocks();
    expect(extraction.extractDocument).not.toHaveBeenCalled();
    // No text either, so nothing to fall back to.
    expect(body.extractFromBody).not.toHaveBeenCalled();
  });

  it('does not pay to read anything for a workspace out of scans', async () => {
    mocks().usage.UsageService.allowed = false;

    await deliver();

    const { extraction, inbound } = mocks();
    expect(extraction.extractDocument).not.toHaveBeenCalled();
    expect([...inbound.__state.messages.values()][0]).toMatchObject({ status: 'failed' });
  });
});
