import { InvoicesRepository } from '../../../src/modules/invoices/invoices.repository';
import { CustomersRepository } from '../../../src/modules/customers/customers.repository';
import { TestDatabase } from '../../helpers/test-database';

/**
 * The invoice queries, against real Postgres.
 *
 * The lifecycle tests cover what an invoice puts on the LEDGER; this covers the
 * invoice records themselves — numbering, totals, the recycle bin, and who owes
 * what. All of it was untested, and none of it fails loudly when wrong: a
 * numbering query that sorts as text hands out INV-0002 twice, a recycle bin
 * that forgets `deleted_at IS NULL` shows deleted invoices in the live list, and
 * an outstanding-balance sum that counts drafts overstates what customers owe.
 *
 * Real Postgres matters more here than anywhere: the numbering relies on a
 * regex cast to int, and the totals come back as NUMERIC strings that have to be
 * parsed. A mock returning tidy JavaScript numbers would hide both.
 */
describe('InvoicesRepository', () => {
  let db: TestDatabase;
  let repo: InvoicesRepository;
  let customers: CustomersRepository;
  let business: string;
  let otherBusiness: string;
  let user: string;

  // NOTE: no `number` here — `create` always allocates its own via nextNumber,
  // so anything passed in is ignored.
  const draft = (over: Record<string, any> = {}) => ({
    status: 'draft',
    customerId: null,
    issueDate: '2026-01-01',
    dueDate: '2026-02-01',
    taxRate: 0,
    currency: 'USD',
    items: [{ name: 'Consulting', quantity: 1, unitPrice: 100, amount: 100 }],
    ...over,
  }) as any;

  beforeAll(async () => {
    db = await TestDatabase.create();
    repo = new InvoicesRepository(db.asDatabase());
    customers = new CustomersRepository(db.asDatabase());
    await customers.ensureSchema();
    await repo.ensureSchema();
  });

  beforeEach(async () => {
    await db.reset();
    business = await db.newBusiness('Ours');
    otherBusiness = await db.newBusiness('Theirs');
    user = await db.newUser();
  });

  afterAll(async () => { await db.close(); });

  describe('nextNumber', () => {
    it('starts at INV-0001 for a new business', async () => {
      expect(await repo.nextNumber(business)).toBe('INV-0001');
    });

    it('counts up from the highest existing number', async () => {
      await repo.create(business, user, draft());
      expect(await repo.nextNumber(business)).toBe('INV-0002');
    });

    it('sorts numerically, not as text, past the ninth invoice', async () => {
      // The failure this guards: compared as text, 'INV-0009' sorts ABOVE
      // 'INV-0010', so the tenth invoice would hand out a number already
      // issued. The query casts the digits to int to avoid exactly that, and
      // ten real invoices is the cheapest way to prove it.
      for (let i = 0; i < 10; i++) await repo.create(business, user, draft());

      const numbers = (await repo.list(business)).map((i) => i.number).sort();
      expect(numbers).toContain('INV-0009');
      expect(numbers).toContain('INV-0010');
      expect(new Set(numbers).size).toBe(10); // no collisions
      expect(await repo.nextNumber(business)).toBe('INV-0011');
    });

    it('is per business, so two businesses do not share a sequence', async () => {
      await repo.create(otherBusiness, user, draft());
      expect(await repo.nextNumber(business)).toBe('INV-0001');
    });
  });

  describe('create', () => {
    it('computes subtotal, tax and total from the items', async () => {
      const inv = await repo.create(business, user, draft({
        taxRate: 20,
        items: [
          { name: 'A', quantity: 2, unitPrice: 50, amount: 100 },
          { name: 'B', quantity: 1, unitPrice: 100, amount: 100 },
        ],
      }));
      expect(inv.subtotal).toBe(200);
      expect(inv.tax).toBe(40);
      expect(inv.total).toBe(240);
    });

    it('returns numbers, not NUMERIC strings', async () => {
      const inv = await repo.create(business, user, draft());
      expect(typeof inv.total).toBe('number');
      expect(typeof inv.subtotal).toBe('number');
    });

    it('stores the line items in order', async () => {
      const inv = await repo.create(business, user, draft({
        items: [
          { name: 'First', quantity: 1, unitPrice: 1, amount: 1 },
          { name: 'Second', quantity: 1, unitPrice: 2, amount: 2 },
          { name: 'Third', quantity: 1, unitPrice: 3, amount: 3 },
        ],
      }));
      const read = await repo.getById(business, inv.id);
      expect(read?.items.map((i) => i.name)).toEqual(['First', 'Second', 'Third']);
    });

    it('links a customer', async () => {
      const c = await customers.create(business, { name: 'Acme' } as any);
      const inv = await repo.create(business, user, draft({ customerId: c.id }));
      expect((await repo.getById(business, inv.id))?.customerName).toBe('Acme');
    });
  });

  describe('update', () => {
    it('replaces the items rather than appending', async () => {
      const inv = await repo.create(business, user, draft());
      await repo.update(business, inv.id, draft({
        items: [{ name: 'Replaced', quantity: 1, unitPrice: 5, amount: 5 }],
      }));
      const read = await repo.getById(business, inv.id);
      expect(read?.items.map((i) => i.name)).toEqual(['Replaced']);
      expect(read?.total).toBe(5);
    });

    it('will not touch another business’s invoice', async () => {
      const theirs = await repo.create(otherBusiness, user, draft());
      expect(await repo.update(business, theirs.id, draft())).toBeNull();
    });
  });

  describe('the recycle bin', () => {
    it('hides a deleted invoice from the live list', async () => {
      const inv = await repo.create(business, user, draft());
      expect(await repo.softDelete(business, inv.id)).toBe(true);

      expect(await repo.list(business)).toEqual([]);
      expect((await repo.listDeleted(business)).map((i) => i.id)).toEqual([inv.id]);
    });

    it('puts it back on restore', async () => {
      const inv = await repo.create(business, user, draft());
      await repo.softDelete(business, inv.id);
      expect(await repo.restore(business, inv.id)).toBe(true);

      expect((await repo.list(business)).map((i) => i.id)).toEqual([inv.id]);
      expect(await repo.listDeleted(business)).toEqual([]);
    });

    it('permanently removes it', async () => {
      const inv = await repo.create(business, user, draft());
      expect(await repo.remove(business, inv.id)).toBe(true);
      expect(await repo.getById(business, inv.id)).toBeNull();
    });

    it('will not bin another business’s invoice', async () => {
      const theirs = await repo.create(otherBusiness, user, draft());
      expect(await repo.softDelete(business, theirs.id)).toBe(false);
      expect((await repo.list(otherBusiness)).map((i) => i.id)).toEqual([theirs.id]);
    });
  });

  describe('outstandingByCustomer', () => {
    const owed = async (biz: string) => Object.fromEntries(await repo.outstandingByCustomer(biz));

    it('counts only invoices that have been billed', async () => {
      const c = await customers.create(business, { name: 'Acme' } as any);
      const sent = await repo.create(business, user, draft({ customerId: c.id }));
      await repo.setStatus(business, sent.id, 'sent');
      // A draft is not owed by anybody yet.
      await repo.create(business, user, draft({ customerId: c.id }));

      expect(await owed(business)).toEqual({ [c.id]: 100 });
    });

    it('excludes paid invoices', async () => {
      const c = await customers.create(business, { name: 'Acme' } as any);
      const inv = await repo.create(business, user, draft({ customerId: c.id }));
      await repo.setStatus(business, inv.id, 'paid');
      expect(await owed(business)).toEqual({});
    });

    it('excludes binned invoices', async () => {
      const c = await customers.create(business, { name: 'Acme' } as any);
      const inv = await repo.create(business, user, draft({ customerId: c.id }));
      await repo.setStatus(business, inv.id, 'sent');
      await repo.softDelete(business, inv.id);
      expect(await owed(business)).toEqual({});
    });

    it('adds several invoices up per customer', async () => {
      const c = await customers.create(business, { name: 'Acme' } as any);
      for (let i = 0; i < 2; i++) {
        const inv = await repo.create(business, user, draft({ customerId: c.id }));
        await repo.setStatus(business, inv.id, 'sent');
      }
      expect(await owed(business)).toEqual({ [c.id]: 200 });
    });

    it('ignores invoices with no customer', async () => {
      const inv = await repo.create(business, user, draft({ customerId: null }));
      await repo.setStatus(business, inv.id, 'sent');
      expect(await owed(business)).toEqual({});
    });
  });
});
