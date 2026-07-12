import { apiFetch } from './client';

export type ActivityType =
  | 'revenue_added'
  | 'expense_created'
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_cancelled'
  | 'invoice_deleted'
  | 'invoice_restored'
  | 'receivable_created'
  | 'receivable_settled'
  | 'payable_created'
  | 'payable_settled'
  | 'loan_received'
  | 'loan_issued'
  | 'loan_payment'
  | 'loan_repayment_received'
  | 'manual_entry';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  amount: number | null;
  entityType: string | null;
  entityId: string | null;
  occurredAt: string | null;
  createdAt: string | null;
}

/** Colour + plain-English label per event, so the timeline reads at a glance. */
export const ACTIVITY_META: Record<ActivityType, { label: string; color: string }> = {
  revenue_added:           { label: 'Revenue',      color: '#16a34a' },
  expense_created:         { label: 'Expense',      color: '#f97316' },
  invoice_created:         { label: 'Invoice',      color: '#6b7280' },
  invoice_sent:            { label: 'Invoice Sent', color: '#3b82f6' },
  invoice_paid:            { label: 'Invoice Paid', color: '#16a34a' },
  invoice_cancelled:       { label: 'Cancelled',    color: '#9ca3af' },
  invoice_deleted:         { label: 'Deleted',      color: '#dc2626' },
  invoice_restored:        { label: 'Restored',     color: '#8b5cf6' },
  receivable_created:      { label: 'Receivable',   color: '#0891b2' },
  receivable_settled:      { label: 'Paid To You',  color: '#16a34a' },
  payable_created:         { label: 'Payable',      color: '#d97706' },
  payable_settled:         { label: 'Bill Paid',    color: '#f97316' },
  loan_received:           { label: 'Loan In',      color: '#7c3aed' },
  loan_issued:             { label: 'Loan Out',     color: '#7c3aed' },
  loan_payment:            { label: 'Loan Payment', color: '#a855f7' },
  loan_repayment_received: { label: 'Loan Repaid',  color: '#a855f7' },
  manual_entry:            { label: 'Manual',       color: '#6b7280' },
};

export const listActivity = (limit = 100) => apiFetch<Activity[]>(`/v1/activity?limit=${limit}`);
