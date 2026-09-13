import {
  coverText, csvField, headerLines, money2, safeFilename, toCsv, toTxt,
} from '../../../src/modules/exports/exports.service';
import { invoiceTypeOf, displayDate, rangeLabel } from '../../../src/modules/exports/exports.repository';
import { ExportHeader, LEDGER_COLUMNS } from '../../../src/modules/exports/exports.types';

/**
 * The bytes Books Export actually writes.
 *
 * Everything here is a pure function, so this needs no database and no server.
 * It exists because escaping is the part that fails silently: a CSV that
 * mangles an accented business name, or drops a row because a note contained a
 * comma, looks completely fine until a customer opens it in Excel — usually
 * after they have already emailed it to their accountant.
 */

const header: ExportHeader = {
  businessName: 'Acme Trading Ltd',
  businessPhone: '+1 555 0134',
  registrationNumber: '12345678',
  taxNumber: null,
  exportedBy: 'Gio Dario',
  exportedAt: '12 Sep 2026',
  rangeLabel: '1 Jan 2026 – 31 Mar 2026',
  basisLabel: 'Cash Basis',
  logoDataUri: null,
};

const rows: Array<Array<unknown>> = [
  ['Invoice #3, final', money2(1200), 'Paid "in full"', 'Income', 'Marketing', '12 Mar 2026'],
  ['Café renté', money2(-900.5), 'Rent\nfor March', 'Expense', '', '01 Mar 2026'],
];

describe('CSV', () => {
  const text = toCsv(LEDGER_COLUMNS, rows).toString('utf8');

  it('starts with a UTF-8 BOM, or Excel mangles accented text', () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Café renté');
  });

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    expect(text).toContain('"Invoice #3, final"');
    expect(text).toContain('"Paid ""in full"""');
    expect(text).toContain('"Rent\nfor March"');
  });

  it('begins at the column row so the file still imports', () => {
    expect(text.replace('﻿', '').startsWith('Name,Amount,Description,Invoice Type,Group,Date')).toBe(true);
  });

  /**
   * A transaction someone named `=cmd|calc` is a formula to Excel and Sheets,
   * and these files get emailed onward. Prefixing a tab keeps it readable and
   * inert.
   */
  it.each(['=cmd', '+cmd', '-cmd', '@cmd'])('defuses a leading %s', (value) => {
    expect(csvField(value).startsWith('\t')).toBe(true);
  });
});

describe('the header block', () => {
  it('omits lines that have no value rather than printing an empty label', () => {
    const lines = headerLines(header).join('\n');
    expect(lines).toContain('Reg. No. 12345678');
    expect(lines).not.toContain('Tax No.');
  });

  it('is repeated verbatim in the zip cover, so formats cannot disagree', () => {
    const cover = coverText(header, 2).toString('utf8');
    for (const line of headerLines(header)) {
      if (line) expect(cover).toContain(line);
    }
    expect(cover).toContain('2 rows');
  });

  it('reads the same in the plain-text listing', () => {
    const txt = toTxt(header, LEDGER_COLUMNS, rows).toString('utf8');
    expect(txt).toContain('Acme Trading Ltd');
    expect(txt).toContain('+1 555 0134');
    expect(txt).toContain('2 rows');
  });
});

describe('Invoice Type', () => {
  /**
   * Loans take their own label because a loan is neither income nor expense:
   * receiving principal is not revenue and repaying it is not a cost. A reader
   * who saw "Income" against a loan would misread the business.
   */
  it.each([
    ['loan_received', 'loan_received'],
    ['loan_issued', 'loan_issued'],
    ['loan_payment', 'loan_payment'],
    ['loan_repayment_received', 'loan_repaid'],
  ])('labels %s from its own source type', (sourceType, expected) => {
    expect(invoiceTypeOf({ sourceType, direction: 'in' })).toBe(expected);
  });

  it.each([
    ['in', 'income'],
    ['out', 'expense'],
    ['owed_to_you', 'accounts_receivable'],
    ['you_owe', 'accounts_payable'],
  ])('falls back to direction %s for everything else', (direction, expected) => {
    expect(invoiceTypeOf({ sourceType: 'bookkeeping', direction })).toBe(expected);
  });

  it('never calls an unpaid invoice Income, which would overstate money received', () => {
    expect(invoiceTypeOf({ sourceType: 'invoice', direction: 'owed_to_you' }))
      .toBe('accounts_receivable');
  });
});

describe('dates', () => {
  it('formats without a locale, so the file reads the same everywhere', () => {
    expect(displayDate('2026-03-31')).toBe('31 Mar 2026');
    expect(displayDate('2026-01-01')).toBe('1 Jan 2026');
    expect(displayDate(null)).toBe('');
  });

  it('describes open-ended ranges honestly', () => {
    expect(rangeLabel('2026-01-01', '2026-03-31')).toBe('1 Jan 2026 – 31 Mar 2026');
    expect(rangeLabel('2026-01-01', undefined)).toBe('From 1 Jan 2026');
    expect(rangeLabel(undefined, '2026-03-31')).toBe('Up to 31 Mar 2026');
    expect(rangeLabel()).toBe('All time');
  });
});

describe('filenames', () => {
  it('slugs the business name', () => {
    expect(safeFilename('Acme Trading Ltd', 'ledger', 'zip'))
      .toMatch(/^acme-trading-ltd-ledger-\d{4}-\d{2}-\d{2}\.zip$/);
  });

  /** The business name is user input and lands in a Content-Disposition header. */
  it('strips characters that would break the header or the filesystem', () => {
    expect(safeFilename('Bad"/\\\nName', 'ledger', 'pdf')).not.toMatch(/["/\\\n]/);
  });

  it('falls back rather than producing a nameless file', () => {
    expect(safeFilename('中文', 'ledger', 'csv')).toMatch(/^business-ledger-/);
  });
});

describe('money', () => {
  it('always writes two decimal places, so cents never disappear', () => {
    expect(money2(1200)).toBe('1200.00');
    expect(money2(-900.5)).toBe('-900.50');
    expect(money2(0.005)).toBe('0.01');
  });
});
