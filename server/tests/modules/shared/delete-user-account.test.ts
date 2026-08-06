import { Database } from '../../../src/infrastructure/database';
import { deleteUserAccount } from '../../../src/modules/shared/delete-user-account';

/**
 * Records every statement the teardown issues, in order, and fails loudly if
 * any of them escapes the transaction. The bug this guards against was a delete
 * that ran outside the required ordering, so ordering is the assertion.
 */
class RecordingDatabase extends Database {
  readonly statements: string[] = [];
  usersDeleted = 1;
  committed = false;

  override async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = {
      query: async (text: string, _params?: any[]) => {
        this.statements.push(text.replace(/\s+/g, ' ').trim());
        return { rows: [], rowCount: /FROM users/.test(text) ? this.usersDeleted : 0 };
      },
    };
    const result = await callback(client);
    this.committed = true;
    return result;
  }

  override async query(): Promise<any> {
    throw new Error('every statement must run on the transaction client, not the pool');
  }
}

describe('deleteUserAccount', () => {
  const indexOfDelete = (statements: string[], table: string) =>
    statements.findIndex((s) => s.includes(`DELETE FROM ${table}`));

  it('deletes journal entries before the user', async () => {
    // accounts cascades from businesses, but journal_lines.account_id is ON
    // DELETE RESTRICT. Clearing the entries first is what stops Postgres
    // aborting the whole delete with a foreign key violation.
    const database = new RecordingDatabase();

    await deleteUserAccount(database, 'user-1');

    const entries = indexOfDelete(database.statements, 'journal_entries');
    const users = indexOfDelete(database.statements, 'users');
    expect(entries).toBeGreaterThanOrEqual(0);
    expect(users).toBeGreaterThanOrEqual(0);
    expect(entries).toBeLessThan(users);
  });

  it('scopes the ledger teardown to businesses the user owns', async () => {
    const database = new RecordingDatabase();

    await deleteUserAccount(database, 'user-1');

    expect(database.statements[indexOfDelete(database.statements, 'journal_entries')]).toContain(
      'SELECT id FROM businesses WHERE owner_id = $1'
    );
  });

  it('runs the whole teardown in one transaction', async () => {
    const database = new RecordingDatabase();

    await deleteUserAccount(database, 'user-1');

    // A partial commit would leave a business with its ledger gone but the
    // account still standing.
    expect(database.committed).toBe(true);
  });

  it('reports whether a user row was actually removed', async () => {
    const present = new RecordingDatabase();
    await expect(deleteUserAccount(present, 'user-1')).resolves.toBe(true);

    const missing = new RecordingDatabase();
    missing.usersDeleted = 0;
    await expect(deleteUserAccount(missing, 'ghost')).resolves.toBe(false);
  });
});
