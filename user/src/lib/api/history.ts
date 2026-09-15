import { apiFetch } from './client';

/**
 * Books history: every change to the active workspace's books, with undo and
 * go back to a moment. See server/src/modules/history.
 */

export type HistoryOp = 'I' | 'U' | 'D';

export interface HistoryChange {
  id: string;
  table: string;
  rowId: string;
  op: HistoryOp;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface HistoryGroup {
  txid: string;
  at: string;
  actor: { id: string; name: string; email: string } | null;
  undoOf: string | null;
  undoneBy: string | null;
  changes: HistoryChange[];
}

export type GoBackPoint = { txid: string } | { date: string };

export async function getHistory(
  cursor?: string | null
): Promise<{ groups: HistoryGroup[]; nextCursor: string | null; canUndo: boolean }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch(`/v1/history${query}`);
}

/** The changes going back to `point` would undo, newest first. */
export async function previewGoBack(point: GoBackPoint): Promise<HistoryGroup[]> {
  const query = 'txid' in point ? `txid=${encodeURIComponent(point.txid)}` : `date=${encodeURIComponent(point.date)}`;
  const data = await apiFetch<{ groups: HistoryGroup[] }>(`/v1/history/preview?${query}`);
  return data.groups;
}

/** Owners and Admins. Refused when part of the change was edited again since. */
export async function undoChange(txid: string): Promise<void> {
  await apiFetch(`/v1/history/${txid}/undo`, { method: 'POST' });
}

/** Owners and Admins. All or nothing. */
export async function goBackTo(point: GoBackPoint): Promise<{ undone: number }> {
  return apiFetch<{ undone: number }>('/v1/history/undo-after', {
    method: 'POST',
    body: JSON.stringify(point),
  });
}
