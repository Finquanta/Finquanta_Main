/**
 * Demo mirror of lib/api/invoices.ts. No recycle bin in the demo (session data
 * is already ephemeral, so a soft-delete safety net doesn't carry its weight
 * here) — delete is a straight removal. Send/Pay post to the demo ledger using
 * the same two workflows the real invoice routes use (see ../ledger.ts).
 */
import { DemoInvoice, DemoInvoiceItem, DemoInvoiceStatus, DemoState, DemoJournalLine } from '../types';
import { load, save, recordInteraction, assertUnderCap, appendOp, newOpId, postEntry, removeEntriesFor, takeInvoiceNumber } from '../store';
import { creditRevenue, receiveArPayment } from '../ledger';
import { todayLocal } from '../dates';
import { DemoError } from '../errors';

export type InvoiceStatus = DemoInvoiceStatus;

export interface InvoiceItem extends DemoInvoiceItem {}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerId: string | null;
  customerName: string | null;
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
  /** Business Group this invoice belongs to. */
  groupId?: string | null;
}

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: '#6b7280',
  sent: '#3b82f6',
  paid: '#16a34a',
  cancelled: '#9ca3af',
};

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function totals(items: InvoiceItem[], taxRate: number) {
  const subtotal = round(items.reduce((s, it) => s + round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0));
  const tax = round(subtotal * ((Number(taxRate) || 0) / 100));
  const total = round(subtotal + tax);
  return { subtotal, tax, total };
}

function toInvoice(inv: DemoInvoice, customerName: string | null): Invoice {
  return { ...inv, customerName, currency: inv.currency || 'USD' };
}

function customerNameFor(state: ReturnType<typeof load>, customerId: string | null): string | null {
  if (!customerId) return null;
  return state.customers.find((c) => c.id === customerId)?.name ?? null;
}

export async function listInvoices(): Promise<Invoice[]> {
  const state = load();
  return state.invoices.map((inv) => toInvoice(inv, customerNameFor(state, inv.customerId)));
}

export async function getInvoice(id: string): Promise<Invoice> {
  const state = load();
  const inv = state.invoices.find((i) => i.id === id);
  if (!inv) throw new DemoError('eInvNF', 'Invoice not found');
  return toInvoice(inv, customerNameFor(state, inv.customerId));
}

export async function createInvoice(data: InvoiceInput): Promise<Invoice> {
  const state = load();
  assertUnderCap(state);

  const items = (data.items ?? []).map((it) => ({
    ...it,
    id: it.id ?? crypto.randomUUID(),
    amount: round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
  }));
  const { subtotal, tax, total } = totals(items, data.taxRate ?? 0);

  const record: DemoInvoice = {
    id: crypto.randomUUID(),
    number: takeInvoiceNumber(state),
    status: 'draft',
    customerId: data.customerId ?? null,
    issueDate: data.issueDate ?? todayLocal(),
    dueDate: data.dueDate ?? null,
    message: data.message ?? null,
    details: data.details ?? null,
    paymentTerms: data.paymentTerms ?? null,
    notes: data.notes ?? null,
    taxRate: data.taxRate ?? 0,
    subtotal, tax, total,
    currency: 'USD',
    sentAt: null,
    paidAt: null,
    items,
    groupId: data.groupId ?? null,
    createdAt: new Date().toISOString(),
  };
  state.invoices.push(record);
  appendOp(state, { opId: newOpId(), kind: 'create', entity: 'invoice', entityId: record.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return toInvoice(record, customerNameFor(state, record.customerId));
}

export async function updateInvoice(id: string, data: InvoiceInput): Promise<Invoice> {
  const state = load();
  const idx = state.invoices.findIndex((i) => i.id === id);
  if (idx === -1) throw new DemoError('eInvNF', 'Invoice not found');
  const current = state.invoices[idx];

  const items = data.items
    ? data.items.map((it) => ({ ...it, id: it.id ?? crypto.randomUUID(), amount: round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)) }))
    : current.items;
  const taxRate = data.taxRate ?? current.taxRate;
  const { subtotal, tax, total } = totals(items, taxRate);

  state.invoices[idx] = { ...current, ...data, items, taxRate, subtotal, tax, total };
  recordInteraction(state);
  save(state);
  return toInvoice(state.invoices[idx], customerNameFor(state, state.invoices[idx].customerId));
}

export async function deleteInvoice(id: string): Promise<void> {
  const state = load();
  state.invoices = state.invoices.filter((i) => i.id !== id);
  // Deleting the invoice takes its ledger entries with it — matching the real
  // app, where an invoice owns everything it posted.
  removeEntriesFor(state, id);
  state.createdOrder = state.createdOrder.filter(
    (op) => !(op.kind !== 'accrual' && op.kind !== 'loanPayment' && op.entityId === id)
  );
  recordInteraction(state);
  save(state);
}

function post(state: DemoState, invoiceId: string, description: string, lines: DemoJournalLine[]) {
  postEntry(state, {
    date: todayLocal(),
    description,
    sourceType: 'invoice',
    sourceId: invoiceId,
    workflowType: null,
    // Every entry an invoice posts shares the invoice's group.
    groupId: state.invoices.find((i) => i.id === invoiceId)?.groupId ?? null,
    lines,
  });
}

/**
 * Not reachable from the demo UI: the demo gates at the invoice preview, so
 * Mark As Sent and Mark As Paid go to signup rather than to the ledger, and
 * every demo invoice stays a draft. Kept as the faithful mirror of the real
 * routes — if the gate ever moves, this is what it moves back to.
 */

/** Mark as Sent — books the receivable (AR up, Revenue up), same as the real /send route. */
export async function markInvoiceSent(id: string): Promise<Invoice> {
  const state = load();
  const idx = state.invoices.findIndex((i) => i.id === id);
  if (idx === -1) throw new DemoError('eInvNF', 'Invoice not found');
  const inv = state.invoices[idx];
  if (inv.status !== 'draft') throw new DemoError('eInvDraftOnly', 'Only a draft invoice can be marked sent.');

  post(state, id, `Invoice ${inv.number} sent`, creditRevenue(inv.total));
  state.invoices[idx] = { ...inv, status: 'sent', sentAt: new Date().toISOString() };
  appendOp(state, { opId: newOpId(), kind: 'statusChange', entity: 'invoice', entityId: id, toStatus: 'sent', at: Date.now() });
  recordInteraction(state);
  save(state);
  return toInvoice(state.invoices[idx], customerNameFor(state, inv.customerId));
}

/** Mark as Paid — books the payment (Cash up, AR down), same as the real /pay route. */
export async function markInvoicePaid(id: string): Promise<Invoice> {
  const state = load();
  const idx = state.invoices.findIndex((i) => i.id === id);
  if (idx === -1) throw new DemoError('eInvNF', 'Invoice not found');
  const inv = state.invoices[idx];
  if (inv.status === 'paid' || inv.status === 'cancelled') throw new DemoError('eInvNotPayable', 'This invoice cannot be marked paid.');

  // If it skipped straight from draft to paid, book the receivable first —
  // mirrors the real /pay route's "book if not already sent" behavior.
  if (inv.status === 'draft') post(state, id, `Invoice ${inv.number} sent`, creditRevenue(inv.total));
  post(state, id, `Invoice ${inv.number} paid`, receiveArPayment(inv.total));

  state.invoices[idx] = { ...inv, status: 'paid', sentAt: inv.sentAt ?? new Date().toISOString(), paidAt: new Date().toISOString() };
  appendOp(state, { opId: newOpId(), kind: 'statusChange', entity: 'invoice', entityId: id, toStatus: 'paid', at: Date.now() });
  recordInteraction(state);
  save(state);
  return toInvoice(state.invoices[idx], customerNameFor(state, inv.customerId));
}

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n) || 0);
