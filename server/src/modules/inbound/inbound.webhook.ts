import crypto from 'crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Database } from '../../infrastructure/database';
import { createStorageDriver, StorageDriver } from '../../infrastructure/object-storage';
import { CaptureRepository } from '../capture/capture.repository';
import { ingestDocument, storeExtractedDocument } from '../capture/capture.service';
import { UsageService } from '../billing/usage.service';
import { InboundRepository } from './inbound.repository';
import { fetchAttachment } from './inbound.attachments';
import { extractFromBody } from './inbound.body-extraction';
import {
  INBOUND_DOMAIN, MAX_ATTACHMENTS_PER_MESSAGE, READABLE_ATTACHMENT_TYPES, parseFromHeader,
} from './inbound.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Inbound email webhook.
 *
 * Registered as its OWN plugin instance, because it needs the raw request body
 * to verify a signature and Fastify scopes a body parser to the instance it is
 * set on — the same reason `stripeWebhookRoutes` is isolated in api.ts. Every
 * other route keeps parsing JSON normally.
 *
 * THIS ENDPOINT IS UNAUTHENTICATED in the session sense: Resend has no login.
 * The signature is the credential, and everything below assumes the payload is
 * hostile until it has been checked.
 */

/** How far out of step a timestamp may be before it reads as a replay. */
const TOLERANCE_SECONDS = 5 * 60;

/** Messages one workspace may receive per day. The abuse ceiling — the address
 * will leak, and this is what stops a leak becoming a bill. */
const DAILY_MESSAGE_LIMIT = Number(process.env.INBOUND_DAILY_LIMIT || 200);

/**
 * Svix-style signature verification, which is what Resend signs webhooks with.
 *
 * The signed content is `id.timestamp.body`, HMAC-SHA256 with the base64 key
 * from the `whsec_` secret, and the header carries a space-separated list of
 * `v1,<sig>` because a secret being rotated means two valid signatures at once.
 */
export function verifySignature(args: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signatureHeader, body } = args;
  if (!secret || !id || !timestamp || !signatureHeader) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  const now = Math.floor((args.now ?? Date.now()) / 1000);
  // Both directions: a timestamp from the future is as suspicious as an old one.
  if (Math.abs(now - sent) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');

  const expectedBuf = Buffer.from(expected);
  return signatureHeader.split(' ').some((part) => {
    const value = part.startsWith('v1,') ? part.slice(3) : part;
    const candidate = Buffer.from(value);
    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false, and the length is not the secret.
    if (candidate.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(candidate, expectedBuf);
  });
}

export interface NormalisedMail {
  providerMessageId: string;
  from: string;
  to: string[];
  subject: string | null;
  text: string;
  attachments: { filename: string | null; contentType: string; url: string }[];
}

/**
 * Map the provider's payload onto what we need.
 *
 * THIS IS THE ONE FUNCTION TO CHECK AGAINST A REAL PAYLOAD before going live.
 * The field names below are read defensively across the shapes Resend's inbound
 * payload plausibly uses, so a rename breaks here and nowhere else — but a
 * guess is still a guess. Log one real delivery and confirm.
 */
export function normalisePayload(raw: any): NormalisedMail | null {
  const d = raw?.data ?? raw;
  if (!d) return null;

  const providerMessageId = d.email_id ?? d.message_id ?? d.id ?? raw?.id;
  if (!providerMessageId) return null;

  const from = typeof d.from === 'string' ? d.from : d.from?.address ?? d.from?.email ?? '';
  if (!from) return null;

  const toRaw = d.to ?? d.recipient ?? d.recipients ?? [];
  const to = (Array.isArray(toRaw) ? toRaw : [toRaw])
    .map((x: any) => (typeof x === 'string' ? x : x?.address ?? x?.email ?? ''))
    .filter(Boolean)
    .map((x: string) => parseFromHeader(x).email);

  const attachments = (Array.isArray(d.attachments) ? d.attachments : [])
    .map((a: any) => ({
      filename: a?.filename ?? a?.name ?? null,
      contentType: ((a?.content_type ?? a?.contentType ?? '').split(';')[0] ?? '').trim().toLowerCase(),
      url: a?.download_url ?? a?.url ?? '',
    }))
    .filter((a: any) => a.url);

  return {
    providerMessageId: String(providerMessageId),
    from,
    to,
    subject: d.subject ?? null,
    text: d.text ?? d.plain ?? d.body_plain ?? '',
    attachments,
  };
}

export async function inboundWebhookRoutes(
  fastify: FastifyInstance,
  options: { database: Database }
) {
  const inbound = new InboundRepository(options.database);
  const captures = new CaptureRepository(options.database);
  const usage = new UsageService(options.database);
  const storage: StorageDriver = createStorageDriver(options.database);

  /**
   * Raw body, scoped to this plugin instance. The signature covers the exact
   * bytes sent; re-serialising parsed JSON would change them.
   */
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => done(null, body)
  );

  fastify.post('/v1/inbound/resend', async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = process.env.RESEND_INBOUND_SIGNING_SECRET || '';
    if (!secret) {
      request.log.error('Inbound email received but RESEND_INBOUND_SIGNING_SECRET is not set.');
      return reply.status(500).send({ success: false, error: 'Inbound email is not configured.' });
    }

    const headers = request.headers as Record<string, string>;
    const ok = verifySignature({
      secret,
      id: headers['svix-id'] ?? headers['webhook-id'] ?? '',
      timestamp: headers['svix-timestamp'] ?? headers['webhook-timestamp'] ?? '',
      signatureHeader: headers['svix-signature'] ?? headers['webhook-signature'] ?? '',
      body: typeof request.body === 'string' ? request.body : '',
    });
    if (!ok) {
      request.log.warn('Rejected an inbound email with a bad signature.');
      return reply.status(401).send({ success: false, error: 'Invalid signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(request.body as string);
    } catch {
      return reply.status(400).send({ success: false, error: 'Malformed payload' });
    }

    const mail = normalisePayload(payload);
    // 200, not 400. An unreadable payload we cannot act on is still a payload
    // Resend should stop retrying.
    if (!mail) return reply.send({ success: true, data: { ignored: 'unreadable' } });

    /**
     * ACKNOWLEDGE FIRST, WORK AFTER. This is not an optimisation.
     *
     * Somebody selecting a month of receipts and sending them in one email is
     * the normal way to use this, and every attachment costs a download plus a
     * vision call — seconds each. Twenty of them is minutes, and no webhook
     * sender waits minutes: Resend would time out and retry, the retry would
     * find the message already recorded and do nothing, and the mail would be
     * half-read forever with nothing saying so.
     *
     * So the reply goes back immediately and the reading happens behind it. The
     * message row carries the state, which is what the inbox reads.
     */
    const work = handleMail({ inbound, captures, storage, usage, log: request.log }, mail)
      .catch((error) => request.log.error(error))
      .finally(() => { inFlight.delete(work); });
    inFlight.add(work);

    return reply.send({ success: true, data: { received: true } });
  });
}

/**
 * Work still running behind an acknowledged webhook.
 *
 * Tracked only so tests can wait for it — without this they would assert
 * against a message that is still being read. Nothing in production reads this
 * set; a process that dies mid-read leaves the message in `processing`, which
 * is visible in the inbox rather than silently lost.
 */
const inFlight = new Set<Promise<unknown>>();

/** Exported for the tests: settle everything the webhook started. */
export const __drain = (): Promise<unknown> => Promise.all([...inFlight]);

interface Deps {
  inbound: InboundRepository;
  captures: CaptureRepository;
  storage: StorageDriver;
  usage: UsageService;
  log: { error: (...a: any[]) => void; warn: (...a: any[]) => void; info: (...a: any[]) => void };
}

/**
 * Decide what a delivered message is, and do it.
 *
 * The order of the checks is the whole security design: resolve, dedupe, cap,
 * THEN trust — and only a trusted sender ever reaches something that costs
 * money.
 */
async function handleMail(deps: Deps, mail: NormalisedMail): Promise<void> {
  const { inbound, log } = deps;

  // 1. Which workspace? Unknown recipients are dropped silently — bouncing
  //    would confirm to a stranger which addresses are real.
  const local = mail.to
    .filter((addr) => addr.endsWith(`@${INBOUND_DOMAIN}`))
    .map((addr) => (addr.split('@')[0] ?? '').toLowerCase())
    .filter(Boolean);

  let address = null;
  for (const part of local) {
    address = await inbound.findByLocalPart(part);
    if (address) break;
  }
  if (!address) {
    log.info('Inbound email for an unknown address; dropped.');
    return;
  }

  // 2. Already handled? Webhooks retry until acknowledged.
  const seen = await inbound.findByProviderId(mail.providerMessageId);
  if (seen) return;

  const businessId = address.businessId;
  const { email: fromEmail, name: fromName } = parseFromHeader(mail.from);

  // 3. The ceiling, before anything is stored or read.
  if ((await inbound.countToday(businessId)) >= DAILY_MESSAGE_LIMIT) {
    log.warn(`Inbound daily limit reached for business ${businessId}.`);
    return;
  }

  // 4. Trust. A member forwarding from their own mailbox is the ordinary case
  //    and needs no approval; anyone else is held.
  const explicit = await inbound.senderStatus(businessId, fromEmail);
  const trusted = explicit === 'trusted' || (explicit === null && await inbound.isMemberEmail(businessId, fromEmail));
  const blocked = explicit === 'blocked';

  /**
   * Bulk is the normal case, not the exception: people select a month of
   * receipts and send them in one email rather than forwarding one at a time.
   *
   * `skipped` is counted rather than quietly discarded. Dropping the 21st
   * receipt without saying so would mean somebody's books are short by one and
   * nothing on screen suggests why.
   */
  const allReadable = mail.attachments.filter((a) =>
    READABLE_ATTACHMENT_TYPES.includes(a.contentType)
  );
  const readable = allReadable.slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  const skipped = allReadable.length - readable.length;

  const message = await inbound.createMessage({
    businessId,
    addressId: address.id,
    providerMessageId: mail.providerMessageId,
    fromEmail,
    fromName,
    subject: mail.subject,
    status: blocked ? 'ignored' : trusted ? 'processing' : 'quarantined',
    senderTrusted: trusted,
    attachmentCount: allReadable.length,
  });

  /**
   * THE COST GUARANTEE.
   *
   * An untrusted or blocked sender stops here. Nothing is downloaded, nothing
   * is read, and no AI call is made. Without this, anyone who learns the
   * address can run up the Anthropic bill by mailing it — the address is a
   * routing label, not a secret we can rely on.
   */
  if (!trusted) return;

  /**
   * Out of scans? Then reading this costs money for something the workspace
   * cannot confirm anyway.
   *
   * Same "cheapest check first" rule the upload endpoint follows. Consumption
   * still happens at CONFIRMATION, not here — this only decides whether it is
   * worth paying Anthropic to read the thing at all.
   */
  const allowance = await deps.usage.check(businessId, 'document_scans');
  if (!allowance.allowed) {
    await inbound.setStatus(
      message.id,
      'failed',
      'No document scans left this month. Upgrade, or forward this again next month.'
    );
    return;
  }

  /**
   * Read only what the workspace can actually keep.
   *
   * `allowed` above is a yes/no — "is there at least one scan left". That is
   * not enough for a batch: with three scans left and twelve receipts attached,
   * it would say yes and we would pay Anthropic to read all twelve so the user
   * could confirm three. The other nine would be extracted, charged to us, and
   * refused at the moment they tried to save them.
   *
   * `remaining` is null on an unlimited plan, which means no limit rather than
   * none left.
   */
  const affordable = allowance.remaining ?? Number.MAX_SAFE_INTEGER;
  const toRead = readable.slice(0, affordable);
  const unaffordable = readable.length - toRead.length;

  try {
    let produced = 0;

    for (const attachment of toRead) {
      try {
        const file = await fetchAttachment(attachment.url);
        const capture = await ingestDocument(
          { repo: deps.captures, storage: deps.storage, onError: (e) => log.error(e) },
          {
            businessId,
            // Nobody was there. The email is the actor.
            userId: null,
            captureMethod: 'email',
            buffer: file.body,
            mimeType: attachment.contentType || file.contentType,
            filename: attachment.filename,
            documentType: 'other',
          }
        );
        await inbound.linkCapture(capture.id, message.id);
        produced++;
      } catch (error) {
        // One bad attachment must not lose the others.
        log.error(error);
      }
    }

    // 5. No attachment worth reading — the money may still be described in the
    //    body, which is how nearly every "you got paid" notice arrives.
    if (produced === 0 && mail.text.trim()) {
      const result = await extractFromBody({
        subject: mail.subject,
        fromEmail,
        fromName,
        body: mail.text,
      });
      await inbound.markBodyExtracted(message.id);

      if (result.isFinancial) {
        const capture = await storeExtractedDocument(
          { repo: deps.captures, storage: deps.storage },
          {
            businessId,
            userId: null,
            captureMethod: 'email',
            // The body itself is the document, so the review popup has
            // something to show beside the fields.
            buffer: Buffer.from(mail.text, 'utf8'),
            mimeType: 'text/plain',
            filename: mail.subject ? `${mail.subject.slice(0, 80)}.txt` : 'email.txt',
            documentType: result.documentType,
            fields: result.fields,
            confidence: result.confidence,
          }
        );
        await inbound.linkCapture(capture.id, message.id);
        produced++;
      }
    }

    /**
     * Say what was left behind, and why — the two reasons are different and a
     * user can only act on one of them.
     */
    const notes: string[] = [];
    if (unaffordable > 0) {
      notes.push(
        `${unaffordable} more could not be read — that is all the document scans left this month.`
      );
    }
    if (skipped > 0) {
      notes.push(`${skipped} more were over the ${MAX_ATTACHMENTS_PER_MESSAGE}-per-email limit — send them separately.`);
    }

    await inbound.setStatus(
      message.id,
      produced > 0 ? 'processed' : 'ignored',
      notes.length ? `Read ${produced} of ${allReadable.length}. ${notes.join(' ')}` : null
    );
  } catch (error) {
    await inbound.setStatus(
      message.id,
      'failed',
      error instanceof Error ? error.message : 'Could not process that email.'
    );
    throw error;
  }
}
