import { TestDatabase } from '../../helpers/test-database';
import { ensureHistorySchema } from '../../../src/modules/history/history.schema';
import {
  HistoryError,
  MAX_GO_BACK,
  groupsAfter,
  listHistory,
  undoAfter,
  undoGroup,
} from '../../../src/modules/history/history.service';

/**
 * Books history against a real Postgres (PGlite): what the triggers record,
 * and that undo puts the books back exactly — same ids, same receipt bytes —
 * or refuses when it cannot.
 */

const SCHEMA = `
  -- The helper's users stub has only id and email; history shows who made a change by name.
  ALTER TABLE users ADD COLUMN first_name TEXT;
  ALTER TABLE users ADD COLUMN last_name TEXT;
  CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID,
    user_id UUID,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE transaction_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL UNIQUE REFERENCES financial_transactions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    data BYTEA NOT NULL
  );
  CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    number TEXT NOT NULL,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0
  );
  CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code TEXT NOT NULL
  );
  CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_id UUID
  );
  CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(14,2) NOT NULL DEFAULT 0
  );
`;

describe('books history', () => {
  let db: TestDatabase;
  let businessId: string;
  let userId: string;

  // ensureHistorySchema sends multi-statement scripts; PGlite runs those through exec.
  const schemaDb = () =>
    ({
      query: async (text: string, params?: unknown[]) =>
        params && params.length ? db.query(text, params as any[]) : (await db.exec(text), { rows: [] }),
    }) as any;

  beforeAll(async () => {
    db = await TestDatabase.create();
    await db.exec(SCHEMA);
    await ensureHistorySchema(schemaDb());
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.reset();
    businessId = await db.newBusiness('Acme');
    userId = await db.newUser('owner@acme.co');
  });

  const rows = async () =>
    (await db.query('SELECT table_name, op, before, after, txid::text AS txid, actor_id, undo_of::text AS undo_of, undone_by::text AS undone_by FROM books_history ORDER BY id')).rows;

  const addTransaction = async (amount: string, description = 'Rent') =>
    (await db.query(
      'INSERT INTO financial_transactions (business_id, user_id, description, amount) VALUES ($1, $2, $3, $4) RETURNING id',
      [businessId, userId, description, amount]
    )).rows[0].id as string;

  const txidOf = async (table: string, op: string) =>
    (await db.query(`SELECT txid::text AS txid FROM books_history WHERE table_name = $1 AND op = $2 ORDER BY id DESC LIMIT 1`, [table, op])).rows[0].txid as string;

  const undo = (txid: string, strict = true) =>
    db.transaction((tx) => undoGroup(tx, businessId, txid, userId, strict));

  it('records a new transaction, and an edit with what it was before', async () => {
    const id = await addTransaction('100.00');
    await db.query('UPDATE financial_transactions SET amount = 125 WHERE id = $1', [id]);

    const history = await rows();
    expect(history.map((h: any) => h.op)).toEqual(['I', 'U']);
    expect(Number(history[1].before.amount)).toBe(100);
    expect(Number(history[1].after.amount)).toBe(125);
  });

  it('ignores an update that only touches updated_at', async () => {
    const id = await addTransaction('100.00');
    await db.query('UPDATE financial_transactions SET updated_at = NOW() + interval \'1 minute\' WHERE id = $1', [id]);
    expect((await rows()).map((h: any) => h.op)).toEqual(['I']);
  });

  it('skips bookkeeping entries and their lines, but records hand-made ones', async () => {
    const account = (await db.query('INSERT INTO accounts (business_id, code) VALUES ($1, $2) RETURNING id', [businessId, '1000'])).rows[0].id;
    const bookkeeping = (await db.query(
      `INSERT INTO journal_entries (business_id, description, source_type) VALUES ($1, 'auto', 'bookkeeping') RETURNING id`,
      [businessId]
    )).rows[0].id;
    await db.query('INSERT INTO journal_lines (entry_id, account_id, debit) VALUES ($1, $2, 10)', [bookkeeping, account]);
    expect(await rows()).toEqual([]);

    const manual = (await db.query(
      `INSERT INTO journal_entries (business_id, description, source_type) VALUES ($1, 'accrual', 'manual') RETURNING id`,
      [businessId]
    )).rows[0].id;
    await db.query('INSERT INTO journal_lines (entry_id, account_id, debit) VALUES ($1, $2, 10)', [manual, account]);
    expect((await rows()).map((h: any) => `${h.table_name}:${h.op}`)).toEqual(['journal_entries:I', 'journal_lines:I']);
  });

  it('records who made a change when the connection says', async () => {
    await db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('app.actor_id', $1, true)`, [userId]);
      await tx.query('INSERT INTO financial_transactions (business_id, amount) VALUES ($1, 5)', [businessId]);
    });
    expect((await rows())[0].actor_id).toBe(userId);
  });

  it('records nothing while switched off', async () => {
    await db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('app.history_off', 'on', true)`);
      await tx.query('INSERT INTO financial_transactions (business_id, amount) VALUES ($1, 5)', [businessId]);
    });
    expect(await rows()).toEqual([]);
  });

  it('undoes a deleted transaction with its receipt: same id, same bytes', async () => {
    const id = await addTransaction('80.00');
    const bytes = Buffer.from([0, 1, 2, 254, 255]);
    await db.query('INSERT INTO transaction_receipts (transaction_id, filename, data) VALUES ($1, $2, $3)', [id, 'r.pdf', bytes]);
    await db.query('DELETE FROM financial_transactions WHERE id = $1', [id]);

    const deletion = (await rows()).find((h: any) => h.op === 'D');
    expect(deletion.table_name).toBe('financial_transactions');
    expect(deletion.before.__children.transaction_receipts).toHaveLength(1);
    // The receipt's cascade delete is inside the parent's record, not a row of its own.
    expect((await rows()).filter((h: any) => h.table_name === 'transaction_receipts' && h.op === 'D')).toEqual([]);

    await undo(deletion.txid);

    const back = await db.query('SELECT id, amount FROM financial_transactions');
    expect(back.rows).toEqual([{ id, amount: expect.anything() }]);
    const receipt = await db.query('SELECT data FROM transaction_receipts WHERE transaction_id = $1', [id]);
    expect(Buffer.from(receipt.rows[0].data).equals(bytes)).toBe(true);
  });

  it('undoes an edit, records the undo, and marks the original undone', async () => {
    const id = await addTransaction('100.00');
    await db.query('UPDATE financial_transactions SET amount = 150 WHERE id = $1', [id]);
    const edit = await txidOf('financial_transactions', 'U');

    await undo(edit);

    expect(Number((await db.query('SELECT amount FROM financial_transactions WHERE id = $1', [id])).rows[0].amount)).toBe(100);
    const history = await rows();
    expect(history.find((h: any) => h.txid === edit).undone_by).not.toBeNull();
    expect(history[history.length - 1].undo_of).toBe(edit);
  });

  it('refuses to undo a change that was edited again since', async () => {
    const id = await addTransaction('100.00');
    await db.query('UPDATE financial_transactions SET amount = 150 WHERE id = $1', [id]);
    const firstEdit = await txidOf('financial_transactions', 'U');
    await db.query('UPDATE financial_transactions SET amount = 175 WHERE id = $1', [id]);

    await expect(undo(firstEdit)).rejects.toMatchObject({ reason: 'changed_since' });
    expect(Number((await db.query('SELECT amount FROM financial_transactions WHERE id = $1', [id])).rows[0].amount)).toBe(175);
  });

  it('refuses to undo the same change twice', async () => {
    const id = await addTransaction('100.00');
    await db.query('UPDATE financial_transactions SET amount = 150 WHERE id = $1', [id]);
    const edit = await txidOf('financial_transactions', 'U');
    await undo(edit);
    await expect(undo(edit)).rejects.toBeInstanceOf(HistoryError);
  });

  it('undoing an undo puts the change back', async () => {
    const id = await addTransaction('100.00');
    await db.query('UPDATE financial_transactions SET amount = 150 WHERE id = $1', [id]);
    const edit = await txidOf('financial_transactions', 'U');
    await undo(edit);
    const theUndo = (await rows()).find((h: any) => h.undo_of === edit).txid;

    await undo(theUndo);

    expect(Number((await db.query('SELECT amount FROM financial_transactions WHERE id = $1', [id])).rows[0].amount)).toBe(150);
    expect((await rows()).find((h: any) => h.txid === edit).undone_by).toBeNull();
  });

  it('undoes a deleted customer together with the invoice it was taken off', async () => {
    const customer = (await db.query('INSERT INTO customers (business_id, name) VALUES ($1, $2) RETURNING id', [businessId, 'Globex'])).rows[0].id;
    const invoice = (await db.query(
      'INSERT INTO invoices (business_id, customer_id, number, total) VALUES ($1, $2, $3, $4) RETURNING id',
      [businessId, customer, 'INV-0001', 500]
    )).rows[0].id;
    await db.query('INSERT INTO invoice_items (invoice_id, name, amount) VALUES ($1, $2, $3)', [invoice, 'Work', 500]);

    await db.query('DELETE FROM customers WHERE id = $1', [customer]);
    const deletion = await txidOf('customers', 'D');
    expect((await db.query('SELECT customer_id FROM invoices WHERE id = $1', [invoice])).rows[0].customer_id).toBeNull();

    await undo(deletion);

    expect((await db.query('SELECT name FROM customers WHERE id = $1', [customer])).rows[0].name).toBe('Globex');
    expect((await db.query('SELECT customer_id FROM invoices WHERE id = $1', [invoice])).rows[0].customer_id).toBe(customer);
  });

  it('undoes a deleted invoice with its items', async () => {
    const invoice = (await db.query('INSERT INTO invoices (business_id, number) VALUES ($1, $2) RETURNING id', [businessId, 'INV-0002'])).rows[0].id;
    await db.query('INSERT INTO invoice_items (invoice_id, name, amount) VALUES ($1, $2, 10), ($1, $3, 20)', [invoice, 'A', 'B']);
    await db.query('DELETE FROM invoices WHERE id = $1', [invoice]);

    await undo(await txidOf('invoices', 'D'));

    const items = await db.query('SELECT name FROM invoice_items WHERE invoice_id = $1 ORDER BY name', [invoice]);
    expect(items.rows.map((r: any) => r.name)).toEqual(['A', 'B']);
  });

  it('goes back to a date: later changes undone, earlier ones kept', async () => {
    const early = await addTransaction('10.00', 'early');
    await db.query(`UPDATE books_history SET created_at = NOW() - interval '2 hours'`);
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const late = await addTransaction('20.00', 'late');
    await db.query('UPDATE financial_transactions SET amount = 11 WHERE id = $1', [early]);

    const preview = await groupsAfter(db, businessId, { date: cutoff });
    expect(preview).toHaveLength(2);

    const undone = await db.transaction((tx) => undoAfter(tx, businessId, { date: cutoff }, userId));
    expect(undone).toBe(2);

    const left = await db.query('SELECT id, amount FROM financial_transactions ORDER BY description');
    expect(left.rows.map((r: any) => r.id)).toEqual([early]);
    expect(Number(left.rows[0].amount)).toBe(10);
    expect(late).toBeTruthy();
  });

  it('lists changes newest first, a page at a time', async () => {
    for (let i = 0; i < 3; i++) await addTransaction(`${i + 1}.00`, `t${i}`);
    const first = await listHistory(db, businessId, { limit: 2 });
    expect(first.groups).toHaveLength(2);
    expect(first.groups[0]!.changes[0]!.after?.description).toBe('t2');
    const second = await listHistory(db, businessId, { limit: 2, cursor: first.nextCursor });
    expect(second.groups).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('never sends receipt file bytes to the browser', async () => {
    const id = await addTransaction('5.00');
    await db.query('INSERT INTO transaction_receipts (transaction_id, filename, data) VALUES ($1, $2, $3)', [id, 'r.pdf', Buffer.from([1, 2, 3])]);
    const { groups } = await listHistory(db, businessId);
    const receipt = groups.flatMap((g) => g.changes).find((c) => c.table === 'transaction_receipts');
    expect(receipt?.after).not.toHaveProperty('data');
  });

  it('never sends the bytes of a receipt deleted along with its transaction', async () => {
    const id = await addTransaction('5.00');
    await db.query('INSERT INTO transaction_receipts (transaction_id, filename, data) VALUES ($1, $2, $3)', [id, 'r.pdf', Buffer.from([1, 2, 3])]);
    await db.query('DELETE FROM financial_transactions WHERE id = $1', [id]);

    const { groups } = await listHistory(db, businessId);
    const deletion = groups.flatMap((g) => g.changes).find((c) => c.op === 'D')!;
    const receipts = (deletion.before!.__children as any).transaction_receipts;
    expect(receipts).toHaveLength(1);
    expect(receipts[0].filename).toBe('r.pdf');
    expect(receipts[0]).not.toHaveProperty('data');
  });

  it('undoing a go back puts every change it undid back, not just one', async () => {
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await addTransaction(`${i + 1}.00`, `t${i}`));
    const firstAdd = (await rows())[0].txid;

    expect(await db.transaction((tx) => undoAfter(tx, businessId, { txid: firstAdd }, userId))).toBe(3);
    const goBack = (await rows()).find((h: any) => h.undo_of !== null).txid;

    await undo(goBack);

    expect((await db.query('SELECT id FROM financial_transactions')).rows).toHaveLength(3);
    const adds = (await rows()).filter((h: any) => h.op === 'I' && h.undo_of === null);
    expect(adds).toHaveLength(3);
    expect(adds.map((h: any) => h.undone_by)).toEqual([null, null, null]);
    // Each is an ordinary change again, so it can be undone on its own.
    await undo(adds[0].txid);
    expect((await db.query('SELECT id FROM financial_transactions')).rows).toHaveLength(2);
    expect(ids).toHaveLength(3);
  });

  it('refuses to go back past more than MAX_GO_BACK changes', async () => {
    for (let i = 0; i <= MAX_GO_BACK; i++) await addTransaction('1.00', `t${i}`);
    const firstAdd = (await rows())[0].txid;

    await expect(groupsAfter(db, businessId, { txid: firstAdd })).rejects.toMatchObject({ reason: 'too_many' });
    await expect(db.transaction((tx) => undoAfter(tx, businessId, { txid: firstAdd }, userId))).rejects.toMatchObject({ reason: 'too_many' });
    expect((await db.query('SELECT id FROM financial_transactions')).rows).toHaveLength(MAX_GO_BACK + 1);

    // Exactly the limit is still allowed.
    const second = (await rows())[1].txid;
    expect(await groupsAfter(db, businessId, { txid: second })).toHaveLength(MAX_GO_BACK);
  });
});
