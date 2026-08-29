import {
  ConfidenceScores, DocumentType, DOCUMENT_TYPES, ExtractedFields, emptyFields, isDocumentType,
} from '../capture/capture.types';

/**
 * Reading a financial email that has no attachment.
 *
 * This is the half that covers "money I got from clients". A Stripe, PayPal or
 * bank "you have been paid" notice almost never carries a PDF — the amount, the
 * payer and the date are in the body text. So is a plain "here's what you owe
 * me" email from a small supplier.
 *
 * Same shape as `capture.extraction.ts` deliberately: plain `fetch` rather than
 * @anthropic-ai/sdk (the server has no AI dependency and adding one risks the
 * Render build), Haiku by default, structured output against a schema.
 *
 * THE IMPORTANT FIELD IS `isFinancial`.
 *
 * Most mail that reaches this address will be a receipt confirmation, a
 * newsletter, an out-of-office or a thread reply. The model is told to say so
 * plainly, and a `false` answer creates no capture at all. Without that, every
 * piece of noise becomes a half-filled entry somebody has to dismiss by hand,
 * and the queue stops being worth opening.
 */

/**
 * PINNED TO A DATED ID, and it matters here specifically.
 *
 * This call uses structured outputs (`output_config`), and Anthropic documents
 * support for that against dated model ids — `claude-haiku-4-5-20251001` — not
 * the bare `claude-haiku-4-5` alias. The alias is fine for an ordinary Messages
 * call, which is why Council and Finna were unaffected while the two paths that
 * READ DOCUMENTS both failed: they are the only two using output_config.
 */
const MODEL = process.env.CAPTURE_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1500;
const CALL_TIMEOUT_MS = 45_000;

/** Bodies are truncated before sending. A 200KB marketing email costs real
 * tokens and its first screenful already says what it is. */
const MAX_BODY_CHARS = 12_000;

/**
 * A nullable field, in the ONE form structured outputs accepts.
 *
 * `{ type: ['string', 'null'] }` is ordinary JSON Schema and is NOT supported
 * here: the documented types are the basic ones, and a union has to be written
 * as `anyOf`. Combining a union type with `enum` is rejected outright, which is
 * what stopped every single document being read:
 *
 *   output_config.format.schema: Invalid schema: Enum value 'receipt' does not
 *   match declared type '['string', 'null']'
 *
 * The whole request is refused for one bad property, so this is all-or-nothing:
 * every nullable field goes through here, not just the enum that reported it.
 */
const nullable = (schema: Record<string, unknown>, description?: string) => ({
  anyOf: [schema, { type: 'null' }],
  ...(description ? { description } : {}),
});

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isFinancial', 'documentType', 'vendor', 'documentDate', 'total',
    'taxAmount', 'currency', 'documentNumber', 'confidence',
  ],
  properties: {
    isFinancial: {
      type: 'boolean',
      description:
        'True ONLY if this email records a specific payment made, received, or owed, with an amount. ' +
        'Newsletters, marketing, receipts for nothing, notifications, and ordinary correspondence are false.',
    },
    documentType: nullable({ type: 'string', enum: [...DOCUMENT_TYPES] }),
    vendor: nullable({ type: 'string' }, 'The other party — who was paid, or who paid.'),
    documentDate: nullable({ type: 'string' }, 'YYYY-MM-DD.'),
    total: nullable({ type: 'number' }),
    taxAmount: nullable({ type: 'number' }),
    currency: nullable({ type: 'string' }, 'ISO code, for example USD or EUR.'),
    documentNumber: nullable({ type: 'string' }, 'Invoice, receipt or reference number.'),
    confidence: {
      type: 'object',
      additionalProperties: false,
      required: ['vendor', 'documentDate', 'total', 'taxAmount', 'currency', 'documentNumber'],
      description: '0-1 per field. Be honest: a guessed value must score low.',
      properties: {
        vendor: { type: 'number' },
        documentDate: { type: 'number' },
        total: { type: 'number' },
        taxAmount: { type: 'number' },
        currency: { type: 'number' },
        documentNumber: { type: 'number' },
      },
    },
  },
};

const SYSTEM = [
  'You read business emails and decide whether each one records a real financial event.',
  '',
  'Rules that matter more than completeness:',
  '- Most emails are NOT financial. Say so. `isFinancial: false` is the common, correct answer.',
  '- An email is financial only if a specific amount of money changed hands or is owed.',
  '- A marketing email mentioning prices is not financial. Nor is a subscription renewal REMINDER;',
  '  the receipt for the charge is.',
  '- Never invent a value. If a field is not stated, return null for it.',
  '- Confidence is not politeness. A value you inferred rather than read must score below 0.5.',
  '- Amounts are numbers, never strings, and never include a currency symbol.',
  '- Dates are YYYY-MM-DD. If the year is absent, return null rather than assuming one.',
].join('\n');

export interface BodyExtractionResult {
  isFinancial: boolean;
  fields: ExtractedFields;
  confidence: ConfidenceScores;
  documentType: DocumentType;
}

/**
 * Read one email body. Throws on transport or API failure so the caller can
 * record the error against the message.
 */
export async function extractFromBody(input: {
  subject: string | null;
  fromEmail: string;
  fromName: string | null;
  body: string;
}): Promise<BodyExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Email reading is not configured on this server.');
  }

  const from = input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail;
  const text = [
    `From: ${from}`,
    `Subject: ${input.subject ?? '(none)'}`,
    '',
    input.body.slice(0, MAX_BODY_CHARS),
  ].join('\n');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: text }],
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      (error as Error)?.name === 'TimeoutError'
        ? 'Reading that email timed out.'
        : 'Could not reach the email reading service.'
    );
  }

  if (!res.ok) {
    // The body, truncated — a status code alone cannot separate a rejected
    // schema from an expired key, and this string is all anybody sees.
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Could not read that email (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ''}.`
    );
  }

  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const raw = json.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!raw) throw new Error('The email reader returned nothing.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The email reader returned an unreadable answer.');
  }

  return shape(parsed);
}

/** Coerce the model's answer into our own types, defensively. */
function shape(raw: Record<string, unknown>): BodyExtractionResult {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const fields: ExtractedFields = {
    ...emptyFields(),
    vendor: str(raw.vendor),
    documentDate: str(raw.documentDate),
    total: num(raw.total),
    taxAmount: num(raw.taxAmount),
    currency: str(raw.currency)?.toUpperCase() ?? null,
    documentNumber: str(raw.documentNumber),
    suggestedType: isDocumentType(str(raw.documentType)) ? (raw.documentType as DocumentType) : null,
    lineItems: [],
  };

  const rawConf = (raw.confidence ?? {}) as Record<string, unknown>;
  const confidence: ConfidenceScores = {};
  for (const key of ['vendor', 'documentDate', 'total', 'taxAmount', 'currency', 'documentNumber'] as const) {
    const v = num(rawConf[key]);
    if (v !== null) confidence[key] = Math.max(0, Math.min(1, v));
    else if (fields[key] === null) confidence[key] = 0;
  }

  return {
    // An email claiming to be financial with no amount at all is not one. This
    // catches the model being agreeable rather than accurate.
    isFinancial: raw.isFinancial === true && fields.total !== null,
    fields,
    confidence,
    documentType: fields.suggestedType ?? 'other',
  };
}
