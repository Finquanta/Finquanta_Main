import { ExportHeader } from './exports.types';

/**
 * Serialisers. Each takes the header block plus rows and returns a Buffer.
 *
 * Pure functions with no database and no Fastify, so they can be unit-tested
 * directly — which matters, because the thing most likely to break silently is
 * escaping, and nothing about a broken CSV is obvious until a customer opens
 * it in Excel.
 */

/** Excel reads a BOM-less UTF-8 CSV as the system codepage and mangles accents. */
const BOM = '﻿';

/**
 * RFC 4180: quote any field containing a comma, a quote or a newline, and
 * double the interior quotes.
 *
 * Also quotes a leading `=`, `+`, `-` or `@`. Those are not a CSV concern but a
 * spreadsheet one: Excel and Sheets treat such a cell as a formula, so a
 * transaction someone named `=cmd` becomes executable content in a file that
 * gets emailed to an accountant. Prefixing a tab keeps the text readable while
 * defusing it.
 */
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `\t${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns: readonly string[], rows: Array<Array<unknown>>): Buffer {
  const lines = [columns.map(csvField).join(',')];
  for (const row of rows) lines.push(row.map(csvField).join(','));
  // CRLF per RFC 4180 — the format's own spec, and what Excel expects.
  return Buffer.from(BOM + lines.join('\r\n') + '\r\n', 'utf8');
}

/**
 * The header block, as text lines. Shared by TXT, the CSV zip's `cover.txt`
 * and the XLSX top rows, so the four formats cannot drift on what they claim
 * about the business.
 *
 * Lines with no value are omitted entirely rather than printed empty.
 */
export function headerLines(header: ExportHeader): string[] {
  const lines = [header.businessName];
  if (header.businessPhone) lines.push(header.businessPhone);
  if (header.registrationNumber) lines.push(`Reg. No. ${header.registrationNumber}`);
  if (header.taxNumber) lines.push(`Tax No. ${header.taxNumber}`);
  lines.push('');
  lines.push(`Exported by ${header.exportedBy} — ${header.exportedAt}`);
  lines.push(`${header.rangeLabel} · ${header.basisLabel}`);
  return lines;
}

export function coverText(header: ExportHeader, totalRows: number): Buffer {
  const lines = [...headerLines(header), '', `${totalRows} row${totalRows === 1 ? '' : 's'}`];
  return Buffer.from(lines.join('\r\n') + '\r\n', 'utf8');
}

/**
 * Fixed-width listing for pasting into an email.
 *
 * Column widths are measured from the actual content rather than fixed, so a
 * long description does not push every later column out of alignment.
 */
export function toTxt(
  header: ExportHeader,
  columns: readonly string[],
  rows: Array<Array<unknown>>
): Buffer {
  const cells = rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));
  const widths = columns.map((c, i) =>
    Math.max(c.length, ...cells.map((r) => (r[i] ?? '').length), 0)
  );

  const line = (values: string[]) =>
    values.map((v, i) => v.padEnd(widths[i] ?? 0)).join('  ').trimEnd();

  const out = [
    ...headerLines(header),
    '',
    line([...columns]),
    widths.map((w) => '-'.repeat(w)).join('  '),
    ...cells.map(line),
    '',
    `${rows.length} row${rows.length === 1 ? '' : 's'}`,
  ];

  return Buffer.from(out.join('\r\n') + '\r\n', 'utf8');
}

/** Amounts are rendered once, here, so every format agrees to the cent. */
export const money2 = (n: number): string => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

/**
 * A filename that survives Content-Disposition and every filesystem.
 * The business name is user input and can contain quotes, slashes or newlines.
 */
export function safeFilename(businessName: string, what: string, ext: string): string {
  const slug = businessName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .toLowerCase() || 'business';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug}-${what}-${stamp}.${ext}`;
}
