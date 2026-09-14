import { TestDatabase } from '../../helpers/test-database';
import { COPY_PLAN } from '../../../src/modules/beta-import/copy-plan';
import {
  bindScope,
  exportPage,
  fileKeyBelongs,
  writeWorkspaceCopy,
} from '../../../src/modules/beta-import/beta-import.engine';

/**
 * "Import my real books" against two real Postgres databases (PGlite): one
 * standing in for production, one for beta. Only the tables these tests need
 * exist, which also proves the copy tolerates the ones that do not.
 */

const SCHEMA = `
  ALTER TABLE businesses ADD COLUMN owner_id UUID;
  ALTER TABLE businesses ADD COLUMN previous_owner_id UUID;
  CREATE TABLE business_members (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (business_id, user_id)
  );
  CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    UNIQUE (business_id, code)
  );
  CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY, business_id UUID, user_id UUID NOT NULL,
    amount NUMERIC(12,2), metadata JSONB
  );
  CREATE TABLE transaction_receipts (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, data BYTEA NOT NULL
  );
  CREATE TABLE journal_entries (
    id UUID PRIMARY KEY, business_id UUID NOT NULL,
    source_type TEXT, source_id UUID, created_by UUID
  );
  CREATE TABLE journal_lines (
    id UUID PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT
  );
  CREATE TABLE document_folders (
    id UUID PRIMARY KEY, user_id UUID NOT NULL,
    parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE, name TEXT
  );
  CREATE TABLE document_captures (
    id UUID PRIMARY KEY, business_id UUID NOT NULL, captured_by UUID,
    inbound_message_id UUID, storage_key TEXT
  );
`;

const ID = {
  account1: '10000000-0000-4000-8000-000000000001',
  account2: '10000000-0000-4000-8000-000000000002',
  tx1: '20000000-0000-4000-8000-000000000001',
  tx2: '20000000-0000-4000-8000-000000000002',
  otherTx: '20000000-0000-4000-8000-000000000099',
  receipt: '30000000-0000-4000-8000-000000000001',
  manualEntry: '40000000-0000-4000-8000-000000000001',
  bookkeepingEntry: '40000000-0000-4000-8000-000000000002',
  manualLine: '50000000-0000-4000-8000-000000000001',
  bookkeepingLine: '50000000-0000-4000-8000-000000000002',
  // The child's id sorts BEFORE its parent's, so export order puts it first.
  childFolder: '00000000-0000-4000-8000-000000000001',
  parentFolder: 'ffffffff-0000-4000-8000-000000000001',
  capture: '60000000-0000-4000-8000-000000000001',
  inboundMessage: '70000000-0000-4000-8000-000000000001',
};
const RECEIPT_BYTES = Buffer.from([0, 1, 2, 250, 255]);

describe('beta import engine', () => {
  let prod: TestDatabase;
  let beta: TestDatabase;
  let businessId: string;
  let prodOwner: string;
  let betaOwner: string;

  beforeAll(async () => {
    [prod, beta] = await Promise.all([TestDatabase.create(), TestDatabase.create()]);
    await prod.exec(SCHEMA);
    await beta.exec(SCHEMA);
  }, 120_000);

  afterAll(async () => {
    await Promise.all([prod?.close(), beta?.close()]);
  });

  beforeEach(async () => {
    await Promise.all([prod.reset(), beta.reset()]);

    prodOwner = await prod.newUser('owner@real.co');
    businessId = await prod.newBusiness('Acme');
    await prod.query('UPDATE businesses SET owner_id = $1, previous_owner_id = $1 WHERE id = $2', [prodOwner, businessId]);
    const otherBusiness = await prod.newBusiness('Someone Else');

    await prod.query('INSERT INTO accounts (id, business_id, code) VALUES ($1, $2, $3), ($4, $2, $5)',
      [ID.account1, businessId, '1000', ID.account2, '4000']);
    await prod.query(
      'INSERT INTO financial_transactions (id, business_id, user_id, amount, metadata) VALUES ($1, $2, $3, $4, $5)',
      [ID.tx1, businessId, prodOwner, '120.50', JSON.stringify({ groupId: 'g-1', note: 'rent' })]);
    await prod.query(
      'INSERT INTO financial_transactions (id, business_id, user_id, amount) VALUES ($1, $2, $3, $4)',
      [ID.otherTx, otherBusiness, prodOwner, '9.99']);
    await prod.query('INSERT INTO transaction_receipts (id, transaction_id, user_id, data) VALUES ($1, $2, $3, $4)',
      [ID.receipt, ID.tx1, prodOwner, RECEIPT_BYTES]);

    await prod.query(
      `INSERT INTO journal_entries (id, business_id, source_type, source_id, created_by)
       VALUES ($1, $2, 'manual', NULL, $3), ($4, $2, 'bookkeeping', $5, $3)`,
      [ID.manualEntry, businessId, prodOwner, ID.bookkeepingEntry, ID.tx1]);
    await prod.query('INSERT INTO journal_lines (id, entry_id, account_id) VALUES ($1, $2, $3), ($4, $5, $6)',
      [ID.manualLine, ID.manualEntry, ID.account1, ID.bookkeepingLine, ID.bookkeepingEntry, ID.account2]);

    await prod.query('INSERT INTO document_folders (id, user_id, parent_id, name) VALUES ($1, $2, NULL, $3)',
      [ID.parentFolder, prodOwner, 'Receipts']);
    await prod.query('INSERT INTO document_folders (id, user_id, parent_id, name) VALUES ($1, $2, $3, $4)',
      [ID.childFolder, prodOwner, ID.parentFolder, '2026']);

    await prod.query(
      'INSERT INTO document_captures (id, business_id, captured_by, inbound_message_id, storage_key) VALUES ($1, $2, $3, $4, $5)',
      [ID.capture, businessId, prodOwner, ID.inboundMessage, `captures/${businessId}/scan.jpg`]);

    betaOwner = await beta.newUser('owner@real.co');
  });

  /** Export every table page by page, through JSON, exactly as the wire carries it. */
  async function exportAll() {
    const data = new Map<string, Record<string, unknown>[]>();
    for (const spec of COPY_PLAN) {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; ; ) {
        const page = JSON.parse(JSON.stringify(
          await exportPage(prod.asDatabase(), spec, { business: businessId, owner: prodOwner }, offset)
        ));
        rows.push(...page.rows);
        offset += page.rows.length;
        if (page.done || page.rows.length === 0) break;
      }
      data.set(spec.table, rows);
    }
    return data;
  }

  const copy = async (refreshing: boolean) => {
    const data = await exportAll();
    return beta.transaction((tx) => writeWorkspaceCopy(tx, data, businessId, betaOwner, refreshing));
  };

  it('copies the workspace with its original ids, owned by the beta user', async () => {
    await copy(false);

    const biz = await beta.query('SELECT id, name, owner_id, previous_owner_id FROM businesses');
    expect(biz.rows).toEqual([{ id: businessId, name: 'Acme', owner_id: betaOwner, previous_owner_id: null }]);

    const member = await beta.query('SELECT user_id, role FROM business_members WHERE business_id = $1', [businessId]);
    expect(member.rows).toEqual([{ user_id: betaOwner, role: 'Owner' }]);

    const tx = await beta.query('SELECT id, user_id, amount, metadata FROM financial_transactions');
    expect(tx.rows).toHaveLength(1);
    expect(tx.rows[0].id).toBe(ID.tx1);
    expect(tx.rows[0].user_id).toBe(betaOwner);
    expect(Number(tx.rows[0].amount)).toBe(120.5);
    expect(tx.rows[0].metadata).toEqual({ groupId: 'g-1', note: 'rent' });
  });

  it('never copies another workspace', async () => {
    await copy(false);
    const other = await beta.query('SELECT 1 FROM financial_transactions WHERE id = $1', [ID.otherTx]);
    expect(other.rows).toHaveLength(0);
  });

  it('carries receipt bytes intact', async () => {
    await copy(false);
    const receipt = await beta.query('SELECT user_id, data FROM transaction_receipts WHERE id = $1', [ID.receipt]);
    expect(receipt.rows[0].user_id).toBe(betaOwner);
    expect(Buffer.from(receipt.rows[0].data).equals(RECEIPT_BYTES)).toBe(true);
  });

  it('skips bookkeeping entries, which beta rebuilds from transactions', async () => {
    await copy(false);
    const entries = await beta.query('SELECT id, created_by FROM journal_entries ORDER BY id');
    expect(entries.rows).toEqual([{ id: ID.manualEntry, created_by: betaOwner }]);
    const lines = await beta.query('SELECT id FROM journal_lines');
    expect(lines.rows.map((r: any) => r.id)).toEqual([ID.manualLine]);
  });

  it('inserts a folder after its parent, whatever order the export used', async () => {
    await copy(false);
    const folders = await beta.query('SELECT id, user_id FROM document_folders ORDER BY name');
    expect(folders.rows).toEqual([
      { id: ID.childFolder, user_id: betaOwner },
      { id: ID.parentFolder, user_id: betaOwner },
    ]);
  });

  it('blanks the inbound message link and reports the file to copy', async () => {
    const { fileKeys } = await copy(false);
    const capture = await beta.query('SELECT inbound_message_id, captured_by FROM document_captures');
    expect(capture.rows).toEqual([{ inbound_message_id: null, captured_by: betaOwner }]);
    expect([...fileKeys]).toEqual([`captures/${businessId}/scan.jpg`]);
  });

  it('refreshes over an existing copy without duplicates, past the account RESTRICT', async () => {
    await copy(false);

    // Beta has since rebuilt a bookkeeping entry against a copied account — the
    // row that would block deleting accounts if the purge ordering were wrong.
    await beta.query(
      `INSERT INTO journal_entries (id, business_id, source_type, source_id) VALUES ($1, $2, 'bookkeeping', $3)`,
      ['40000000-0000-4000-8000-0000000000aa', businessId, ID.tx1]);
    await beta.query('INSERT INTO journal_lines (id, entry_id, account_id) VALUES ($1, $2, $3)',
      ['50000000-0000-4000-8000-0000000000aa', '40000000-0000-4000-8000-0000000000aa', ID.account2]);

    await prod.query('INSERT INTO financial_transactions (id, business_id, user_id, amount) VALUES ($1, $2, $3, $4)',
      [ID.tx2, businessId, prodOwner, '42.00']);

    await copy(true);

    const tx = await beta.query('SELECT id FROM financial_transactions ORDER BY id');
    expect(tx.rows.map((r: any) => r.id)).toEqual([ID.tx1, ID.tx2]);
    const accounts = await beta.query('SELECT count(*)::int AS n FROM accounts');
    expect(accounts.rows[0].n).toBe(2);
    const folders = await beta.query('SELECT count(*)::int AS n FROM document_folders');
    expect(folders.rows[0].n).toBe(2);
  });

  it('only serves files that belong to the exported workspace', async () => {
    const ids = { business: businessId, owner: prodOwner };
    await expect(fileKeyBelongs(prod.asDatabase(), ids, `captures/${businessId}/scan.jpg`)).resolves.toBe(true);
    await expect(fileKeyBelongs(prod.asDatabase(), ids, 'captures/someone-else/secret.pdf')).resolves.toBe(false);
  });
});

describe('bindScope', () => {
  const ids = { business: 'b-1', owner: 'u-1' };

  it('numbers each name once, in order of use', () => {
    expect(bindScope('business_id = :business AND user_id = :owner OR id = :business', ids)).toEqual({
      text: 'business_id = $1 AND user_id = $2 OR id = $1',
      params: ['b-1', 'u-1'],
    });
  });

  it('sends only the names a scope uses', () => {
    expect(bindScope('user_id = :owner', ids)).toEqual({ text: 'user_id = $1', params: ['u-1'] });
  });

  it('leaves casts alone', () => {
    expect(bindScope('id = ANY(:business::uuid[])', ids).text).toBe('id = ANY($1::uuid[])');
  });
});
