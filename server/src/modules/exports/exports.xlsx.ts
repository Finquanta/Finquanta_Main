/**
 * The Excel workbook — the best home for a ledger, because it is the one
 * format where the reader can sort, filter and total the rows themselves.
 */
import ExcelJS from 'exceljs';
import { ExportHeader } from './exports.types';
import { headerLines } from './exports.service';

/** Which columns hold money, by header name, so they get a numeric format. */
const MONEY_COLUMNS = new Set(['Amount', 'Total']);

export async function toXlsx(
  header: ExportHeader,
  columns: readonly string[],
  table: Array<Array<unknown>>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Finquanta';
  wb.created = new Date();

  const ws = wb.addWorksheet('Export', {
    views: [{ state: 'frozen', ySplit: 0 }],
  });

  // The header block, above the table.
  for (const line of headerLines(header)) {
    const row = ws.addRow([line]);
    row.font = { bold: line === header.businessName, size: line === header.businessName ? 14 : 11 };
  }
  ws.addRow([]);

  const headerRowIndex = ws.rowCount + 1;
  const headerRow = ws.addRow([...columns]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  });

  const moneyAt = columns.map((c) => MONEY_COLUMNS.has(c));

  for (const row of table) {
    // Amounts are written as NUMBERS, not strings. A money column of text
    // cannot be sorted or summed, which removes the reason to pick Excel.
    const values = row.map((cell, i) => {
      if (!moneyAt[i]) return cell ?? '';
      const n = Number.parseFloat(String(cell));
      return Number.isFinite(n) ? n : (cell ?? '');
    });
    const added = ws.addRow(values);
    added.eachCell((cell, col) => {
      if (moneyAt[col - 1]) {
        // Negatives in red and in parentheses, which is how an accountant reads
        // a credit. Two decimal places always, so cents never disappear.
        cell.numFmt = '#,##0.00;[Red](#,##0.00)';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  // Sort and filter handles on the column row, so the sheet is usable on open.
  if (table.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex + table.length, column: columns.length },
    };
  }
  // Freeze everything above and including the column row.
  ws.views = [{ state: 'frozen', ySplit: headerRowIndex }];

  // Width from the widest cell in each column, clamped so one long note does
  // not produce a column nobody can see past.
  ws.columns.forEach((column, i) => {
    const widest = Math.max(
      (columns[i] ?? '').length,
      ...table.map((r) => String(r[i] ?? '').length)
    );
    column.width = Math.min(Math.max(widest + 2, 10), 50);
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
