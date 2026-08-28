import { apiFetch } from './client';

/**
 * Recurring entries that have come round again.
 *
 * There is no "confirm" call here on purpose — saying yes creates an ordinary
 * transaction through createTransaction, the same path manual entry and
 * document review use. Once that entry exists the series moves forward on its
 * own, so there is nothing to keep in step.
 */

export type Recurrence = 'monthly' | 'yearly';

export interface DueItem {
  seriesKey: string;
  sourceTransactionId: string;
  type: 'income' | 'expense';
  /** The entry's name — "Invoice Name" in the review popup. */
  name: string;
  /** In USD, the currency the books are kept in. */
  amount: number;
  description: string | null;
  groupId: string | null;
  /** The currency it originally moved in, when that was not USD. */
  currency: string | null;
  recurrence: Recurrence;
  firstDate: string;
  /** When it last actually happened. */
  lastDate: string;
  /** The occurrence being asked about. */
  dueDate: string;
}

export const getRecurringDue = () => apiFetch<DueItem[]>('/v1/recurring/due');

/** "No, that did not happen" — recorded so the question does not come back. */
export const skipRecurring = (seriesKey: string, dueDate: string) =>
  apiFetch<{ skipped: boolean }>('/v1/recurring/skip', {
    method: 'POST',
    body: JSON.stringify({ seriesKey, dueDate }),
  });
