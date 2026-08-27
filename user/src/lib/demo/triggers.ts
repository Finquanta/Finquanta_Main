/**
 * When to ask an anonymous visitor to sign up.
 *
 * The banner is always there; these are the moments worth interrupting for —
 * either the visitor has built something they'd hate to lose, or they've hit a
 * wall the demo can't take them past. Each reason fires at most once per
 * session: dismissing it records the dismissal, and `nextTrigger` never returns
 * a dismissed reason again.
 */
import { DemoState, DemoTriggerReason } from './types';
import { DEMO_SCAN_CAP, FINNA_MESSAGE_CAP } from './store';

/**
 * No activity for this long, with work on the books, reads as "about to leave".
 * Generous on purpose: filling in an invoice is several quiet minutes of typing
 * that record no interaction, and interrupting that is worse than missing it.
 */
const IDLE_MS = 180_000;
/** A long session has demonstrated intent — worth one ask. */
const SESSION_CEILING_MS = 15 * 60_000;
/** Enough actions that the session represents real effort. */
const INTERACTION_CEILING = 15;

export interface TriggerCopy {
  title: string;
  body: string;
  cta: string;
}

type T = (ns: string, key: string) => string;

/**
 * Built per call rather than as a constant: this copy is the demo's whole
 * conversion pitch, and a module-level object cannot reach the translation hook,
 * so it stayed English in all ten languages.
 */
export function triggerCopy(t: T): Record<DemoTriggerReason, TriggerCopy> {
  return {
    scanCap: {
      title: t('demo', 'tgScanCapTitle'),
      body: t('demo', 'tgScanCapBody'),
      cta: t('demo', 'tgScanCapCta'),
    },
    finnaCap: {
      title: t('demo', 'tgFinnaCapTitle'),
      body: t('demo', 'tgFinnaCapBody'),
      cta: t('demo', 'tgFinnaCapCta'),
    },
    invoicePreviewed: {
      title: t('demo', 'tgPreviewTitle'),
      body: t('demo', 'tgPreviewBody'),
      cta: t('demo', 'tgPreviewCta'),
    },
    sessionCeiling: {
      title: t('demo', 'tgSessionTitle'),
      body: t('demo', 'tgSessionBody'),
      cta: t('demo', 'tgKeepBuilt'),
    },
    interactionCount: {
      title: t('demo', 'tgInteractionTitle'),
      body: t('demo', 'tgInteractionBody'),
      cta: t('demo', 'tgKeepBuilt'),
    },
    idle: {
      title: t('demo', 'tgIdleTitle'),
      body: t('demo', 'tgIdleBody'),
      cta: t('demo', 'tgSaveMyWork'),
    },
  };
}

/**
 * The highest-priority trigger that's currently live and not already dismissed.
 * Ordered by how much the visitor has to lose by ignoring it.
 */
export function nextTrigger(state: DemoState, now = Date.now()): DemoTriggerReason | null {
  const dismissed = (r: DemoTriggerReason) => state.meta.dismissedTriggers[r] != null;
  const hasWork = state.createdOrder.length > 0;

  /**
   * Above the invoice preview, and that is deliberate. Watching a photograph
   * of a real receipt fill in its own entry is the most convincing thing the
   * demo does, and the moment right after it is the best moment to ask.
   */
  if (!dismissed('scanCap') && (state.scan?.used ?? 0) >= DEMO_SCAN_CAP) return 'scanCap';

  if (!dismissed('finnaCap') && state.finna.messagesUsed >= FINNA_MESSAGE_CAP) return 'finnaCap';

  // The strongest moment in the demo: they've built an invoice and just watched
  // it render as a real document. Everything they'd do next needs an account.
  if (!dismissed('invoicePreviewed') && state.meta.invoicePreviewedAt != null) {
    return 'invoicePreviewed';
  }

  if (!dismissed('sessionCeiling') && hasWork && now - state.meta.startedAt >= SESSION_CEILING_MS) {
    return 'sessionCeiling';
  }

  // `hasWork` matters as much here as it does for the two above: without it,
  // fifteen clicks that created nothing still promise to carry over "every entry,
  // customer and invoice", with an empty summary box underneath saying otherwise.
  if (!dismissed('interactionCount') && hasWork && state.meta.interactionCount >= INTERACTION_CEILING) {
    return 'interactionCount';
  }

  if (!dismissed('idle') && hasWork && now - state.meta.lastInteractionAt >= IDLE_MS) {
    return 'idle';
  }

  return null;
}

/** A one-line summary of what a signup would carry over, for the prompt. */
export function describeWork(state: DemoState, t: T): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) =>
    `${n} ${t('demo', n === 1 ? one : many)}`;
  if (state.transactions.length) parts.push(plural(state.transactions.length, 'tgEntry', 'tgEntries'));
  if (state.invoices.length) parts.push(plural(state.invoices.length, 'tgInvoice', 'tgInvoices'));
  if (state.customers.length) parts.push(plural(state.customers.length, 'tgCustomer', 'tgCustomers'));
  if (state.loans.length) parts.push(plural(state.loans.length, 'tgLoan', 'tgLoans'));
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} ${t('demo', 'tgAnd')} ${parts[parts.length - 1]}`;
}

