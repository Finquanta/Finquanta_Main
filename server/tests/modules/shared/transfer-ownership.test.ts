import { transferOwnership } from '../../../src/modules/shared/transfer-ownership';
import { Database } from '../../../src/infrastructure/database';

/**
 * Ownership is the one role that cannot be granted by anyone but its holder,
 * and it is stored in two places — `businesses.owner_id` and the `Owner` row in
 * `business_members`. Different parts of the app read different ones, so a
 * transfer that moved only half would leave a workspace with two owners by one
 * reckoning and none by the other.
 */

class FakeDb {
  statements: { text: string; params: any[] }[] = [];
  ownerId: string | null = 'old-owner';
  memberExists = true;
  committed = false;

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = {
      query: async (text: string, params: any[] = []) => {
        const flat = text.replace(/\s+/g, ' ').trim();
        this.statements.push({ text: flat, params });
        if (flat.includes('SELECT owner_id FROM businesses')) {
          return { rows: this.ownerId ? [{ owner_id: this.ownerId }] : [], rowCount: this.ownerId ? 1 : 0 };
        }
        if (flat.includes('SELECT 1 FROM business_members')) {
          return { rows: this.memberExists ? [{ '?column?': 1 }] : [], rowCount: this.memberExists ? 1 : 0 };
        }
        return { rows: [], rowCount: 1 };
      },
    };
    const result = await callback(client);
    this.committed = true;
    return result;
  }

  find(fragment: string) {
    return this.statements.find((s) => s.text.includes(fragment));
  }
}

describe('transferOwnership', () => {
  it('refuses to hand a business to somebody who is not in it', async () => {
    const db = new FakeDb();
    db.memberExists = false;

    await expect(
      transferOwnership(db as unknown as Database, 'biz', 'a-stranger')
    ).rejects.toThrow('not a member');

    // Nothing was written. Accepting an arbitrary user id here would turn this
    // into a way to hand a company's books to someone never invited to them.
    expect(db.find('UPDATE businesses SET owner_id')).toBeUndefined();
    expect(db.committed).toBe(false);
  });

  it('moves both records that carry ownership', async () => {
    const db = new FakeDb();

    await transferOwnership(db as unknown as Database, 'biz', 'new-owner');

    const businesses = db.find('UPDATE businesses SET owner_id');
    expect(businesses?.params).toEqual(['biz', 'new-owner']);

    // The member row matters as much as the column: the team list, the invite
    // guard and "the owner cannot be removed" all read the role, not owner_id.
    const promote = db.statements.find(
      (s) => s.text.includes("SET role = 'Owner'") && s.params.includes('new-owner')
    );
    expect(promote).toBeDefined();
  });

  it('leaves the outgoing owner as an Admin, not as nothing', async () => {
    const db = new FakeDb();

    await transferOwnership(db as unknown as Database, 'biz', 'new-owner');

    // Handing over is not the same as leaving. Someone transferring to a
    // colleague still has to be able to work there tomorrow.
    const demote = db.statements.find(
      (s) => s.text.includes("SET role = 'Admin'") && s.params.includes('old-owner')
    );
    expect(demote).toBeDefined();
    // Guarded on the old role so it can never demote the person just promoted.
    expect(demote?.text).toContain("role = 'Owner'");
  });

  it('does nothing when they already own it', async () => {
    const db = new FakeDb();
    db.ownerId = 'same-person';

    await transferOwnership(db as unknown as Database, 'biz', 'same-person');

    // Without this, the demotion below would strip the owner it just set.
    expect(db.find('UPDATE businesses SET owner_id')).toBeUndefined();
  });

  it('refuses a business that does not exist', async () => {
    const db = new FakeDb();
    db.ownerId = null;

    await expect(
      transferOwnership(db as unknown as Database, 'ghost', 'new-owner')
    ).rejects.toThrow('Business not found');
  });

  it('locks the row it is about to change', async () => {
    const db = new FakeDb();

    await transferOwnership(db as unknown as Database, 'biz', 'new-owner');

    // FOR UPDATE: two transfers racing would otherwise both read the same old
    // owner and the second could demote the first's new owner.
    expect(db.statements[0]?.text).toContain('FOR UPDATE');
  });
});
