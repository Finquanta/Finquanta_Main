import { Pool } from 'pg';
import { Database, isWriteStatement } from '../../src/infrastructure/database';
import { requestContext } from '../../src/infrastructure/request-context';

// Mock the pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [{ test: 1 }] }),
      release: jest.fn(),
    }),
    query: jest.fn().mockResolvedValue({ rows: [{ test: 1 }] }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
  PoolClient: jest.fn(),
}));

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database();
  });

  describe('connection management', () => {
    it('should connect to PostgreSQL database successfully', async () => {
      await db.connect();
      expect(db.isConnected()).toBe(true);
    });

    it('should disconnect from PostgreSQL database successfully', async () => {
      await db.connect();
      await db.disconnect();
      expect(db.isConnected()).toBe(false);
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await db.connect();
    });

    afterEach(async () => {
      await db.disconnect();
    });

    it('should execute simple queries successfully', async () => {
      const result = await db.query('SELECT 1 as test');
      expect(result.rows).toEqual([{ test: 1 }]);
    });

    it('should execute queries with parameters successfully', async () => {
      const result = await db.query('SELECT $1 as test', [42]);
      expect(result.rows).toEqual([{ test: 1 }]);
    });
  });

  describe('transaction management', () => {
    beforeEach(async () => {
      await db.connect();
    });

    afterEach(async () => {
      await db.disconnect();
    });

    it('should execute transactions successfully', async () => {
      const result = await db.transaction(async (client: any) => {
        const queryResult = await client.query('SELECT 1 as test');
        return queryResult.rows[0];
      });

      expect(result).toEqual({ test: 1 });
    });

    it('should rollback transactions on errors', async () => {
      await expect(
        db.transaction(async (client: any) => {
          await client.query('SELECT 1');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('who made a change (books history)', () => {
    const USER = '6f1c2b1e-0c1a-4a55-9a3e-0f0b7c9d8e21';
    const poolMock = () => {
      const results = (Pool as unknown as jest.Mock).mock.results;
      return results[results.length - 1]!.value;
    };

    it('counts writes, and WITH only when it wraps one', () => {
      expect(isWriteStatement('UPDATE invoices SET total = 1')).toBe(true);
      expect(isWriteStatement('  insert into loans DEFAULT VALUES')).toBe(true);
      expect(isWriteStatement('WITH gone AS (DELETE FROM loans RETURNING id) SELECT count(*) FROM gone')).toBe(true);
      expect(isWriteStatement('WITH entry_group AS (SELECT id FROM groups) SELECT * FROM entry_group')).toBe(false);
      expect(isWriteStatement('WITH x AS (SELECT updated_at, is_deleted FROM invoices) SELECT * FROM x')).toBe(false);
      expect(isWriteStatement('SELECT 1')).toBe(false);
    });

    it('tags a signed-in write, setting the actor in the same round trip as BEGIN', async () => {
      const client = await poolMock().connect();
      client.query.mockClear();
      await requestContext.run({ userId: USER }, () => db.query('UPDATE invoices SET total = $1', [1]));
      expect(client.query.mock.calls.map((call: unknown[]) => call[0])).toEqual([
        `BEGIN; SELECT set_config('app.actor_id', '${USER}', true)`,
        'UPDATE invoices SET total = $1',
        'COMMIT',
      ]);
    });

    it('sends a signed-in read-only WITH straight through the pool', async () => {
      const pool = poolMock();
      const client = await pool.connect();
      client.query.mockClear();
      const text = 'WITH g AS (SELECT 1) SELECT * FROM g';
      await requestContext.run({ userId: USER }, () => db.query(text));
      expect(client.query).not.toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledWith(text, undefined);
    });
  });
});
