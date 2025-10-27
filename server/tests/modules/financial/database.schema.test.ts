import { FinancialMockDatabase } from '../../mocks/financial.database.mock';

describe('Financial Transaction Database Schema', () => {
  let db: FinancialMockDatabase;

  beforeAll(async () => {
    // Use mock database for testing
    db = new FinancialMockDatabase();
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('financial_transactions table', () => {
    it('should exist with correct structure', async () => {
      const result = await db.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'financial_transactions'
        ORDER BY ordinal_position;
      `);

      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);

      const columns = result.rows.reduce((acc: any, row: any) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default
        };
        return acc;
      }, {});

      // Check required columns
      expect(columns.id.type).toBe('uuid');
      expect(columns.id.nullable).toBe(false);
      expect(columns.id.default).toContain('gen_random_uuid()');

      expect(columns.user_id.type).toBe('uuid');
      expect(columns.user_id.nullable).toBe(false);

      expect(columns.type.type).toBe('character varying');
      expect(columns.type.nullable).toBe(false);

      expect(columns.category.type).toBe('character varying');
      expect(columns.category.nullable).toBe(false);

      expect(columns.amount.type).toBe('numeric');
      expect(columns.amount.nullable).toBe(false);

      expect(columns.date.type).toBe('date');
      expect(columns.date.nullable).toBe(false);

      expect(columns.status.type).toBe('character varying');
      expect(columns.status.nullable).toBe(false);
      expect(columns.status.default).toBe("'completed'::character varying");

      expect(columns.created_at.type).toBe('timestamp without time zone');
      expect(columns.updated_at.type).toBe('timestamp without time zone');
    });

    it('should have proper constraints', async () => {
      const constraints = await db.query(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          cc.check_clause
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.check_constraints cc
          ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'financial_transactions'
        ORDER BY tc.constraint_type, tc.constraint_name;
      `);

      expect(constraints.rows.length).toBeGreaterThan(0);

      // Check primary key
      const pkConstraint = constraints.rows.find((c: any) => c.constraint_type === 'PRIMARY KEY');
      expect(pkConstraint).toBeDefined();
      expect(pkConstraint.column_name).toBe('id');

      // Check foreign key to users
      const fkConstraint = constraints.rows.find((c: any) => c.constraint_type === 'FOREIGN KEY');
      expect(fkConstraint).toBeDefined();
      expect(fkConstraint.column_name).toBe('user_id');

      // Check check constraints
      const checkConstraints = constraints.rows.filter((c: any) => c.constraint_type === 'CHECK');
      expect(checkConstraints.length).toBeGreaterThanOrEqual(2); // type and amount checks
    });

    it('should have proper indexes', async () => {
      const indexes = await db.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'financial_transactions'
        ORDER BY indexname;
      `);

      expect(indexes.rows.length).toBeGreaterThanOrEqual(3);

      const indexNames = indexes.rows.map((idx: any) => idx.indexname);
      expect(indexNames).toContain('idx_transactions_user_date');
      expect(indexNames).toContain('idx_transactions_user_type');
      expect(indexNames).toContain('idx_transactions_invoice');
    });
  });

  describe('transaction_categories table', () => {
    it('should exist with correct structure', async () => {
      const result = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'transaction_categories'
        ORDER BY ordinal_position;
      `);

      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);

      const columns = result.rows.reduce((acc: any, row: any) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES'
        };
        return acc;
      }, {});

      expect(columns.id.type).toBe('uuid');
      expect(columns.id.nullable).toBe(false);

      expect(columns.name.type).toBe('character varying');
      expect(columns.name.nullable).toBe(false);

      expect(columns.type.type).toBe('character varying');
      expect(columns.type.nullable).toBe(false);

      expect(columns.icon.type).toBe('character varying');
      expect(columns.icon.nullable).toBe(true);

      expect(columns.color.type).toBe('character varying');
      expect(columns.color.nullable).toBe(true);

      expect(columns.is_default.type).toBe('boolean');
      expect(columns.is_default.nullable).toBe(false);
    });

    it('should have unique constraint on name and type', async () => {
      const constraints = await db.query(`
        SELECT tc.constraint_name, tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'transaction_categories'
        AND tc.constraint_type = 'UNIQUE';
      `);

      expect(constraints.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('analytics_cache table', () => {
    it('should exist with correct structure', async () => {
      const result = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'analytics_cache'
        ORDER BY ordinal_position;
      `);

      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);

      const columns = result.rows.reduce((acc: any, row: any) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES'
        };
        return acc;
      }, {});

      expect(columns.id.type).toBe('uuid');
      expect(columns.id.nullable).toBe(false);

      expect(columns.user_id.type).toBe('uuid');
      expect(columns.user_id.nullable).toBe(false);

      expect(columns.report_type.type).toBe('character varying');
      expect(columns.report_type.nullable).toBe(false);

      expect(columns.period_start.type).toBe('date');
      expect(columns.period_start.nullable).toBe(false);

      expect(columns.period_end.type).toBe('date');
      expect(columns.period_end.nullable).toBe(false);

      expect(columns.data.type).toBe('jsonb');
      expect(columns.data.nullable).toBe(false);

      expect(columns.expires_at.type).toBe('timestamp without time zone');
      expect(columns.expires_at.nullable).toBe(true);
    });

    it('should have unique constraint for caching', async () => {
      const constraints = await db.query(`
        SELECT tc.constraint_name, tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'analytics_cache'
        AND tc.constraint_type = 'UNIQUE';
      `);

      expect(constraints.rows.length).toBe(1);
    });
  });
});