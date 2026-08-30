import { CustomersRepository } from '../../../src/modules/customers/customers.repository';
import { TestDatabase } from '../../helpers/test-database';

/**
 * The customers queries, against real Postgres.
 *
 * This module had no tests at all. The scoping suite proves every statement
 * filters by business, but not that the SQL does what it says — that ORDER BY
 * sorts by name, that a partial update leaves the untouched columns alone, that
 * a delete belonging to another business matches nothing. Those are the
 * failures that show a wrong list rather than an error.
 *
 * PGlite gives the real parser and the real types, so a NUMERIC coming back as
 * a string or a column that does not exist fails here rather than in someone's
 * account.
 */
describe('CustomersRepository', () => {
  let db: TestDatabase;
  let repo: CustomersRepository;
  let business: string;
  let otherBusiness: string;

  beforeAll(async () => {
    db = await TestDatabase.create();
    repo = new CustomersRepository(db.asDatabase());
    await repo.ensureSchema();
  });

  // Truncate rather than rebuild: the schema is fixed, only the data varies.
  beforeEach(async () => {
    await db.reset();
    business = await db.newBusiness('Ours');
    otherBusiness = await db.newBusiness('Theirs');
  });

  afterAll(async () => { await db.close(); });

  describe('create', () => {
    it('stores and returns the customer', async () => {
      const created = await repo.create(business, { name: 'Acme Ltd', email: 'ops@acme.test' } as any);
      expect(created.id).toBeTruthy();
      expect(created.name).toBe('Acme Ltd');
      expect(created.email).toBe('ops@acme.test');
    });

    it('trims the name', async () => {
      const created = await repo.create(business, { name: '  Acme Ltd  ' } as any);
      expect(created.name).toBe('Acme Ltd');
    });

    it('leaves optional fields null rather than empty', async () => {
      const created = await repo.create(business, { name: 'Acme' } as any);
      expect(created.email ?? null).toBeNull();
      expect(created.phone ?? null).toBeNull();
    });
  });

  describe('list', () => {
    it('returns only this business’s customers', async () => {
      await repo.create(business, { name: 'Ours A' } as any);
      await repo.create(otherBusiness, { name: 'Theirs' } as any);

      const rows = await repo.list(business);
      expect(rows.map((r) => r.name)).toEqual(['Ours A']);
    });

    it('sorts by name, not by insertion order', async () => {
      for (const name of ['Zebra', 'Alpha', 'Mango']) {
        await repo.create(business, { name } as any);
      }
      expect((await repo.list(business)).map((r) => r.name)).toEqual(['Alpha', 'Mango', 'Zebra']);
    });

    it('is empty for a business with nothing', async () => {
      expect(await repo.list(business)).toEqual([]);
    });
  });

  describe('getById', () => {
    it('finds one of ours', async () => {
      const created = await repo.create(business, { name: 'Acme' } as any);
      expect((await repo.getById(business, created.id))?.name).toBe('Acme');
    });

    it('will not read across businesses', async () => {
      // The whole point of the business filter — asking for someone else's
      // customer by its real id must come back empty, not found.
      const theirs = await repo.create(otherBusiness, { name: 'Theirs' } as any);
      expect(await repo.getById(business, theirs.id)).toBeNull();
    });

    it('returns null for an id that does not exist', async () => {
      expect(await repo.getById(business, '11111111-1111-1111-1111-111111111111')).toBeNull();
    });
  });

  describe('update', () => {
    it('changes only the fields given', async () => {
      const created = await repo.create(business, {
        name: 'Acme', email: 'ops@acme.test', city: 'Leeds',
      } as any);

      const updated = await repo.update(business, created.id, { city: 'York' } as any);

      expect(updated?.city).toBe('York');
      // Untouched columns must survive a partial update.
      expect(updated?.name).toBe('Acme');
      expect(updated?.email).toBe('ops@acme.test');
    });

    it('maps camelCase fields to their real columns', async () => {
      const created = await repo.create(business, { name: 'Acme' } as any);
      const updated = await repo.update(business, created.id, {
        addressLine1: '1 High St', postalCode: 'LS1 1AA',
      } as any);
      expect(updated?.addressLine1).toBe('1 High St');
      expect(updated?.postalCode).toBe('LS1 1AA');
    });

    it('blanks a field set to an empty string', async () => {
      const created = await repo.create(business, { name: 'Acme', city: 'Leeds' } as any);
      const updated = await repo.update(business, created.id, { city: '   ' } as any);
      expect(updated?.city ?? null).toBeNull();
    });

    it('will not update another business’s customer', async () => {
      const theirs = await repo.create(otherBusiness, { name: 'Theirs' } as any);
      expect(await repo.update(business, theirs.id, { name: 'Hijacked' } as any)).toBeNull();
      // And theirs is untouched.
      expect((await repo.getById(otherBusiness, theirs.id))?.name).toBe('Theirs');
    });

    it('with no fields at all is a read, not a write', async () => {
      const created = await repo.create(business, { name: 'Acme' } as any);
      expect((await repo.update(business, created.id, {}))?.name).toBe('Acme');
    });
  });

  describe('remove', () => {
    it('deletes and reports that it did', async () => {
      const created = await repo.create(business, { name: 'Acme' } as any);
      expect(await repo.remove(business, created.id)).toBe(true);
      expect(await repo.getById(business, created.id)).toBeNull();
    });

    it('reports false when nothing matched', async () => {
      expect(await repo.remove(business, '11111111-1111-1111-1111-111111111111')).toBe(false);
    });

    it('will not delete another business’s customer', async () => {
      const theirs = await repo.create(otherBusiness, { name: 'Theirs' } as any);
      expect(await repo.remove(business, theirs.id)).toBe(false);
      expect(await repo.getById(otherBusiness, theirs.id)).not.toBeNull();
    });
  });
});
