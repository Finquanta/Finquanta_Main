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
import { decodeInline, fetchReceivedEmail } from './inbound.fetch';
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

/**
 * Event names that are definitely NOT inbound mail.
 *
 * A DENYLIST, not an allowlist, and the distinction is the whole point. An
 * earlier attempt required the type to equal exactly `email.received` — a
 * string I had guessed. Had it applied, any other spelling would have silently
 * eaten every delivery, which looks identical to nothing arriving. It never
 * applied, so nothing was lost, but the shape was wrong.
 *
 * Failing open is safe: an outbound event that slips through is addressed to a
 * customer, not to a docs- address, so it fails to route and is dropped.
 */
const OUTBOUND_EVENTS = [
  'email.sent', 'email.delivered', 'email.delivery_delayed',
  'email.bounced', 'email.complained', 'email.opened', 'email.clicked',
];

/**
 * What this process has seen since it started.
 *
 * In memory, reset by every deploy, and that is fine: the question it answers
 * is "is Resend calling us at all", which you ask now. Without it a webhook
 * that never arrives and one that is rejected look identical from inside the
 * product — which is exactly where this feature kept getting stuck.
 */
export const webhookStats = {
  total: 0,
  badSignature: 0,
  unreadable: 0,
  ignoredType: 0,
  unknownAddress: 0,
  routed: 0,
  startedAt: new Date().toISOString(),
  /**
   * The most recent rejection, in words.
   *
   * A count says a delivery was refused; it cannot say why, and the why is the
   * only part anybody can act on. Surfaced in the troubleshooting panel so the
   * answer is on screen instead of buried in the host's logs.
   */
  lastFailure: null as string | null,
  lastFailureAt: null as string | null,
};

/** How far out of step a timestamp may be before it reads as a replay. */
const TOLERANCE_SECONDS = 5 * 60;

/** Messages one workspace may receive per day. The abuse ceiling — the address
 * will leak, and this is what stops a leak becoming a bill. */
const DAILY_MESSAGE_LIMIT = Number(process.env.INBOUND_DAILY_LIMIT || 200);

/**
 * Why a signature could not be verified.
 *
 * Three completely different problems used to reach the log as one word,
 * "rejected": the wrong secret, a clock out of step, and a body that never
 * arrived as text need three different fixes, and telling them apart by
 * guesswork is what made this feature expensive to diagnose.
 */
export type SignatureFailure =
  | 'no-secret'
  | 'missing-headers'
  | 'body-not-text'
  | 'timestamp-unreadable'
  | 'timestamp-out-of-tolerance'
  | 'secret-not-base64'
  | 'no-match';

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: SignatureFailure; detail?: string };

/**
 * Does this secret even look like a Svix signing secret?
 *
 * `Buffer.from(x, 'base64')` NEVER throws — it discards whatever it cannot
 * decode and hands back a shorter buffer. So pasting an API key (`re_...`), or
 * the label along with the value, produces a silently wrong HMAC key and a
 * signature that fails for a reason nothing reports. Round-tripping the decode
 * is the cheapest way to catch that.
 */
export function describeSecret(raw: string | undefined): {
  set: boolean;
  hadSurroundingWhitespace: boolean;
  hasWhsecPrefix: boolean;
  looksBase64: boolean;
  keyBytes: number;
} {
  const set = !!raw;
  const trimmed = (raw ?? '').trim();
  const value = trimmed.replace(/^whsec_/, '');
  const decoded = Buffer.from(value, 'base64');
  return {
    set,
    // Pasting into a hosting dashboard is how a trailing newline gets in, and
    // it changes the key completely. Trimmed everywhere now, still worth saying.
    hadSurroundingWhitespace: set && raw !== trimmed,
    hasWhsecPrefix: trimmed.startsWith('whsec_'),
    looksBase64: value.length > 0 && decoded.toString('base64').replace(/=+$/, '') === value.replace(/=+$/, ''),
    keyBytes: decoded.length,
  };
}

/**
 * Svix-style signature verification, which is what Resend signs webhooks with.
 *
 * The signed content is `id.timestamp.body`, HMAC-SHA256 with the base64 key
 * from the `whsec_` secret, and the header carries a space-separated list of
 * `v1,<sig>` because a secret being rotated means two valid signatures at once.
 *
 * Returns a REASON rather than a boolean — see SignatureFailure.
 */
export function checkSignature(args: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  now?: number;
}): SignatureCheck {
  const { secret, id, timestamp, signatureHeader, body } = args;
  if (!secret) return { ok: false, reason: 'no-secret' };
  if (!id || !timestamp || !signatureHeader) {
    const missing = [
      !id && 'svix-id',
      !timestamp && 'svix-timestamp',
      !signatureHeader && 'svix-signature',
    ].filter(Boolean).join(', ');
    return { ok: false, reason: 'missing-headers', detail: `missing ${missing}` };
  }

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return { ok: false, reason: 'timestamp-unreadable' };
  const now = Math.floor((args.now ?? Date.now()) / 1000);
  const skew = now - sent;
  // Both directions: a timestamp from the future is as suspicious as an old one.
  if (Math.abs(skew) > TOLERANCE_SECONDS) {
    return {
      ok: false,
      reason: 'timestamp-out-of-tolerance',
      // Signed and negative reads as "this server's clock is behind", which is
      // a different fix from "the delivery sat in a queue".
      detail: `${skew}s out of step (tolerance ${TOLERANCE_SECONDS}s)`,
    };
  }

  const shape = describeSecret(secret);
  const key = Buffer.from(secret.trim().replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');

  const expectedBuf = Buffer.from(expected);
  const matched = signatureHeader.split(' ').some((part) => {
    const value = part.startsWith('v1,') ? part.slice(3) : part;
    const candidate = Buffer.from(value);
    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false, and the length is not the secret.
    if (candidate.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(candidate, expectedBuf);
  });
  if (matched) return { ok: true };

  /**
   * It did not match. If the secret was never a valid base64 key, THAT is the
   * finding worth reporting — "no-match" would send somebody hunting through
   * Resend's dashboard for a mismatch that is really a bad paste.
   */
  if (!shape.looksBase64) {
    return {
      ok: false,
      reason: 'secret-not-base64',
      detail: `the secret does not decode as base64 (${shape.keyBytes} usable bytes)`,
    };
  }
  return { ok: false, reason: 'no-match', detail: 'the secret does not match this webhook' };
}

/** The boolean form, for callers that only need yes or no. */
export function verifySignature(args: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  now?: number;
}): boolean {
  return checkSignature(args).ok;
}

export interface NormalisedMail {
  /** Resend's event name. Only `email.received` is ours. */
  type: string;
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

  /**
   * Every place a recipient might be named, merged.
   *
   * A forwarded message is the awkward case: depending on the client, the
   * address we care about turns up in `to`, in the SMTP envelope, or only in
   * cc. Reading one field and hoping is how a forward goes silently missing.
   */
  const recipientSources = [d.to, d.cc, d.recipient, d.recipients, d.envelope?.to];
  const to = recipientSources
    .flatMap((src: any) => (Array.isArray(src) ? src : src == null ? [] : [src]))
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
    type: String(raw?.type ?? d?.type ?? ''),
    providerMessageId: String(providerMessageId),
    from,
    to,
    subject: d.subject ?? null,
    /**
     * Usually EMPTY, and that is expected. `email.received` carries metadata
     * only; the body and the attachment bytes are fetched separately once we
     * know the message is worth reading. These fields stay here because the
     * payload may carry a preview, and using it saves a call when it does.
     */
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

  /**
   * CATCH-ALL, and it is not belt and braces.
   *
   * The signature covers the exact bytes sent, so the body must reach us as a
   * string. Registering only for `application/json` meant any other content
   * type — `text/plain`, a charset variant Fastify does not match, an absent
   * header — left `request.body` as something else, the check compared against
   * an empty string, and the delivery was rejected as a bad signature. From
   * outside that is indistinguishable from Resend never calling.
   */
  fastify.addContentTypeParser(
    '*',
    { parseAs: 'string' },
    (_req, body, done) => done(null, body)
  );

  fastify.post('/v1/inbound/resend', async (request: FastifyRequest, reply: FastifyReply) => {
    webhookStats.total += 1;
    /**
     * TRIMMED, and that is not cosmetic. Pasting a secret into a hosting
     * dashboard is exactly how a trailing newline gets into an environment
     * variable, and a single stray byte changes the HMAC key completely — for
     * a failure that looks identical to the secret simply being wrong.
     */
    const secret = (process.env.RESEND_INBOUND_SIGNING_SECRET || '').trim();
    if (!secret) {
      request.log.error('Inbound email received but RESEND_INBOUND_SIGNING_SECRET is not set.');
      return reply.status(500).send({ success: false, error: 'Inbound email is not configured.' });
    }

    const headers = request.headers as Record<string, string>;
    /**
     * A body that did not arrive as a string is its own failure, and must not
     * be laundered into `''` — an empty string is a body we could hash, so it
     * would be reported as a secret mismatch and send somebody to the wrong
     * dashboard entirely.
     */
    const bodyIsText = typeof request.body === 'string';
    const result: SignatureCheck = bodyIsText
      ? checkSignature({
        secret,
        id: headers['svix-id'] ?? headers['webhook-id'] ?? '',
        timestamp: headers['svix-timestamp'] ?? headers['webhook-timestamp'] ?? '',
        signatureHeader: headers['svix-signature'] ?? headers['webhook-signature'] ?? '',
        body: request.body as string,
      })
      : { ok: false, reason: 'body-not-text', detail: `arrived as ${typeof request.body}` };

    if (!result.ok) {
      webhookStats.badSignature += 1;
      webhookStats.lastFailure = result.detail
        ? `${result.reason} — ${result.detail}`
        : result.reason;
      webhookStats.lastFailureAt = new Date().toISOString();

      const h = request.headers as Record<string, unknown>;
      request.log.warn(
        `Rejected an inbound email: ${webhookStats.lastFailure}. ` +
        `content-type=${String(h['content-type'] ?? 'none')} ` +
        `body=${typeof request.body} ` +
        `svix-id=${h['svix-id'] ? 'present' : 'MISSING'} ` +
        `svix-timestamp=${h['svix-timestamp'] ? 'present' : 'MISSING'} ` +
        `svix-signature=${h['svix-signature'] ? 'present' : 'MISSING'} ` +
        `webhook-id=${h['webhook-id'] ? 'present' : 'missing'} ` +
        `headers=[${Object.keys(h).join(',')}]`
      );
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
    if (!mail) {
      // The field names in normalisePayload are the one guess in this module.
      // Log the SHAPE (keys only, never values — this is somebody's mail) so a
      // mismatch is one glance at the logs rather than a mystery.
      webhookStats.unreadable += 1;
      const top = Object.keys(payload ?? {});
      const inner = Object.keys((payload as any)?.data ?? {});
      request.log.warn(
        `Inbound payload not recognised. Top-level keys: [${top.join(', ')}]. data keys: [${inner.join(', ')}].`
      );
      return reply.send({ success: true, data: { ignored: 'unreadable' } });
    }

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
    // Outbound events for our OWN mail are not documents. Anything unrecognised
    // is processed rather than discarded — see OUTBOUND_EVENTS.
    if (mail.type && OUTBOUND_EVENTS.includes(mail.type)) {
      webhookStats.ignoredType += 1;
      return reply.send({ success: true, data: { ignored: mail.type } });
    }

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
  /**
   * Matched on the LOCAL PART ALONE, deliberately — not on the domain.
   *
   * Requiring `@INBOUND_DOMAIN` meant a single environment variable being unset
   * or spelled differently on Render silently dropped every message, with
   * nothing to show for it. It also broke Resend's own `*.resend.app` receiving
   * domain, which is the obvious thing to try before wiring up DNS.
   *
   * Safe because a local part is 20 random hex characters: nothing else routed
   * to this server will collide with one by accident.
   */
  const local = mail.to
    .map((addr) => (addr.split('@')[0] ?? '').toLowerCase())
    .filter(Boolean);

  let address = null;
  for (const part of local) {
    address = await inbound.findByLocalPart(part);
    if (address) break;
  }
  if (!address) {
    // Logged with what was actually tried. A silent drop here was the single
    // hardest thing to diagnose about this feature.
    webhookStats.unknownAddress += 1;
    log.warn(
      `Inbound email for an unknown address; dropped. Recipients seen: ${
        mail.to.join(', ') || '(none parsed)'
      }. Expected domain: ${INBOUND_DOMAIN}.`
    );
    return;
  }

  webhookStats.routed += 1;

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
  /** Filled in below, once we know the sender is worth spending on. */
  let body = mail.text;

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

  /**
   * NOW fetch the actual email.
   *
   * Deliberately after the trust and allowance checks, not before. The webhook
   * is metadata only, so a stranger's mail costs us one tiny request and
   * nothing more — we never download bytes we were not going to read. That is
   * the same rule as never extracting for an untrusted sender, applied one
   * step earlier.
   */
  let fetched: { filename: string | null; contentType: string; buffer: Buffer }[] = [];
  try {
    const full = await fetchReceivedEmail(mail.providerMessageId);
    if (full.text) body = full.text;

    for (const a of full.attachments) {
      if (!READABLE_ATTACHMENT_TYPES.includes(a.contentType)) continue;
      if (fetched.length >= Math.min(MAX_ATTACHMENTS_PER_MESSAGE, affordable)) break;
      try {
        const buffer = a.content
          ? decodeInline(a.content)
          : a.url
            ? (await fetchAttachment(a.url)).body
            : null;
        if (!buffer || !buffer.byteLength) continue;
        fetched.push({ filename: a.filename, contentType: a.contentType, buffer });
      } catch (error) {
        // One bad attachment must not lose the others.
        log.error(error);
      }
    }
    /**
     * Nothing usable came back, but something was attached.
     *
     * The likeliest cause is a content type we do not accept, or one Resend
     * did not label at all — and that is invisible from the product, where it
     * simply looks as though the document was ignored. Log the types actually
     * seen so the answer is one glance at the logs rather than a guess.
     */
    if (fetched.length === 0 && full.attachments.length > 0) {
      log.warn(
        `Inbound email ${mail.providerMessageId}: none of its ${full.attachments.length} ` +
        `attachments were readable. Types seen: [${
          full.attachments.map((a) => a.contentType || '(none given)').join(', ')
        }]. Accepted: [${READABLE_ATTACHMENT_TYPES.join(', ')}].`
      );
    }
  } catch (error) {
    // The metadata told us mail arrived; we simply could not read it. Record
    // that rather than dropping it, so somebody can see it happened.
    log.error(error);
    await inbound.setStatus(
      message.id,
      'failed',
      error instanceof Error ? error.message : 'Could not read that email from Resend.'
    );
    return;
  }

  try {
    let produced = 0;

    for (const attachment of fetched) {
      try {
        const capture = await ingestDocument(
          { repo: deps.captures, storage: deps.storage, onError: (e) => log.error(e) },
          {
            businessId,
            // Nobody was there. The email is the actor.
            userId: null,
            captureMethod: 'email',
            buffer: attachment.buffer,
            mimeType: attachment.contentType,
            filename: attachment.filename,
            documentType: 'other',
          }
        );
        await inbound.linkCapture(capture.id, message.id);
        produced++;
      } catch (error) {
        // One bad document must not lose the others.
        log.error(error);
      }
    }

    // 5. No attachment worth reading — the money may still be described in the
    //    body, which is how nearly every "you got paid" notice arrives.
    if (produced === 0 && body.trim()) {
      const result = await extractFromBody({
        subject: mail.subject,
        fromEmail,
        fromName,
        body,
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
            buffer: Buffer.from(body, 'utf8'),
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
