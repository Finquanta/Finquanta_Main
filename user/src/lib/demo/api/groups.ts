/**
 * Demo mirror of lib/api/groups.ts — Business Groups (cost & profit centres),
 * backed by the session ledger. Groups are reporting metadata only: assigning
 * one never changes the books, exactly as server-side.
 */
import { DemoGroup, DemoGroupType, DemoJournalEntry, DemoState, DEMO_GROUP_TYPES } from '../types';
import { load, save, recordInteraction, assertUnderCap, appendOp, newOpId } from '../store';
import { DemoError } from '../errors';

export const GROUP_TYPES = DEMO_GROUP_TYPES;
export type GroupType = DemoGroupType;
export type Group = DemoGroup;

/** A small palette offered when creating a group. Same as the real module's. */
export const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

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

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** What a ledger entry contributes to a group's in/out totals. */
function signedAmountOf(lines: { code: string; debit: number; credit: number }[]): number {
  const cash = lines.find((l) => l.code === 'CASH');
  if (cash) return round(cash.debit - cash.credit);
  const ar = lines.find((l) => l.code === 'AR');
  if (ar) return round(ar.debit - ar.credit);
  const ap = lines.find((l) => l.code === 'AP');
  if (ap) return round(ap.debit - ap.credit);
  return 0;
}

/**
 * The group an entry actually reports under.
 *
 * An entry can point at a group that's since been archived or deleted. Those
 * fall back to Unassigned — but every reader has to agree on that, or the
 * Unassigned row counts entries that expanding it won't list, and there's no way
 * left in the UI to reassign them (an archived group is no longer a row).
 */
function effectiveGroupId(state: DemoState, entry: DemoJournalEntry): string | null {
  if (!entry.groupId) return null;
  const active = state.groups.some((g) => g.id === entry.groupId && g.status === 'active');
  return active ? entry.groupId : null;
}

/** Which module a ledger entry belongs to, in the shape the Groups page wants. */
function kindOf(sourceType: string): GroupItem['kind'] {
  if (sourceType === 'invoice') return 'invoice';
  if (sourceType === 'loan' || sourceType === 'loanPayment') return 'loan';
  if (sourceType === 'manual') return 'accrual';
  return 'bookkeeping';
}

export async function getGroups(): Promise<Group[]> {
  return load().groups.filter((g) => g.status === 'active');
}

export async function createGroup(data: {
  name: string; description?: string; type?: GroupType; color?: string;
}): Promise<Group> {
  if (!data.name?.trim()) throw new DemoError('eGroupName', 'Give the group a name.');
  const state = load();
  assertUnderCap(state);

  const group: DemoGroup = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    description: data.description?.trim() || null,
    type: data.type ?? 'other',
    color: data.color ?? GROUP_COLORS[0],
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  state.groups.push(group);
  // Logged like every other creation, so a signup carries the visitor's groups
  // across instead of silently dropping them.
  appendOp(state, { opId: newOpId(), kind: 'create', entity: 'group', entityId: group.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return group;
}

export async function updateGroup(
  id: string,
  data: { name?: string; description?: string; type?: GroupType; color?: string; status?: 'active' | 'archived' }
): Promise<Group> {
  const state = load();
  const idx = state.groups.findIndex((g) => g.id === id);
  if (idx === -1) throw new DemoError('eGroupNF', 'Group not found');
  state.groups[idx] = {
    ...state.groups[idx],
    ...data,
    name: (data.name ?? state.groups[idx].name).trim(),
  };
  recordInteraction(state);
  save(state);
  return state.groups[idx];
}

export const archiveGroup = (id: string) => updateGroup(id, { status: 'archived' });

/** Delete a group; everything in it returns to Unassigned. */
export async function deleteGroup(id: string): Promise<{ id: string }> {
  const state = load();
  state.groups = state.groups.filter((g) => g.id !== id);
  for (const entry of state.ledger.entries) {
    if (entry.groupId === id) entry.groupId = null;
  }
  // Invoices carry their own groupId and stamp it onto everything they post, so
  // clearing only the entries would leave the invoice filing new ones into a
  // group that no longer exists.
  for (const invoice of state.invoices) {
    if (invoice.groupId === id) invoice.groupId = null;
  }
  recordInteraction(state);
  save(state);
  return { id };
}

/** Move an item into a group (groupId null removes it). */
export async function assignToGroup(
  _kind: GroupItem['kind'],
  id: string,
  groupId: string | null
): Promise<void> {
  const state = load();
  const entry = state.ledger.entries.find((e) => e.id === id);
  if (!entry) throw new DemoError('eEntryNF', 'Entry not found');
  entry.groupId = groupId;

  // An invoice is one document: its receivable and its payment belong to the
  // same group. Moving a single entry would leave the invoice's own groupId
  // behind, so anything it posts later lands back in the old group and the
  // report shows one invoice split across two buckets.
  if (entry.sourceType === 'invoice' && entry.sourceId) {
    const invoice = state.invoices.find((i) => i.id === entry.sourceId);
    if (invoice) {
      invoice.groupId = groupId;
      for (const sibling of state.ledger.entries) {
        if (sibling.sourceType === 'invoice' && sibling.sourceId === invoice.id) sibling.groupId = groupId;
      }
    }
  }

  recordInteraction(state);
  save(state);
}

/** What's inside a group. Pass 'unassigned' for the Unassigned bucket. */
export async function getGroupItems(groupId: string): Promise<GroupItem[]> {
  const state = load();
  const wanted = groupId === 'unassigned' ? null : groupId;
  return state.ledger.entries
    // Same rule the report buckets by, so what Unassigned counts is what
    // Unassigned lists — including entries stranded by an archived group.
    .filter((e) => effectiveGroupId(state, e) === wanted)
    .map((e) => ({
      kind: kindOf(e.sourceType),
      id: e.id,
      date: e.date,
      description: describe(state, e.id) ?? e.description,
      signedAmount: signedAmountOf(e.lines),
      groupId: effectiveGroupId(state, e),
    }))
    .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? 1 : -1));
}

/** Bookkeeping entries carry the name the user typed; the rest describe themselves. */
function describe(state: DemoState, entryId: string): string | null {
  const entry = state.ledger.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  if (entry.sourceType !== 'bookkeeping') return entry.description;
  return state.transactions.find((t) => t.id === entry.sourceId)?.category ?? entry.description;
}

/**
 * Money in and out per group. Unlike the server's version this covers the whole
 * session rather than a date range — a demo has no year of history to slice.
 */
export async function getGroupReport(): Promise<GroupReportRow[]> {
  const state = load();
  const rows = new Map<string | null, GroupReportRow>();

  const bucketFor = (groupId: string | null): GroupReportRow => {
    if (!rows.has(groupId)) {
      const group = groupId ? state.groups.find((g) => g.id === groupId) : null;
      rows.set(groupId, {
        groupId,
        name: group?.name ?? 'Unassigned',
        color: group?.color ?? null,
        inflow: 0,
        outflow: 0,
        net: 0,
        entries: 0,
      });
    }
    return rows.get(groupId)!;
  };

  // Every active group appears, even with nothing in it — an empty group the
  // user just made should be visible rather than silently missing.
  for (const g of state.groups.filter((g) => g.status === 'active')) bucketFor(g.id);

  for (const entry of state.ledger.entries) {
    // An entry assigned to an archived or deleted group falls back to Unassigned.
    const bucket = bucketFor(effectiveGroupId(state, entry));
    const amount = signedAmountOf(entry.lines);
    if (amount >= 0) bucket.inflow = round(bucket.inflow + amount);
    else bucket.outflow = round(bucket.outflow + Math.abs(amount));
    bucket.net = round(bucket.inflow - bucket.outflow);
    bucket.entries += 1;
  }

  return [...rows.values()];
}
