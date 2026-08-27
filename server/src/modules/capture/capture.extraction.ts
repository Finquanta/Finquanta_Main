import {
  ConfidenceScores, DocumentType, ExtractedFields, DOCUMENT_TYPES, emptyFields, isDocumentType,
} from './capture.types';

/**
 * Reading a photographed or scanned document into fields.
 *
 * Called over plain `fetch`, deliberately without @anthropic-ai/sdk — the same
 * reasoning written into council.service.ts and brain.enrich.ts: the server has
 * no AI dependency today and adding one risks the Render build.
 *
 * Model capabilities were checked against the Models API rather than assumed,
 * and two of them shape this call:
 *   - Haiku 4.5 reports `image_input` AND `pdf_input` supported, so a photo and
 *     a scanned PDF go through the SAME call with only the content block
 *     differing. There is no rasterising step anywhere in this feature.
 *   - It reports `effort: false` and adaptive thinking unsupported. Passing
 *     either would be a 400, so neither appears below. Extraction wants neither.
 */

/** Haiku unless overridden — the cost lever, kept in config not in code. */
const MODEL = process.env.CAPTURE_MODEL || 'claude-haiku-4-5';
const MAX_TOKENS = 2000;
const CALL_TIMEOUT_MS = 60_000;

/** Image types the Messages API accepts directly. HEIC is converted client-side. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, 'application/pdf'];

/**
 * The shape the model must answer in. Every field nullable on purpose: a blurry
 * photo should come back with blanks for the user to fill, never with invented
 * values that read as authoritative (spec section 16).
 */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'vendor', 'documentDate', 'total', 'taxAmount', 'currency',
    'documentNumber', 'suggestedType', 'lineItems', 'confidence',
  ],
  properties: {
    vendor: { type: ['string', 'null'], description: 'Who issued this document.' },
    documentDate: { type: ['string', 'null'], description: 'Date on the document, YYYY-MM-DD.' },
    total: { type: ['number', 'null'], description: 'Grand total including tax.' },
    taxAmount: { type: ['number', 'null'], description: 'Tax or VAT portion, if shown.' },
    currency: { type: ['string', 'null'], description: 'ISO code, for example USD or EUR.' },
    documentNumber: { type: ['string', 'null'], description: 'Invoice or receipt number.' },
    suggestedType: { type: ['string', 'null'], enum: [...DOCUMENT_TYPES, null] },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'quantity', 'unitPrice', 'amount'],
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unitPrice: { type: ['number', 'null'] },
          amount: { type: ['number', 'null'] },
        },
      },
    },
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
} as const;

const SYSTEM = [
  'You read financial documents - receipts, bills, invoices, payment proofs, loan paperwork -',
  'and return exactly what is printed on them.',
  '',
  'Rules that matter more than completeness:',
  '- Never invent a value. If a field is not legible or not present, return null for it.',
  '- Confidence is not politeness. A value you inferred rather than read must score below 0.5.',
  '- Amounts are numbers, not strings, and never include a currency symbol.',
  '- The total is what was actually charged, including tax.',
  '- Dates are YYYY-MM-DD. If the year is absent, return null rather than assuming one.',
].join('\n');

export interface ExtractionResult {
  fields: ExtractedFields;
  confidence: ConfidenceScores;
  documentType: DocumentType;
}

/** Build the content block for whichever kind of file this is. */
function sourceBlock(mime: string, base64: string) {
  if (mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }
  return { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };
}

/**
 * Read one document. Throws on transport or API failure so the caller can record
 * the error and still show the user an empty, editable form.
 */
export async function extractDocument(
  file: Buffer,
  mime: string,
  hintedType: DocumentType
): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Document reading is not configured on this server.');
  }

  // Buffer.toString('base64') never inserts newlines, which the API rejects.
  const base64 = file.toString('base64');

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
        // Structured output rather than parsing prose - the schema is the
        // contract, so a malformed answer fails here instead of downstream.
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            // The document goes FIRST, the instruction after it.
            sourceBlock(mime, base64),
            {
              type: 'text',
              text: `Read this ${hintedType.replace(/_/g, ' ')} and return its fields.`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      (error as Error)?.name === 'TimeoutError'
        ? 'Reading the document timed out.'
        : 'Could not reach the document reading service.'
    );
  }

  if (!res.ok) {
    throw new Error(`Could not read the document (${res.status}).`);
  }

  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('The document reader returned nothing.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The document reader returned an unreadable answer.');
  }

  return shape(parsed, hintedType);
}

/** Coerce the model's answer into our own types, defensively. */
function shape(raw: Record<string, unknown>, hintedType: DocumentType): ExtractionResult {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const rawItems = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  const lineItems = rawItems
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      description: str(i.description) ?? '',
      quantity: num(i.quantity),
      unitPrice: num(i.unitPrice),
      amount: num(i.amount),
    }))
    .filter((i) => i.description || i.amount !== null);

  const suggested = str(raw.suggestedType);
  const fields: ExtractedFields = {
    ...emptyFields(),
    vendor: str(raw.vendor),
    documentDate: str(raw.documentDate),
    total: num(raw.total),
    taxAmount: num(raw.taxAmount),
    currency: str(raw.currency)?.toUpperCase() ?? null,
    documentNumber: str(raw.documentNumber),
    suggestedType: isDocumentType(suggested) ? suggested : null,
    lineItems,
  };

  const rawConf = (raw.confidence ?? {}) as Record<string, unknown>;
  const confidence: ConfidenceScores = {};
  for (const key of ['vendor', 'documentDate', 'total', 'taxAmount', 'currency', 'documentNumber'] as const) {
    const v = num(rawConf[key]);
    if (v !== null) confidence[key] = Math.max(0, Math.min(1, v));
    // A field that came back empty is not "low confidence", it is absent -
    // scoring it 0 lets the popup flag exactly the values worth re-reading.
    else if (fields[key] === null) confidence[key] = 0;
  }

  return {
    fields,
    confidence,
    // The user's own choice wins over the model's guess; the guess only fills in
    // when they left it on the default.
    documentType: hintedType === 'other' && fields.suggestedType ? fields.suggestedType : hintedType,
  };
}
