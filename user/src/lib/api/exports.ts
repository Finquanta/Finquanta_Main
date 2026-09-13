import { apiFetch, PaymentRequiredError, serverApiUrl } from './client';

/**
 * Books Export.
 *
 * The preview is an ordinary JSON call. The download is NOT: `apiFetch` always
 * calls `res.json()` and would choke on a zip or a PDF, so downloads use the
 * blob pattern from `transactions.ts` — manual auth headers, raw fetch, then
 * `res.blob()`.
 */

export type ExportFormat = 'csv' | 'txt' | 'xlsx' | 'pdf';

export type InvoiceType =
  | 'income' | 'expense' | 'accounts_receivable' | 'accounts_payable'
  | 'loan_received' | 'loan_issued' | 'loan_payment' | 'loan_repaid';

/** Only these two need an accrual basis; nothing unpaid has moved cash. */
export const ACCRUAL_ONLY_TYPES: InvoiceType[] = ['accounts_receivable', 'accounts_payable'];

export const INVOICE_TYPE_ORDER: InvoiceType[] = [
  'income', 'expense', 'accounts_receivable', 'accounts_payable',
  'loan_received', 'loan_issued', 'loan_payment', 'loan_repaid',
];

export const UNASSIGNED_GROUP = 'unassigned';

export type ExportContent = 'ledger' | 'invoices';

export interface ExportOptions {
  content: ExportContent;
  format: ExportFormat;
  basis: 'cash' | 'accrual';
  startDate?: string;
  endDate?: string;
  groupIds: string[];
  invoiceTypes: InvoiceType[];
}

export interface ExportHeader {
  businessName: string;
  businessPhone: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  exportedBy: string;
  exportedAt: string;
  rangeLabel: string;
  basisLabel: string;
  logoDataUri: string | null;
}

export interface ExportUsage {
  allowed: boolean;
  used: number;
  /** null means unlimited. */
  limit: number | null;
  remaining: number | null;
  period: string;
}

export interface ExportPreview {
  header: ExportHeader;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  estimatedPages?: number;
  pdfRowLimit?: number;
  truncated: boolean;
  usage: ExportUsage;
}

/** Repeated keys, so the server reads groups and types as arrays. */
function queryString(options: ExportOptions): string {
  const p = new URLSearchParams();
  p.set('basis', options.basis);
  if (options.startDate) p.set('startDate', options.startDate);
  if (options.endDate) p.set('endDate', options.endDate);
  for (const g of options.groupIds) p.append('groupId', g);
  for (const t of options.invoiceTypes) p.append('type', t);
  return p.toString();
}

export async function getExportUsage(): Promise<ExportUsage> {
  return apiFetch<ExportUsage>('/v1/exports/usage');
}

export async function previewExport(options: ExportOptions): Promise<ExportPreview> {
  const path = options.content === 'invoices' ? 'invoices' : 'ledger';
  return apiFetch<ExportPreview>(`/v1/exports/${path}/preview?${queryString(options)}`);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    const businessId = localStorage.getItem('activeBusinessId');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (businessId) headers['X-Business-Id'] = businessId;
  }
  return headers;
}

/** `attachment; filename="x.zip"` -> `x.zip`. */
function filenameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

/**
 * Fetch the export and return the bytes plus the server's chosen filename.
 *
 * Reading the filename depends on `Content-Disposition` being in the API's CORS
 * `exposedHeaders` — without that the browser hides it from JavaScript and
 * every file would save under the fallback name.
 */
export async function fetchExportBlob(
  options: ExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const path = options.content === 'invoices' ? 'invoices' : 'ledger';
  const url = serverApiUrl(
    `/v1/exports/${path}?format=${options.format}&${queryString(options)}`
  );

  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    let message = `Could not build that export (${res.status})`;
    let data: Record<string, unknown> | undefined;
    try {
      const body = await res.json();
      message = body?.error || body?.message || message;
      data = body?.data;
    } catch {
      /* not a JSON error body */
    }
    // 402 carries the allowance, and the app already knows this error type.
    if (res.status === 402) throw new PaymentRequiredError(message, data);
    throw new Error(message);
  }

  return {
    blob: await res.blob(),
    filename: filenameFrom(
      res.headers.get('Content-Disposition'),
      `${path}.${options.format === 'csv' ? 'zip' : options.format}`
    ),
  };
}

/**
 * Hand the blob to the browser as a save.
 *
 * The object URL is revoked on a timeout rather than immediately: Safari
 * cancels an in-flight download if the URL is released in the same tick as the
 * synthetic click.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadExport(options: ExportOptions): Promise<string> {
  const { blob, filename } = await fetchExportBlob(options);
  saveBlob(blob, filename);
  return filename;
}
