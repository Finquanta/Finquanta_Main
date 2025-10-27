import { Database } from '../../src/infrastructure/database';

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
});