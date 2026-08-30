import { GroupsRepository } from '../../../src/modules/groups/groups.repository';
import { AccountingRepository } from '../../../src/modules/accounting/accounting.repository';
import { InvoicesRepository } from '../../../src/modules/invoices/invoices.repository';
import { CustomersRepository } from '../../../src/modules/customers/customers.repository';
import { LoansRepository } from '../../../src/modules/loans/loans.repository';
import { buildWorkflow } from '../../../src/modules/accounting/accounting.engine';
import { TestDatabase } from '../../helpers/test-database';

/**
 * The Business Groups report, against real Postgres.
 *
 * This is the most intricate query in the product and it had no tests. A group
 * can be attached in FOUR different places depending on what kind of entry it
 * is — on a bookkeeping transaction's metadata, on an invoice's column, on the
 * journal entry itself, or on the loan — and the report resolves them in a
 * fixed order with COALESCE. Get that order wrong and money silently lands in
 * the wrong department: the totals still add up, they are just attributed to
 * the wrong thing, which is precisely the sort of error nobody notices until
 * they are making decisions on it.
 *
 * It is also unmockable in any useful way. The query is a CTE feeding an
 * aggregate feeding a UNION; a SQL-matching mock would be asserting a
 * transcription of the query rather than its behaviour. Real Postgres is the
 * only way this means anything.
 */
describe('getGroupReport', () => {
  let db: TestDatabase;
  let groups: GroupsRepository;
  let ledger: AccountingRepository;
  let invoices: InvoicesRepository;
  let customers: CustomersRepository;
  let loans: LoansRepository;
  let business: string;
  let otherBusiness: string;
  let user: string;

  const ALL_OF_2026 = ['2026-01-01', '2026-12-31'] as const;

  beforeAll(async () => {
    db = await TestDatabase.create();
    groups = new GroupsRepository(db.asDatabase());
    ledger = new AccountingRepository(db.asDatabase());
    invoices = new InvoicesRepository(db.asDatabase());
    customers = new CustomersRepository(db.asDatabase());
    loans = new LoansRepository(db.asDatabase());

    await customers.ensureSchema();
    await invoices.ensureSchema();
    await ledger.ensureSchema();
    await groups.ensureSchema();
    await loans.ensureSchema();

    /**
     * `financial_transactions` is stood up minimally rather than loaded from
     * src/modules/financial/schema.sql, which also brings triggers, views and
     * an analytics cache that this report never touches. Only the columns the
     * group queries actually read are here.
     */
    await db.exec(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID,
        type VARCHAR(20),
        category VARCHAR(100),
        description TEXT,
        amount DECIMAL(12,2),
        date DATE,
        status VARCHAR(20) DEFAULT 'completed',
        metadata JSONB DEFAULT '{}'
      );
    `);
  });

  beforeEach(async () => {
    await db.reset();
    business = await db.newBusiness('Ours');
    otherBusiness = await db.newBusiness('Theirs');
    user = await db.newUser();
    await ledger.ensureAccounts(business);
    await ledger.ensureAccounts(otherBusiness);
  });

  afterAll(async () => { await db.close(); });

  /** Post a real balanced entry, optionally attributed to something. */
  const post = async (opts: {
    workflow?: 'cash_revenue' | 'cash_expense';
    amount?: number;
    date?: string;
    groupId?: string | null;
    sourceType?: string;
    sourceId?: string | null;
    businessId?: string;
  }) => {
    const built = buildWorkflow(opts.workflow ?? 'cash_revenue', { amount: opts.amount ?? 100 });
    return ledger.createEntry({
      businessId: opts.businessId ?? business,
      description: built.description,
      sourceType: opts.sourceType ?? 'manual',
      sourceId: opts.sourceId ?? null,
      createdBy: user,
      date: opts.date ?? '2026-06-01',
      groupId: opts.groupId ?? null,
      lines: built.lines,
    } as any);
  };

  const report = (biz = business) => groups.getGroupReport(biz, ALL_OF_2026[0], ALL_OF_2026[1]);
  const row = async (name: string, biz = business) => (await report(biz)).find((r) => r.name === name);

  describe('the Unassigned bucket', () => {
    it('is always present, even with nothing in it', async () => {
      const rows = await report();
      expect(rows.map((r) => r.name)).toEqual(['Unassigned']);
      expect(rows[0]).toMatchObject({ groupId: null, inflow: 0, outflow: 0, entries: 0 });
    });

    it('collects entries attached to no group', async () => {
      await post({ amount: 250 });
      expect(await row('Unassigned')).toMatchObject({ inflow: 250, outflow: 0, entries: 1 });
    });
  });

  describe('totals', () => {
    it('counts revenue as inflow and expenses as outflow, and nets them', async () => {
      const g = await groups.create(business, { name: 'Marketing' });
      await post({ workflow: 'cash_revenue', amount: 300, groupId: g.id });
      await post({ workflow: 'cash_expense', amount: 120, groupId: g.id });

      expect(await row('Marketing')).toMatchObject({
        inflow: 300, outflow: 120, net: 180, entries: 2,
      });
    });

    it('counts entries, not journal lines', async () => {
      // Each entry has two lines; a COUNT without DISTINCT would say four.
      const g = await groups.create(business, { name: 'Sales' });
      await post({ amount: 10, groupId: g.id });
      await post({ amount: 20, groupId: g.id });
      expect((await row('Sales'))?.entries).toBe(2);
    });

    it('returns numbers rounded to the cent, not NUMERIC strings', async () => {
      const g = await groups.create(business, { name: 'Ops' });
      await post({ amount: 33.33, groupId: g.id });
      const r = await row('Ops');
      expect(typeof r?.inflow).toBe('number');
      expect(r?.inflow).toBe(33.33);
    });

    it('lists a group with no activity at zero rather than omitting it', async () => {
      await groups.create(business, { name: 'Empty' });
      expect(await row('Empty')).toMatchObject({ inflow: 0, outflow: 0, entries: 0 });
    });
  });

  describe('where a group can be attached', () => {
    it('on the journal entry itself (accrual / manual)', async () => {
      const g = await groups.create(business, { name: 'Direct' });
      await post({ amount: 100, groupId: g.id });
      expect((await row('Direct'))?.entries).toBe(1);
    });

    it('on the invoice the entry came from', async () => {
      const g = await groups.create(business, { name: 'ViaInvoice' });
      const inv = await invoices.create(business, user, {
        issueDate: '2026-06-01', taxRate: 0, groupId: g.id,
        items: [{ name: 'Work', quantity: 1, unitPrice: 100, amount: 100 }],
      } as any);
      // The entry carries no group of its own; it inherits the invoice's.
      await post({ amount: 100, sourceType: 'invoice', sourceId: inv.id, groupId: null });

      expect((await row('ViaInvoice'))?.entries).toBe(1);
    });

    it("on the bookkeeping transaction's metadata", async () => {
      const g = await groups.create(business, { name: 'ViaTxn' });
      const txn = await db.query(
        `INSERT INTO financial_transactions (business_id, type, category, amount, date, metadata)
         VALUES ($1::uuid, 'income', 'Sales', 100, '2026-06-01', $2::jsonb) RETURNING id`,
        [business, JSON.stringify({ groupId: g.id })]
      );
      await post({ amount: 100, sourceType: 'bookkeeping', sourceId: txn.rows[0].id, groupId: null });

      expect((await row('ViaTxn'))?.entries).toBe(1);
    });

    it('on the loan, so principal and payments inherit it', async () => {
      const g = await groups.create(business, { name: 'ViaLoan' });
      const loan = await db.query(
        `INSERT INTO loans (business_id, name, type, principal, annual_rate, group_id, created_by)
         VALUES ($1::uuid, 'Van', 'payable', 1000, 5, $2::uuid, $3::uuid) RETURNING id`,
        [business, g.id, user]
      );
      await post({ amount: 100, sourceType: 'loan_payment', sourceId: loan.rows[0].id, groupId: null });

      expect((await row('ViaLoan'))?.entries).toBe(1);
    });
  });

  describe('which one wins', () => {
    it("the transaction's own group beats the entry's", async () => {
      // COALESCE order is transaction, invoice, entry, loan. A bookkeeping row
      // regrouped by the user must not be overridden by a stale entry group.
      const wanted = await groups.create(business, { name: 'Wanted' });
      const stale = await groups.create(business, { name: 'Stale' });

      const txn = await db.query(
        `INSERT INTO financial_transactions (business_id, type, category, amount, date, metadata)
         VALUES ($1::uuid, 'income', 'Sales', 100, '2026-06-01', $2::jsonb) RETURNING id`,
        [business, JSON.stringify({ groupId: wanted.id })]
      );
      await post({ amount: 100, sourceType: 'bookkeeping', sourceId: txn.rows[0].id, groupId: stale.id });

      expect((await row('Wanted'))?.entries).toBe(1);
      expect((await row('Stale'))?.entries).toBe(0);
    });
  });

  describe('what it leaves out', () => {
    it('entries before the window', async () => {
      const g = await groups.create(business, { name: 'Windowed' });
      await post({ amount: 100, groupId: g.id, date: '2025-12-31' });
      expect((await row('Windowed'))?.entries).toBe(0);
    });

    it('entries after the window', async () => {
      const g = await groups.create(business, { name: 'Windowed' });
      await post({ amount: 100, groupId: g.id, date: '2027-01-01' });
      expect((await row('Windowed'))?.entries).toBe(0);
    });

    it('includes entries exactly on the boundaries', async () => {
      const g = await groups.create(business, { name: 'Edges' });
      await post({ amount: 10, groupId: g.id, date: '2026-01-01' });
      await post({ amount: 10, groupId: g.id, date: '2026-12-31' });
      expect((await row('Edges'))?.entries).toBe(2);
    });

    it('archived groups', async () => {
      const g = await groups.create(business, { name: 'Archived' });
      await post({ amount: 100, groupId: g.id });
      await groups.remove(business, g.id);
      expect(await row('Archived')).toBeUndefined();
    });

    it('another business entirely', async () => {
      const ours = await groups.create(business, { name: 'Ours' });
      const theirs = await groups.create(otherBusiness, { name: 'Theirs' });
      await post({ amount: 100, groupId: theirs.id, businessId: otherBusiness });

      expect((await report()).map((r) => r.name).sort()).toEqual(['Ours', 'Unassigned']);
      expect((await row('Ours'))?.entries).toBe(0);
    });
  });

  describe('ordering', () => {
    it('puts the biggest net contribution first', async () => {
      const small = await groups.create(business, { name: 'Small' });
      const big = await groups.create(business, { name: 'Big' });
      await post({ amount: 50, groupId: small.id });
      await post({ amount: 500, groupId: big.id });

      const names = (await report()).map((r) => r.name);
      expect(names.indexOf('Big')).toBeLessThan(names.indexOf('Small'));
    });
  });
});
