import { DemoOp, DemoState, DemoTriggerReason, DemoJournalEntry, DemoEntrySource, DemoJournalLine, DemoWorkflowType } from './types';

const STORAGE_KEY = 'finquanta_demo_v1';

/** A single demo session's total record count, across all entities. Past this,
 * creation throws a friendly error (abuse guard). */
const MAX_TOTAL_ENTRIES = 200;

/** How many Finna questions an anonymous visitor gets before the cap prompt. */
export const FINNA_MESSAGE_CAP = 5;

function emptyState(): DemoState {
  const now = Date.now();
  return {
    version: 2,
    meta: {
      demoId: crypto.randomUUID(),
      startedAt: now,
      lastInteractionAt: now,
      interactionCount: 0,
      dismissedTriggers: {},
      invoiceSeq: 1,
      invoicePreviewedAt: null,
    },
    business: { name: 'My Finances' },
    customers: [],
    transactions: [],
    invoices: [],
    groups: [],
    loans: [],
    loanPayments: [],
    ledger: { entries: [] },
    finna: { messagesUsed: 0, messages: [] },
    createdOrder: [],
  };
}

/**
 * Fill in anything a session predating a later feature is missing.
 *
 * A tab open across a deploy keeps its stored session, and every collection
 * here was added to the shape at some point — an older one would arrive without
 * it and blow up the first `.filter()` that touched it. Backfilling beats
 * bumping the version: the visitor keeps the work they've already done.
 */
function normalize(state: DemoState): DemoState {
  state.customers ??= [];
  state.transactions ??= [];
  state.invoices ??= [];
  state.groups ??= [];
  state.loans ??= [];
  state.loanPayments ??= [];
  state.createdOrder ??= [];
  state.ledger ??= { entries: [] };
  state.ledger.entries ??= [];
  state.finna ??= { messagesUsed: 0, messages: [] };
  state.finna.messages ??= [];
  state.business ??= { name: 'My Finances' };
  state.meta.dismissedTriggers ??= {};
  // A session predating the counter gets it from the highest number it already
  // handed out, so resuming one can't reissue a number that's already in use.
  state.meta.invoiceSeq ??= highestInvoiceNumber(state) + 1;
  state.meta.invoicePreviewedAt ??= null;
  return state;
}

/** The largest INV-nnnn number this session has issued, or 0 if none. */
function highestInvoiceNumber(state: DemoState): number {
  return state.invoices.reduce((max, inv) => {
    const n = Number.parseInt(String(inv.number ?? '').replace(/^INV-/, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

/** Claim the next invoice number. Monotonic — never reused after a delete. */
export function takeInvoiceNumber(state: DemoState): string {
  const n = state.meta.invoiceSeq;
  state.meta.invoiceSeq = n + 1;
  return `INV-${String(n).padStart(4, '0')}`;
}

export function load(): DemoState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as DemoState;
    // A v1 session predates the ledger-backed rewrite; its transactions have no
    // journal entries, so the books would read as empty. Start it over rather
    // than show half a picture — demo data is ephemeral by design.
    if (parsed.version !== 2) return emptyState();
    return normalize(parsed);
  } catch {
    return emptyState();
  }
}

export function save(state: DemoState): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function reset(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function isEmpty(state: DemoState): boolean {
  return state.customers.length === 0 && state.transactions.length === 0
    && state.invoices.length === 0 && state.loans.length === 0
    && state.ledger.entries.length === 0;
}

function totalEntries(state: DemoState): number {
  return state.customers.length + state.transactions.length + state.invoices.length
    + state.loans.length + state.groups.length + state.ledger.entries.length;
}

/** Throws if the session is already at the cap — callers use this before inserting. */
export function assertUnderCap(state: DemoState): void {
  if (totalEntries(state) >= MAX_TOTAL_ENTRIES) {
    throw new Error('This demo session is full — sign up for a free account to keep going.');
  }
}

export function appendOp(state: DemoState, op: DemoOp): void {
  state.createdOrder.push(op);
}

export function newOpId(): string {
  return crypto.randomUUID();
}

/** Post a balanced entry to the demo ledger and return it. */
export function postEntry(
  state: DemoState,
  input: {
    date: string;
    description: string;
    sourceType: DemoEntrySource;
    sourceId?: string | null;
    workflowType?: DemoWorkflowType | null;
    groupId?: string | null;
    lines: DemoJournalLine[];
  }
): DemoJournalEntry {
  const entry: DemoJournalEntry = {
    id: crypto.randomUUID(),
    date: input.date,
    description: input.description,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    workflowType: input.workflowType ?? null,
    groupId: input.groupId ?? null,
    lines: input.lines,
    createdAt: new Date().toISOString(),
  };
  state.ledger.entries.push(entry);
  return entry;
}

/** Drop every entry a source document posted — used when it's deleted. */
export function removeEntriesFor(state: DemoState, sourceId: string): void {
  state.ledger.entries = state.ledger.entries.filter((e) => e.sourceId !== sourceId);
}

/** Bumps the interaction counter and last-activity timestamp. Called on every
 * meaningful demo action (create/edit/navigate) — the signup triggers read this. */
export function recordInteraction(state: DemoState): DemoState {
  state.meta.interactionCount += 1;
  state.meta.lastInteractionAt = Date.now();
  return state;
}

/**
 * Record that the visitor has looked at a finished invoice. Only the first one
 * counts — the prompt this arms fires once, and re-arming it on every later view
 * would nag someone who already said "keep exploring".
 */
export function markInvoicePreviewed(): void {
  const state = load();
  if (state.meta.invoicePreviewedAt) return;
  state.meta.invoicePreviewedAt = Date.now();
  save(state);
}

export function dismissTrigger(state: DemoState, reason: DemoTriggerReason): DemoState {
  state.meta.dismissedTriggers[reason] = Date.now();
  return state;
}
