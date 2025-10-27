import { readFileSync } from 'fs';
import { join } from 'path';
import { Database } from '../../infrastructure/database';

export class FinancialDatabaseSetup {
  constructor(private database: Database) {}

  async setupSchema(): Promise<void> {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    try {
      await this.database.transaction(async (client) => {
        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }
      });
      console.log('Financial database schema setup completed successfully');
    } catch (error) {
      console.error('Error setting up financial database schema:', error);
      throw error;
    }
  }

  async teardownSchema(): Promise<void> {
    const dropStatements = [
      'DROP VIEW IF EXISTS monthly_summary CASCADE',
      'DROP VIEW IF EXISTS transaction_summary CASCADE',
      'DROP TRIGGER IF EXISTS update_financial_transactions_updated_at ON financial_transactions',
      'DROP FUNCTION IF EXISTS update_updated_at_column()',
      'DROP TABLE IF EXISTS analytics_cache CASCADE',
      'DROP TABLE IF EXISTS transaction_categories CASCADE',
      'DROP TABLE IF EXISTS financial_transactions CASCADE',
    ];

    try {
      await this.database.transaction(async (client) => {
        for (const statement of dropStatements) {
          await client.query(statement);
        }
      });
      console.log('Financial database schema teardown completed successfully');
    } catch (error) {
      console.error('Error tearing down financial database schema:', error);
      throw error;
    }
  }

  async isSchemaSetup(): Promise<boolean> {
    try {
      const result = await this.database.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'financial_transactions'
        );
      `);
      return result.rows[0].exists;
    } catch (error) {
      return false;
    }
  }
}