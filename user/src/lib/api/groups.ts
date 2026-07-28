import { apiFetch } from './client';

export const GROUP_TYPES = ['department', 'project', 'campaign', 'location', 'product', 'other'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export interface Group {
  id: string;
  name: string;
  description: string | null;
  type: GroupType;
  color: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface GroupReportRow {
  /** null = the Unassigned bucket. */
  groupId: string | null;
  name: string;
  color: string | null;
  inflow: number;
  outflow: number;
  net: number;
  entries: number;
}

export interface GroupItem {
  kind: 'bookkeeping' | 'invoice' | 'accrual' | 'loan';
  id: string;
  date: string | null;
  description: string;
  signedAmount: number;
  groupId: string | null;
}

export const getGroups = () => apiFetch<Group[]>('/v1/groups');

/** What's inside a group. Pass 'unassigned' for the Unassigned bucket. */
export const getGroupItems = (groupId: string) => apiFetch<GroupItem[]>(`/v1/groups/${groupId}/items`);

/** Move an item into a group (groupId null removes it). */
export const assignToGroup = (kind: GroupItem['kind'], id: string, groupId: string | null) =>
  apiFetch<void>('/v1/groups/assign', { method: 'POST', body: JSON.stringify({ kind, id, groupId }) });

export const getGroupReport = (start?: string, end?: string) => {
  const qs = new URLSearchParams();
  if (start) qs.set('start', start);
  if (end) qs.set('end', end);
  const q = qs.toString();
  return apiFetch<GroupReportRow[]>(`/v1/groups/report${q ? `?${q}` : ''}`);
};

export const createGroup = (data: { name: string; description?: string; type?: GroupType; color?: string }) =>
  apiFetch<Group>('/v1/groups', { method: 'POST', body: JSON.stringify(data) });

export const updateGroup = (
  id: string,
  data: { name?: string; description?: string; type?: GroupType; color?: string; status?: 'active' | 'archived' }
) => apiFetch<Group>(`/v1/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const archiveGroup = (id: string) => updateGroup(id, { status: 'archived' });

/** Delete a group; its entries/invoices return to Unassigned. */
export const deleteGroup = (id: string) => apiFetch<{ id: string }>(`/v1/groups/${id}`, { method: 'DELETE' });

/** A small palette offered when creating a group. */
export const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
