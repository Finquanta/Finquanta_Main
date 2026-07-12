import { apiFetch } from './client';

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id?: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  issueDate: string | null;
  dueDate: string | null;
  message: string | null;
  details: string | null;
  paymentTerms: string | null;
  notes: string | null;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  sentAt: string | null;
  paidAt: string | null;
  arEntryId: string | null;
  paymentEntryId: string | null;
  items: InvoiceItem[];
}

export interface InvoiceInput {
  customerId?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  message?: string | null;
  details?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  taxRate?: number;
  items?: InvoiceItem[];
}

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: '#6b7280',
  sent: '#3b82f6',
  viewed: '#8b5cf6',
  paid: '#16a34a',
  overdue: '#dc2626',
  cancelled: '#9ca3af',
};

export const listInvoices = () => apiFetch<Invoice[]>('/v1/invoices');
export const getInvoice = (id: string) => apiFetch<Invoice>(`/v1/invoices/${id}`);

export const createInvoice = (data: InvoiceInput) =>
  apiFetch<Invoice>('/v1/invoices', { method: 'POST', body: JSON.stringify(data) });

export const updateInvoice = (id: string, data: InvoiceInput) =>
  apiFetch<Invoice>(`/v1/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteInvoice = (id: string) =>
  apiFetch<{ id: string }>(`/v1/invoices/${id}`, { method: 'DELETE' });

/** Mark as Sent — books the receivable (Accounts Receivable ↑, Revenue ↑). */
export const markInvoiceSent = (id: string) =>
  apiFetch<Invoice>(`/v1/invoices/${id}/send`, { method: 'POST' });

/** Mark as Paid — books the payment (Cash ↑, Accounts Receivable ↓). */
export const markInvoicePaid = (id: string) =>
  apiFetch<Invoice>(`/v1/invoices/${id}/pay`, { method: 'POST' });

export const cancelInvoice = (id: string) =>
  apiFetch<Invoice>(`/v1/invoices/${id}/cancel`, { method: 'POST' });

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n) || 0);
