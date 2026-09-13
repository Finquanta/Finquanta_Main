/**
 * The PDF — the copy you hand to a lender, an investor or an accountant.
 *
 * `pdfmake` rather than bare `pdfkit` because it does repeating header rows
 * across pages, column widths and page numbers declaratively; hand-rolling
 * pagination for a long ledger is exactly where the bugs would be. And not
 * Puppeteer: ~300MB of Chromium on an already-slow boot, for a table.
 *
 * FONT COVERAGE, stated plainly: pdfmake ships Roboto, which covers Latin,
 * Latin Extended, Cyrillic and Greek. That is en/es/fr/de/nl/pt/ru. It does
 * NOT cover Japanese, Chinese or Arabic — CJK needs a ~16MB face, and Arabic
 * additionally needs bidi and glyph shaping, which pdfmake does not do. Rather
 * than emit a page of empty boxes, `unrenderable()` below detects such text so
 * the caller can steer that export to Excel or CSV, which embed any text
 * correctly.
 */
import { ExportHeader, MAX_PDF_ROWS } from './exports.types';

/** Characters Roboto cannot draw: CJK, Arabic, Hebrew, Thai, Devanagari, Hangul. */
const UNSUPPORTED =
  /[֐-׿؀-ۿ܀-ݏऀ-ॿ฀-๿ᄀ-ᇿ　-ヿ㄰-㆏一-鿿가-힯豈-﫿]/;

/** The first few offending strings, for a message that says what is wrong. */
export function unrenderable(values: Array<unknown>): string[] {
  const hits: string[] = [];
  for (const v of values) {
    const s = v === null || v === undefined ? '' : String(v);
    if (UNSUPPORTED.test(s)) hits.push(s);
    if (hits.length >= 3) break;
  }
  return hits;
}

export class PdfTooLongError extends Error {
  constructor(public readonly rows: number) {
    super(`A PDF of ${rows} rows is too long. Use Excel or CSV for a run this size.`);
    this.name = 'PdfTooLongError';
  }
}

export class PdfUnsupportedTextError extends Error {
  constructor(public readonly samples: string[]) {
    super('This export contains characters the PDF font cannot render. Use Excel or CSV instead.');
    this.name = 'PdfUnsupportedTextError';
  }
}

export async function toPdf(
  header: ExportHeader,
  columns: readonly string[],
  table: Array<Array<unknown>>
): Promise<Buffer> {
  if (table.length > MAX_PDF_ROWS) throw new PdfTooLongError(table.length);

  const offenders = unrenderable([
    header.businessName,
    ...table.flat(),
  ]);
  if (offenders.length > 0) throw new PdfUnsupportedTextError(offenders);

  // Required at call time, not module load: these are lazily imported by the
  // route so the server boots without them.
  const PdfPrinter = require('pdfmake') as any;
  const vfs = require('pdfmake/build/vfs_fonts.js');

  const printer = new PdfPrinter({
    Roboto: {
      normal: Buffer.from(fontData(vfs, 'Roboto-Regular.ttf'), 'base64'),
      bold: Buffer.from(fontData(vfs, 'Roboto-Medium.ttf'), 'base64'),
      italics: Buffer.from(fontData(vfs, 'Roboto-Italic.ttf'), 'base64'),
      bolditalics: Buffer.from(fontData(vfs, 'Roboto-MediumItalic.ttf'), 'base64'),
    },
  });

  const identity: Array<Array<unknown>> = [];
  if (header.businessPhone) identity.push([header.businessPhone]);
  if (header.registrationNumber) identity.push([`Reg. No. ${header.registrationNumber}`]);
  if (header.taxNumber) identity.push([`Tax No. ${header.taxNumber}`]);

  const companyBlock = {
    stack: [
      { text: header.businessName, style: 'company' },
      ...identity.map((l) => ({ text: String(l[0]), style: 'meta' })),
      { text: ' ', fontSize: 4 },
      { text: `Exported by ${header.exportedBy} — ${header.exportedAt}`, style: 'meta' },
      { text: `${header.rangeLabel} · ${header.basisLabel}`, style: 'meta' },
    ],
  };

  // The logo row collapses entirely when there is no logo — no placeholder box,
  // no reserved gap.
  const headerContent = header.logoDataUri
    ? {
        columns: [
          { image: header.logoDataUri, fit: [110, 55] as [number, number], width: 110 },
          { ...companyBlock, margin: [12, 0, 0, 0] as [number, number, number, number] },
        ],
        columnGap: 0,
      }
    : companyBlock;

  const moneyAt = columns.map((c) => c === 'Amount' || c === 'Total');

  const doc = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 28, 28, 40] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: '#1b263b' },
    styles: {
      company: { fontSize: 15, bold: true, color: '#0f172a' },
      meta: { fontSize: 8.5, color: '#5b6672' },
      th: { bold: true, fontSize: 8.5, color: '#0f172a', fillColor: '#eff1f3' },
    },
    content: [
      headerContent,
      { text: ' ', fontSize: 8 },
      {
        table: {
          // Row 1 is the column row, repeated at the top of every page.
          headerRows: 1,
          widths: columns.map((c) =>
            c === 'Description' || c === 'Name' ? '*' : 'auto'
          ),
          body: [
            columns.map((c) => ({ text: c, style: 'th', alignment: alignOf(c) })),
            ...table.map((row) =>
              row.map((cell, i) => ({
                text: cell === null || cell === undefined ? '' : String(cell),
                alignment: moneyAt[i] ? 'right' : 'left',
              }))
            ),
          ],
        },
        layout: {
          hLineWidth: (i: number) => (i <= 1 ? 0.8 : 0.3),
          vLineWidth: () => 0,
          hLineColor: (i: number) => (i <= 1 ? '#bbbbbb' : '#e6e8ea'),
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
      { text: `${table.length} row${table.length === 1 ? '' : 's'}`, style: 'meta', margin: [0, 8, 0, 0] },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#8a9099',
      margin: [0, 12, 0, 0],
    }),
  };

  const pdf = printer.createPdfKitDocument(doc);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
}

const alignOf = (column: string) =>
  column === 'Amount' || column === 'Total' ? 'right' : 'left';

/**
 * pdfmake has shipped its bundled fonts under several shapes across versions —
 * `vfs`, `pdfMake.vfs`, or the module itself. Resolve defensively so a minor
 * upgrade cannot turn every PDF into a boot-time crash.
 */
function fontData(vfsModule: any, file: string): string {
  const table = vfsModule?.vfs ?? vfsModule?.pdfMake?.vfs ?? vfsModule?.default?.vfs ?? vfsModule;
  const data = table?.[file];
  if (typeof data !== 'string') {
    throw new Error(`pdfmake bundled font ${file} not found; cannot render PDF`);
  }
  return data;
}
