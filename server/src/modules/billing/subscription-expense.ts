import { Database } from '../../infrastructure/database';
import { AccountingRepository } from '../accounting/accounting.repository';
import { TransactionRepository } from '../financial/transaction.repository';
import { TransactionType } from '../financial/transaction.types';
import { PLANS, PLAN_KEYS } from './plans';

/**
 * Book the customer's own Finquanta subscription into their books.
 *
 * When someone pays us, that is a software expense for their business — the
 * kind of small recurring cost people forget to record. We already know it
 * happened, to the cent, on the day it happened, so recording it for them is
 * free accuracy.
 *
 * Posted through `buildWorkflow('cash_expense')` and `createEntry`, exactly the
 * path a hand-typed expense takes. The same rule spec 09 §8b sets for the bank
 * layer applies here: never write journal lines directly, or an imported entry
 * and a typed one stop producing identical books.
 */

/** Stripe amounts are in minor units. */
const fromMinor = (n: unknown): number => Math.round(Number(n ?? 0)) / 100;

export class SubscriptionExpenseService {
  private readonly ledger: AccountingRepository;
  private readonly transactions: TransactionRepository;

  constructor(private readonly database: Database) {
    this.ledger = new AccountingRepository(database);
    this.transactions = new TransactionRepository(database);
  }

  async ensureSchema(): Promise<void> {
    /**
     * One row per Stripe invoice we have booked.
     *
     * Webhooks are retried — Stripe resends until it gets a 200, and our
     * handler returns 500 on failure precisely so it will. Without this, a
     * retried `invoice.paid` would post the same expense twice and quietly
     * corrupt the customer's books. The primary key is the guard.
     */
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS billing_booked_invoices (
        stripe_invoice_id VARCHAR(64) PRIMARY KEY,
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        entry_id UUID,
        amount NUMERIC(14,2) NOT NULL,
        booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }

  /**
   * Record a paid Stripe invoice as a cash expense. Returns the entry id, or
   * null when nothing was booked (already done, or nothing to book).
   *
   * Never throws: the customer has paid and their plan must be granted whatever
   * happens here. A missing bookkeeping entry is a gap someone can fill by
   * hand; a webhook that 500s because of it would leave them unable to use what
   * they just bought.
   */
  async recordFromInvoice(businessId: string, invoice: any): Promise<string | null> {
    try {
      const invoiceId: string | undefined = invoice?.id;
      if (!invoiceId) return null;

      // `amount_paid` rather than `total`: what actually moved, after any
      // proration credit or discount. Booking the sticker price when a
      // mid-cycle upgrade only charged the difference would overstate expenses.
      const amount = fromMinor(invoice?.amount_paid);
      if (!(amount > 0)) return null; // a zero invoice is not an expense

      // Claim the invoice first. If another delivery of the same event is in
      // flight, one of them loses here and does not post a second entry.
      const claim = await this.database.query(
        `INSERT INTO billing_booked_invoices (stripe_invoice_id, business_id, amount)
              VALUES ($1, $2, $3)
         ON CONFLICT (stripe_invoice_id) DO NOTHING
         RETURNING stripe_invoice_id`,
        [invoiceId, businessId, amount]
      );
      if (claim.rowCount === 0) return null; // already booked

      /**
       * Recorded as a BOOKKEEPING TRANSACTION, not as a bare ledger entry.
       *
       * It used to post straight to the ledger, which balanced correctly but
       * produced a second-class row: no Invoice Description in the entry modal
       * and no monthly/yearly marker in the bookkeeping card, because both of
       * those live on `financial_transactions` and a ledger-only entry has no
       * transaction behind it.
       *
       * `syncBookkeeping` then derives the journal entry from this row, which
       * is the same path a hand-typed expense takes — so the books cannot drift
       * between an entry we wrote and one a person typed. It is also why the
       * entry is NOT created here as well: two writers for one expense is how
       * a cost gets counted twice.
       */
      const ownerId = await this.ownerOf(businessId);
      const line = invoice?.lines?.data?.[0];
      const cycle = line?.price?.recurring?.interval;

      const tx = await this.transactions.create(businessId, ownerId, {
        type: TransactionType.EXPENSE,
        // The category becomes the ledger entry's description via syncBookkeeping.
        category: this.subject(invoice),
        // The free-text note — the "Invoice Description" field in the modal.
        description: this.receiptLine(invoice),
        amount,
        date: this.paidOn(invoice) ?? new Date().toISOString().slice(0, 10),
        invoice: invoiceId,
        metadata: {
          // Drives the monthly/yearly badge on the bookkeeping card. Taken from
          // Stripe's own interval rather than guessed from the amount.
          recurrence: cycle === 'year' ? 'yearly' : cycle === 'month' ? 'monthly' : 'once',
          source: 'finquanta_subscription',
          stripeInvoiceId: invoiceId,
        },
      });

      await this.ledger.syncBookkeeping(businessId);
      const found = await this.database.query(
        `SELECT id FROM journal_entries WHERE source_type = 'bookkeeping' AND source_id = $1`,
        [tx.id]
      );
      const entryId: string | null = found.rows[0]?.id ?? null;

      await this.database.query(
        'UPDATE billing_booked_invoices SET entry_id = $2 WHERE stripe_invoice_id = $1',
        [invoiceId, entryId]
      );
      return entryId;
    } catch {
      return null;
    }
  }

  /**
   * Which of OUR plans this invoice is for.
   *
   * Read from the price id against the catalogue rather than from Stripe's
   * nickname, so the books say "Business" even if somebody renames the product
   * in the Stripe dashboard. Falls back to Stripe's own text when the price is
   * one we do not recognise.
   */
  private planName(invoice: any): string | null {
    const line = invoice?.lines?.data?.[0];
    const priceId = line?.price?.id ?? line?.pricing?.price_details?.price;
    if (priceId) {
      for (const key of PLAN_KEYS) {
        for (const cycle of ['MONTHLY', 'YEARLY']) {
          if (process.env[`STRIPE_PRICE_${key.toUpperCase()}_${cycle}`] === priceId) {
            return PLANS[key].name;
          }
        }
      }
    }
    return line?.plan?.nickname ?? line?.description ?? null;
  }

  /**
   * What this cost looks like in a list of transactions months later.
   *
   * Two parts, because they answer different questions: WHAT it was, and HOW it
   * was priced. The second half carries the seat count and the billing cycle,
   * which is what makes an unexpected amount explainable — three seats at
   * $99.99 monthly reads very differently from one seat billed yearly.
   */
  private subject(invoice: any): string {
    const plan = this.planName(invoice);
    return plan ? `Finquanta AI ${plan} Subscription` : 'Finquanta AI Subscription';
  }

  /**
   * The Invoice Description: how the amount was arrived at.
   *
   * Seats and cadence are what make an unexpected figure explainable — three
   * seats at $99.99 monthly reads very differently from one billed yearly, and
   * the total alone shows neither.
   */
  private receiptLine(invoice: any): string {
    const line = invoice?.lines?.data?.[0];
    const unit = fromMinor(line?.price?.unit_amount);
    const seats = Number(line?.quantity) || 1;
    const cycle = line?.price?.recurring?.interval;
    const cadence = cycle === 'year' ? 'yearly' : cycle === 'month' ? 'monthly' : null;

    if (!(unit > 0) || !cadence) return 'Receipt from Finquanta AI';
    const seatText = seats === 1 ? '1 seat' : `${seats} seats`;
    return `Receipt from Finquanta AI — $${unit.toFixed(2)} × ${seatText}, ${cadence}`;
  }

  /**
   * Whose name the transaction is filed under.
   *
   * Bookkeeping rows require a user, and the owner is the honest answer: they
   * are the one who bought it. Nobody was signed in when Stripe called.
   */
  private async ownerOf(businessId: string): Promise<string> {
    const r = await this.database.query('SELECT owner_id FROM businesses WHERE id = $1', [businessId]);
    return r.rows[0]?.owner_id ?? null;
  }

  /** The date money moved, not the date the webhook arrived. */
  private paidOn(invoice: any): string | null {
    const ts = invoice?.status_transitions?.paid_at ?? invoice?.created;
    return ts ? new Date(Number(ts) * 1000).toISOString().slice(0, 10) : null;
  }
}
