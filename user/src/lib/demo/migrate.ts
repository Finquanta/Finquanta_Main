/**
 * Carrying a demo session into a real account.
 *
 * The demo lives in sessionStorage, which dies with the tab. Signup navigates
 * away and back through email verification, so the handoff copies the session
 * into localStorage first (`stash`), and the dashboard replays it once the user
 * actually has an account (`migratePendingDemo`).
 *
 * Two things localStorage forces us to be careful about, because it outlives
 * both the tab and the visitor:
 *
 *  - **Whose is it?** A stash is written when someone lands on /signup, which is
 *    not the same as someone completing a signup. It is `forUserId: null` until
 *    registration actually succeeds and `bindStashToUser` names the account it
 *    belongs to. An unbound, mismatched, or expired stash is discarded, never
 *    replayed — otherwise an abandoned demo would post itself into the books of
 *    whoever next signs in on this browser.
 *  - **Did it finish?** Replay is one network round trip per op and the user can
 *    reload in the middle of it. Progress is written back after every op, so a
 *    resumed run skips what already landed instead of duplicating it.
 *
 * Replay walks `createdOrder` in order, because later ops reference earlier ones
 * — an invoice points at a customer, a loan payment at its loan. Demo ids are
 * mapped to the real ids the API hands back as we go.
 */
import { DemoState } from './types';
import { load, reset } from './store';
import { createCustomer } from '@/lib/api/customers';
import { createTransaction } from '@/lib/api/transactions';
import { createInvoice, markInvoicePaid, markInvoiceSent } from '@/lib/api/invoices';
import { runWorkflow } from '@/lib/api/accounting';
import { createLoan, recordLoanPayment } from '@/lib/api/loans';
import { createGroup } from '@/lib/api/groups';
import { DEFAULT_BUSINESS_NAME, PLACEHOLDER_BUSINESS_NAMES } from '@/lib/businessDefaults';
import { createBusiness, listBusinesses, renameBusiness } from '@/lib/api/businesses';

const PENDING_KEY = 'finquanta_demo_pending';

/** Where apiFetch reads the workspace it scopes every request to. */
const ACTIVE_BUSINESS_KEY = 'activeBusinessId';

/**
 * The name registration gives a new account's workspace. Mirrors
 * DEFAULT_BUSINESS_NAME in server/src/modules/auth/auth.service.ts — a workspace
 * still called this has never been named by its owner.
 */
/**
 * If the placeholder list only held the CURRENT default, a returning user whose
 * workspace still says 'My Business' would not be recognised as unnamed, and
 * the migration would create a SECOND workspace beside it.
 */
const PLACEHOLDER_BUSINESS_NAME = DEFAULT_BUSINESS_NAME;

/**
 * How long a stash stays replayable. Long enough to cover signup plus email
 * verification at a human pace; short enough that a stash forgotten on a shared
 * browser goes stale rather than waiting indefinitely for someone to sign in.
 */
const STASH_TTL_MS = 24 * 60 * 60 * 1000;

/** Progress through a replay, so an interrupted one can pick up where it stopped. */
interface StashProgress {
  /** Ops already applied. Replay skips these. */
  completedOpIds: string[];
  /** demo id → real id, per entity, so later ops still resolve after a resume. */
  customerIds: [string, string][];
  invoiceIds: [string, string][];
  loanIds: [string, string][];
  groupIds: [string, string][];
}

interface PendingStash {
  v: 1;
  state: DemoState;
  /** The account this belongs to. Null until a signup actually succeeds. */
  forUserId: string | null;
  stashedAt: number;
  progress: StashProgress;
  /**
   * When a replay last claimed this stash. The in-memory `migrating` flag only
   * covers one JS context, but the stash lives in localStorage and is shared by
   * every tab on this origin — two dashboards open at once would otherwise both
   * replay it and create everything twice. Stored rather than held in memory so
   * the claim survives the reload it is meant to protect against.
   */
  lockedAt?: number;
}

/**
 * How long a replay may hold the stash before another context assumes it died.
 * Longer than any realistic run (one round trip per op, a couple of hundred ops
 * at worst) so a slow connection is never mistaken for a crash, short enough
 * that a genuinely dead run is retried while the user is still on the page.
 */
const LOCK_TTL_MS = 2 * 60 * 1000;

const emptyProgress = (): StashProgress => ({
  completedOpIds: [], customerIds: [], invoiceIds: [], loanIds: [], groupIds: [],
});

function writeStash(stash: PendingStash): void {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(stash));
}

/** The stash as stored, whoever it belongs to. Null if absent or unreadable. */
function rawStash(): PendingStash | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingStash;
    if (parsed?.v !== 1 || parsed.state?.version !== 2) return null;
    parsed.progress ??= emptyProgress();
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Copy the live demo session somewhere that survives the signup round-trip.
 * Provisional: it isn't tied to an account until `bindStashToUser` says so.
 * Called from every route into signup, so no path loses the session.
 */
export function stashForSignup(): void {
  if (typeof window === 'undefined') return;
  const state = load();
  if (state.createdOrder.length === 0) return;

  // Re-stashing mid-replay would wipe the progress of a run already underway,
  // so a stash whose lease is still live is left alone.
  //
  // Being bound is NOT enough on its own. A migration that ends with failures
  // and whose tab is closed rather than dismissed leaves the stash bound to that
  // user for the full 24h TTL. Returning early on `forUserId` alone meant the
  // next visitor on the same browser got nothing stashed at all: their demo
  // reached the dashboard, `claimStashFor` saw an owner that wasn't them,
  // cleared it, and their work vanished with no message. An abandoned binding
  // belongs to nobody here — this session's work wins.
  const existing = rawStash();
  if (existing?.forUserId && existing.lockedAt && Date.now() - existing.lockedAt < LOCK_TTL_MS) {
    return;
  }

  writeStash({ v: 1, state, forUserId: null, stashedAt: Date.now(), progress: emptyProgress() });
}

/**
 * Name the account a stash belongs to. Called once, the moment registration
 * succeeds — this is what makes the stash eligible for replay at all.
 */
export function bindStashToUser(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  const stash = rawStash();
  if (!stash || stash.forUserId) return;
  // Re-read the session: the visitor may have kept working after the provisional
  // stash was written on page load.
  const live = load();
  if (live.createdOrder.length >= stash.state.createdOrder.length) stash.state = live;
  stash.forUserId = userId;
  stash.stashedAt = Date.now();
  writeStash(stash);
}

/** Cheap pre-check: is there anything at all worth resolving `getMe` for? */
export function hasPendingDemo(): boolean {
  const stash = rawStash();
  return !!stash && stash.forUserId !== null && Date.now() - stash.stashedAt <= STASH_TTL_MS;
}

export function clearPendingDemo(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_KEY);
}

/**
 * The stash, only if it belongs to `userId` and hasn't expired. Anything else is
 * cleared and null is returned: a stash that isn't this user's must never be
 * replayed, and one nobody claimed within the TTL is never going to be.
 */
function claimStashFor(userId: string): PendingStash | null {
  const stash = rawStash();
  if (!stash) return null;
  if (stash.forUserId !== userId || Date.now() - stash.stashedAt > STASH_TTL_MS) {
    clearPendingDemo();
    return null;
  }

  // Another tab (or this one, before a reload) may already be replaying it.
  // Everything created so far would be created again, so stand down until the
  // lease expires — at which point the holder is presumed dead and whatever it
  // did complete is recorded in `progress`, so the retry resumes rather than
  // starts over.
  if (stash.lockedAt && Date.now() - stash.lockedAt < LOCK_TTL_MS) return null;

  stash.lockedAt = Date.now();
  try { writeStash(stash); } catch { /* unwritable storage — in-memory guard still applies */ }
  return stash;
}

/** What was carried over, for the confirmation the user sees. */
export interface MigrationResult {
  customers: number;
  transactions: number;
  invoices: number;
  loans: number;
  groups: number;
  entries: number;
  /** Ops that failed. The rest still went through — this is not all-or-nothing. */
  failed: number;
  /**
   * True when every op failed and nothing landed. The stash is kept in that case
   * so the user can retry rather than silently losing everything they built.
   */
  allFailed: boolean;
  /**
   * Why the first failure happened. Worth carrying: without it a total failure
   * is indistinguishable from any other, and "check your connection" is a
   * misleading thing to tell someone whose real problem was a 409.
   */
  firstError?: string;
}

const succeededCount = (r: MigrationResult) =>
  r.customers + r.transactions + r.invoices + r.loans + r.groups + r.entries;

/**
 * One replay at a time. The banner's effect fires twice under StrictMode and
 * again on any layout remount; without this the same ops run concurrently and
 * the dedupe below can't help, because neither run has recorded anything yet.
 */
let migrating = false;

/**
 * Hand the stash back so another context (or a retry in this one) may claim it.
 * Only for paths that end without the data landing — a successful replay deletes
 * the stash outright, lock and all.
 */
function releaseLock(): void {
  const stash = rawStash();
  if (!stash) return;
  delete stash.lockedAt;
  try { writeStash(stash); } catch { /* nothing to do; the lease will expire */ }
}

/**
 * Make sure the account has a workspace, and point apiFetch at it.
 *
 * Every write below goes through `withBusiness`, which 409s with "No business
 * found for this user" when the account owns none — and a brand-new account
 * genuinely owns none. Nothing in registration or onboarding creates one; the
 * only paths are the WorkspaceSwitcher's Create button and the backfill inside
 * BusinessesRepository.ensureSchema(), which runs at server BOOT. Render's free
 * tier sleeps and restarts constantly, so that backfill hides the gap in
 * production; against a long-running server it never re-runs and every single
 * op fails, which is exactly what a total-failure banner was reporting.
 *
 * Naming it after the demo business keeps what the visitor typed. We also pin
 * `activeBusinessId` here rather than leaving it to WorkspaceSwitcher, which
 * sets it from an async listBusinesses() in a sibling effect — a race this
 * replay would otherwise be running inside.
 */
async function ensureActiveBusiness(demoName: string): Promise<string | null> {
  const wanted = demoName.trim();
  try {
    const existing = await listBusinesses();
    let business = existing[0];

    if (!business) {
      business = await createBusiness(wanted || PLACEHOLDER_BUSINESS_NAME);
    } else if (wanted && wanted !== business.name && PLACEHOLDER_BUSINESS_NAMES.includes(business.name)) {
      // Registration hands every account a placeholder workspace, so there's
      // almost always one waiting here. Reuse it — creating a second would leave
      // the user with two workspaces — but take the name the visitor gave their
      // business in the demo, since the placeholder means they never named it.
      try {
        business = await renameBusiness(business.id, wanted);
      } catch {
        /* keeping the placeholder name is not worth failing the migration over */
      }
    }

    if (!business?.id) return null;
    window.localStorage.setItem(ACTIVE_BUSINESS_KEY, business.id);
    return business.id;
  } catch {
    return null;
  }
}

/**
 * Replay the stashed demo into the signed-in account. Returns null when there's
 * nothing pending, or when the stash belongs to someone else.
 *
 * Clears the stash once at least one op has landed. If every op failed — offline,
 * rate-limited, session not ready — the stash stays put and `allFailed` says so.
 */
export async function migratePendingDemo(userId: string): Promise<MigrationResult | null> {
  if (migrating) return null;
  const stash = claimStashFor(userId);
  if (!stash) return null;

  migrating = true;
  try {
    const { state } = stash;
    const result: MigrationResult = {
      customers: 0, transactions: 0, invoices: 0, loans: 0, groups: 0, entries: 0,
      failed: 0, allFailed: false,
    };

    // Nothing below can succeed without a workspace to write into, and failing
    // every op one at a time would look like a network problem instead of a
    // missing business. Resolve it once, up front.
    if (!(await ensureActiveBusiness(state.business?.name ?? ''))) {
      result.failed = 1;
      result.allFailed = true;
      result.firstError = "We couldn't open a workspace for this account.";
      releaseLock();   // stash kept and retryable — don't make them wait out the lease
      return result;
    }

    // Rehydrated from the stash so a resumed run can still resolve references
    // made by ops that completed before the interruption.
    const done = new Set(stash.progress.completedOpIds);
    const customerIds = new Map(stash.progress.customerIds);
    const invoiceIds = new Map(stash.progress.invoiceIds);
    const loanIds = new Map(stash.progress.loanIds);
    const groupIds = new Map(stash.progress.groupIds);

    /** Persist after every op, so an interruption costs at most the op in flight. */
    const checkpoint = (opId: string) => {
      done.add(opId);
      stash.progress = {
        completedOpIds: [...done],
        customerIds: [...customerIds],
        invoiceIds: [...invoiceIds],
        loanIds: [...loanIds],
        groupIds: [...groupIds],
      };
      // Also renews the lease: a long replay is still alive, and letting the
      // lock lapse mid-run would invite a second tab to start duplicating.
      stash.lockedAt = Date.now();
      try { writeStash(stash); } catch { /* quota/private mode — replay still finishes */ }
    };

    /** Groups are referenced by everything else, so resolve through the id map. */
    const realGroupId = (demoGroupId: string | null | undefined) =>
      demoGroupId ? groupIds.get(demoGroupId) ?? null : null;

    for (const op of state.createdOrder) {
      if (done.has(op.opId)) continue;
      try {
        if (op.kind === 'create' && op.entity === 'group') {
          const demo = state.groups.find((g) => g.id === op.entityId);
          if (!demo) continue;
          const real = await createGroup({
            name: demo.name,
            description: demo.description ?? undefined,
            type: demo.type,
            color: demo.color,
          });
          groupIds.set(demo.id, real.id);
          result.groups += 1;
        } else if (op.kind === 'create' && op.entity === 'customer') {
          const demo = state.customers.find((c) => c.id === op.entityId);
          if (!demo) continue;
          const real = await createCustomer({
            name: demo.name,
            email: demo.email,
            phone: demo.phone,
            addressLine1: demo.addressLine1,
            addressLine2: demo.addressLine2,
            city: demo.city,
            region: demo.region,
            postalCode: demo.postalCode,
            country: demo.country,
            notes: demo.notes,
          });
          customerIds.set(demo.id, real.id);
          result.customers += 1;
        } else if (op.kind === 'create' && op.entity === 'transaction') {
          const demo = state.transactions.find((t) => t.id === op.entityId);
          if (!demo) continue;
          const entry = state.ledger.entries.find((e) => e.sourceId === demo.id);
          await createTransaction({
            type: demo.type,
            category: demo.category,
            amount: demo.amount,
            date: demo.date,
            description: demo.description,
            groupId: realGroupId(entry?.groupId),
          });
          result.transactions += 1;
        } else if (op.kind === 'create' && op.entity === 'invoice') {
          const demo = state.invoices.find((i) => i.id === op.entityId);
          if (!demo) continue;
          const real = await createInvoice({
            customerId: demo.customerId ? customerIds.get(demo.customerId) ?? null : null,
            issueDate: demo.issueDate,
            dueDate: demo.dueDate,
            message: demo.message,
            details: demo.details,
            paymentTerms: demo.paymentTerms,
            notes: demo.notes,
            taxRate: demo.taxRate,
            groupId: realGroupId(demo.groupId),
            items: demo.items.map((it) => ({
              name: it.name,
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              amount: it.amount,
            })),
          });
          invoiceIds.set(demo.id, real.id);
          result.invoices += 1;
        } else if (op.kind === 'create' && op.entity === 'loan') {
          const demo = state.loans.find((l) => l.id === op.entityId);
          if (!demo) continue;
          const real = await createLoan({
            name: demo.name,
            type: demo.type,
            amount: demo.principal,
            annualRate: demo.annualRate,
            date: demo.startDate ?? undefined,
          });
          loanIds.set(demo.id, real.id);
          result.loans += 1;
        } else if (op.kind === 'statusChange') {
          // Only reachable for a stash written before the demo started gating at
          // the invoice preview; new sessions carry invoices over as drafts.
          const realId = invoiceIds.get(op.entityId);
          if (!realId) continue;
          if (op.toStatus === 'sent') await markInvoiceSent(realId);
          else await markInvoicePaid(realId);
        } else if (op.kind === 'accrual') {
          const entry = state.ledger.entries.find((e) => e.id === op.entryId);
          if (!entry?.workflowType) continue;
          // The signed amount is the same whichever side we read; take the debit.
          const amount = entry.lines.reduce((s, l) => s + l.debit, 0);
          await runWorkflow({
            type: entry.workflowType,
            amount,
            description: entry.description,
            date: entry.date,
            groupId: realGroupId(entry.groupId),
          });
          result.entries += 1;
        } else if (op.kind === 'loanPayment') {
          const payment = state.loanPayments.find((p) => p.id === op.paymentId);
          if (!payment) continue;
          const realLoanId = loanIds.get(payment.loanId);
          if (!realLoanId) continue;
          await recordLoanPayment(realLoanId, { amount: payment.amount, date: payment.date });
          result.entries += 1;
        }
        checkpoint(op.opId);
      } catch (err) {
        // One bad op shouldn't cost the user everything else they built.
        result.failed += 1;
        // Keep the first reason. A silent count tells nobody why.
        result.firstError ??= err instanceof Error ? err.message : String(err);
      }
    }

    const succeeded = succeededCount(result);
    result.allFailed = succeeded === 0 && result.failed > 0;

    if (result.allFailed) {
      // Keep the stash: nothing landed, so a retry is worth offering. Drop the
      // lease with it, or the Try again button would sit blocked behind a lock
      // this very run is about to stop holding.
      releaseLock();
      return result;
    }

    clearPendingDemo();
    reset();
    return succeeded === 0 && result.failed === 0 ? null : result;
  } finally {
    migrating = false;
  }
}
