import { Database } from '../../../src/infrastructure/database';
import { CustomersRepository } from '../../../src/modules/customers/customers.repository';
import { GroupsRepository } from '../../../src/modules/groups/groups.repository';
import { InvoicesRepository } from '../../../src/modules/invoices/invoices.repository';
import { AccountingRepository } from '../../../src/modules/accounting/accounting.repository';

/**
 * Every read and write in the ledger stays inside one business.
 *
 * This is the invariant with the worst failure mode in the product: a query
 * that forgets `business_id` does not crash, does not look wrong in review, and
 * quietly shows one company another company's books. `invoices`, `groups` and
 * `customers` had no tests at all, and a hand-written SQL mock would not have
 * caught it either — it would only prove the mock agrees with itself.
 *
 * So this drives the real repositories against a recording stub and inspects
 * the SQL they actually issue. Two things are asserted per statement:
 *
 *  - the business is a PARAMETER, never interpolated into the SQL text, so a
 *    business id can never be concatenated into a query; and
 *  - the statement mentions `business_id`, so it is scoped rather than global.
 *
 * Return values are deliberately not asserted — the stub is not Postgres and
 * pretending otherwise is how mock-heavy tests start lying. Methods are allowed
 * to throw while mapping the stub's rows; the SQL is already recorded by then.
 */

const BUSINESS = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const USER = '33333333-3333-3333-3333-333333333333';

/**
 * Duck-typed rather than `extends Database`: the Database constructor builds a
 * real pg Pool before a subclass can override anything, so one per test leaks
 * pools, keeps jest workers alive and makes this suite minutes rather than
 * seconds. Repositories only use `.query()` and `.transaction()`.
 */
class RecordingDatabase {
  statements: { text: string; params: any[] }[] = [];

  async query(text: string, params?: any[]): Promise<any> {
    this.statements.push({ text, params: params ?? [] });
    return { rows: [{ id: OTHER_ID, count: '0', total: '0' }], rowCount: 1 };
  }

  async transaction<T>(cb: (client: any) => Promise<T>): Promise<T> {
    return cb({ query: (text: string, params?: any[]) => this.query(text, params) });
  }

  asDatabase() { return this as unknown as Database; }

  /** Everything except schema setup, which is DDL and legitimately global. */
  businessScoped() {
    return this.statements.filter(
      (s) => !/CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP INDEX|CREATE UNIQUE/i.test(s.text)
    );
  }
}

/** Run a call for its SQL. Mapping errors are irrelevant here — see the note. */
const record = async (fn: () => Promise<unknown>) => {
  try { await fn(); } catch { /* the statements are what matter */ }
};

describe('the ledger stays inside one business', () => {
  let db: RecordingDatabase;

  beforeEach(() => { db = new RecordingDatabase(); });

  /**
   * Child tables that carry no `business_id` of their own and inherit it from
   * a parent row — `invoice_items.invoice_id -> invoices`, and journal lines
   * hanging off an entry. Reaching one of these is only safe if the parent was
   * looked up under a business filter FIRST, so that is what gets asserted,
   * rather than exempting them outright and leaving a hole in the check.
   */
  const CHILD_TABLES = /(?:invoice_items|journal_lines)/i;

  const assertScoped = () => {
    const statements = db.businessScoped();
    expect(statements.length).toBeGreaterThan(0);

    let sawScopedParent = false;

    for (const { text, params } of statements) {
      // Never concatenated into the SQL, whatever kind of statement it is.
      expect(text).not.toContain(BUSINESS);

      const scoped = params.includes(BUSINESS) && text.toLowerCase().includes('business_id');
      if (scoped) { sawScopedParent = true; continue; }

      // Not scoped itself — only acceptable for a child table reached after
      // its parent was already checked.
      expect(text).toMatch(CHILD_TABLES);
      expect(sawScopedParent).toBe(true);
    }

    // At least one statement did the actual scoping.
    expect(sawScopedParent).toBe(true);
  };

  describe('customers', () => {
    it.each([
      ['list', (r: CustomersRepository) => r.list(BUSINESS)],
      ['getById', (r: CustomersRepository) => r.getById(BUSINESS, OTHER_ID)],
      ['create', (r: CustomersRepository) => r.create(BUSINESS, { name: 'Acme' } as any)],
      ['update', (r: CustomersRepository) => r.update(BUSINESS, OTHER_ID, { name: 'Acme' } as any)],
      ['remove', (r: CustomersRepository) => r.remove(BUSINESS, OTHER_ID)],
    ])('%s', async (_name, call) => {
      await record(() => call(new CustomersRepository(db.asDatabase())));
      assertScoped();
    });
  });

  describe('invoices', () => {
    it.each([
      ['list', (r: InvoicesRepository) => r.list(BUSINESS)],
      ['listDeleted', (r: InvoicesRepository) => r.listDeleted(BUSINESS)],
      ['getById', (r: InvoicesRepository) => r.getById(BUSINESS, OTHER_ID)],
      ['nextNumber', (r: InvoicesRepository) => r.nextNumber(BUSINESS)],
      ['softDelete', (r: InvoicesRepository) => r.softDelete(BUSINESS, OTHER_ID)],
      ['restore', (r: InvoicesRepository) => r.restore(BUSINESS, OTHER_ID)],
      ['remove', (r: InvoicesRepository) => r.remove(BUSINESS, OTHER_ID)],
      ['clearLedgerLinks', (r: InvoicesRepository) => r.clearLedgerLinks(BUSINESS, OTHER_ID)],
      ['outstandingByCustomer', (r: InvoicesRepository) => r.outstandingByCustomer(BUSINESS)],
    ])('%s', async (_name, call) => {
      await record(() => call(new InvoicesRepository(db.asDatabase())));
      assertScoped();
    });
  });

  describe('groups', () => {
    it.each([
      ['list', (r: GroupsRepository) => r.list(BUSINESS)],
      ['list including archived', (r: GroupsRepository) => r.list(BUSINESS, true)],
      ['remove', (r: GroupsRepository) => r.remove(BUSINESS, OTHER_ID)],
      ['getItems', (r: GroupsRepository) => r.getItems(BUSINESS, OTHER_ID)],
      ['getItems unassigned', (r: GroupsRepository) => r.getItems(BUSINESS, null)],
      ['getGroupReport', (r: GroupsRepository) => r.getGroupReport(BUSINESS, '2026-01-01', '2026-12-31')],
    ])('%s', async (_name, call) => {
      await record(() => call(new GroupsRepository(db.asDatabase())));
      assertScoped();
    });
  });

  describe('accounting', () => {
    it.each([
      ['purgeInvoiceEntries', (r: AccountingRepository) => r.purgeInvoiceEntries(BUSINESS, OTHER_ID)],
      ['purgeBinnedInvoiceEntries', (r: AccountingRepository) => r.purgeBinnedInvoiceEntries(BUSINESS)],
      ['getLedgerSummary', (r: AccountingRepository) => r.getLedgerSummary(BUSINESS, '2026-01-01', '2026-12-31')],
    ])('%s', async (_name, call) => {
      await record(() => call(new AccountingRepository(db.asDatabase())));
      assertScoped();
    });
  });

  describe('the guard itself', () => {
    it('fails when a statement forgets the business', async () => {
      // Proves the assertion above can actually fail, rather than passing
      // because nothing was recorded or the filter swallowed everything.
      db.statements.push({ text: 'SELECT * FROM invoices', params: [] });
      expect(() => assertScoped()).toThrow();
    });

    it('fails when the business is concatenated instead of parameterised', async () => {
      db.statements.push({ text: `SELECT * FROM invoices WHERE business_id = '${BUSINESS}'`, params: [BUSINESS] });
      expect(() => assertScoped()).toThrow();
    });
  });
});
