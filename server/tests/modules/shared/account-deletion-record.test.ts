import { Database } from '../../../src/infrastructure/database';
import { deleteUserAccount } from '../../../src/modules/shared/delete-user-account';

/**
 * The permanent record of a closed account.
 *
 * A deleted user leaves nothing behind — `users` is gone and everything
 * cascades off it — so the only way to answer "whose account was that?" later
 * is to copy the details out BEFORE the delete and store them somewhere with no
 * foreign key back. These tests pin the two properties that make that work:
 * the copy is read while the row still exists, and it is written on the same
 * transaction client as the delete.
 */

class FakeDb extends Database {
  readonly statements: { text: string; params: any[] }[] = [];
  usersDeleted = 1;
  /** Set false to simulate deleting an id that is not there. */
  userExists = true;

  override async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = {
      query: async (text: string, params: any[] = []) => {
        const flat = text.replace(/\s+/g, ' ').trim();
        this.statements.push({ text: flat, params });

        if (flat.startsWith('SELECT email, first_name, last_name FROM users')) {
          return this.userExists
            ? { rows: [{ email: 'gone@example.com', first_name: 'Ada', last_name: 'Lovelace' }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        if (flat.startsWith('SELECT id FROM businesses')) {
          return { rows: [{ id: 'biz-1' }, { id: 'biz-2' }], rowCount: 2 };
        }
        if (flat.startsWith('DELETE FROM users')) {
          return { rows: [], rowCount: this.userExists ? this.usersDeleted : 0 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return callback(client);
  }

  override async query(): Promise<any> {
    // Billing settlement runs on the pool after commit; it must not throw here.
    return { rows: [], rowCount: 0 };
  }

  get insert() {
    return this.statements.find((s) => s.text.includes('INSERT INTO account_deletions'));
  }
}

describe('account deletion record', () => {
  it('records who the account was, on the same transaction client', async () => {
    const db = new FakeDb();

    await deleteUserAccount(db, 'user-1', { source: 'self' });

    const ins = db.insert;
    expect(ins).toBeDefined();
    // user_id, email, name, source, actor_id, actor_email, workspaces_destroyed
    expect(ins?.params[0]).toBe('user-1');
    expect(ins?.params[1]).toBe('gone@example.com');
    expect(ins?.params[2]).toBe('Ada Lovelace');
    expect(ins?.params[3]).toBe('self');
  });

  it('reads the identity BEFORE the row is deleted', async () => {
    const db = new FakeDb();

    await deleteUserAccount(db, 'user-1', { source: 'self' });

    const read = db.statements.findIndex((s) =>
      s.text.startsWith('SELECT email, first_name, last_name FROM users'));
    const del = db.statements.findIndex((s) => s.text.startsWith('DELETE FROM users'));
    expect(read).toBeGreaterThanOrEqual(0);
    expect(del).toBeGreaterThanOrEqual(0);
    // One statement later and the cascade has already erased the only copy.
    expect(read).toBeLessThan(del);
  });

  it('distinguishes an admin removal from someone closing their own account', async () => {
    const db = new FakeDb();

    await deleteUserAccount(db, 'user-9', {
      source: 'admin', actorId: 'admin-1', actorEmail: 'boss@example.com',
    });

    expect(db.insert?.params[3]).toBe('admin');
    expect(db.insert?.params[4]).toBe('admin-1');
    expect(db.insert?.params[5]).toBe('boss@example.com');
  });

  it('counts the workspaces destroyed with the account', async () => {
    const db = new FakeDb();

    await deleteUserAccount(db, 'user-1', { source: 'self' });

    // Both owned businesses die with the owner; the number is what makes the
    // consequence legible afterwards.
    expect(db.insert?.params[6]).toBe(2);
  });

  it('writes nothing when no user was actually deleted', async () => {
    const db = new FakeDb();
    db.userExists = false;

    const deleted = await deleteUserAccount(db, 'ghost', { source: 'self' });

    expect(deleted).toBe(false);
    // A record of a deletion that did not happen is worse than no record.
    expect(db.insert).toBeUndefined();
  });

  it('defaults to a self-serve deletion when no actor is given', async () => {
    const db = new FakeDb();

    await deleteUserAccount(db, 'user-1');

    expect(db.insert?.params[3]).toBe('self');
  });
});
