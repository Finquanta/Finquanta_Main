import { TestDatabase } from '../../helpers/test-database';
import { ensureBetaImportSchema } from '../../../src/modules/beta-import/beta-import.routes';
import {
  betaState,
  createLoginCode,
  setBetaEnabled,
  setBetaTesters,
  startBetaCopy,
} from '../../../src/modules/beta-import/beta-sync';

/**
 * The production side of beta workspaces: turning beta on starts exactly one
 * copy and records how it went, and only people with a beta workspace (or
 * staff) get an "Open in beta" link.
 */

const SCHEMA = `
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  ALTER TABLE businesses ADD COLUMN owner_id UUID;
  ALTER TABLE businesses ADD COLUMN beta_enabled BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE businesses ADD COLUMN beta_updated_at TIMESTAMPTZ;
  ALTER TABLE businesses ADD COLUMN beta_updated_by UUID;
  ALTER TABLE businesses ADD COLUMN beta_copy_status VARCHAR(20) NOT NULL DEFAULT 'none';
  ALTER TABLE businesses ADD COLUMN beta_copy_started_at TIMESTAMPTZ;
  ALTER TABLE businesses ADD COLUMN beta_copied_at TIMESTAMPTZ;
  ALTER TABLE businesses ADD COLUMN beta_copy_error TEXT;
  CREATE TABLE business_members (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    beta_tester BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (business_id, user_id)
  );
`;

const log = { info: jest.fn(), warn: jest.fn() };
const SECRET = 'x'.repeat(40);

async function until(check: () => Promise<boolean>, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('condition not met in time');
}

describe('beta sync (production side)', () => {
  let db: TestDatabase;
  let owner: string;
  let tester: string;
  let member: string;
  let businessId: string;
  const saved = { ...process.env };
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    db = await TestDatabase.create();
    await db.exec(SCHEMA);
    await ensureBetaImportSchema(db.asDatabase());
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.reset();
    process.env = {
      ...saved,
      BETA_SITE_URL: 'https://beta.finquanta.ai',
      BETA_API_URL: 'https://beta-api.example/api',
      BETA_SYNC_SECRET: SECRET,
    };
    delete process.env.BETA_SITE;
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) });
    (global as any).fetch = fetchMock;
    log.info.mockClear();
    log.warn.mockClear();

    owner = await db.newUser('owner@real.co');
    tester = await db.newUser('tester@real.co');
    member = await db.newUser('member@real.co');
    businessId = await db.newBusiness('Acme');
    await db.query('UPDATE businesses SET owner_id = $1 WHERE id = $2', [owner, businessId]);
    await db.query(
      `INSERT INTO business_members (business_id, user_id, role) VALUES ($1, $2, 'Owner'), ($1, $3, 'Admin'), ($1, $4, 'Viewer')`,
      [businessId, owner, tester, member]
    );
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  const db_ = () => db.asDatabase();

  it('does nothing until the beta site is connected', async () => {
    delete process.env.BETA_SYNC_SECRET;
    await setBetaEnabled(db_(), businessId, true, owner);
    await expect(startBetaCopy(db_(), businessId, log)).resolves.toEqual({ started: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await betaState(db_(), businessId)).configured).toBe(false);
  });

  it('will not copy a workspace that is not beta', async () => {
    await expect(startBetaCopy(db_(), businessId, log)).resolves.toEqual({ started: false, reason: 'not_beta' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts a copy, asks beta to pull it, and records that it finished', async () => {
    await setBetaTesters(db_(), businessId, [tester]);
    await setBetaEnabled(db_(), businessId, true, owner);

    await expect(startBetaCopy(db_(), businessId, log)).resolves.toEqual({ started: true });
    await until(async () => (await betaState(db_(), businessId)).copyStatus === 'done');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://beta-api.example/api/v1/beta-sync/pull');
    expect(init.headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(typeof JSON.parse(init.body).code).toBe('string');

    const code = await db.query('SELECT owner_id, member_ids FROM beta_export_codes');
    expect(code.rows).toHaveLength(1);
    expect(code.rows[0].owner_id).toBe(owner);
    expect(code.rows[0].member_ids).toEqual([tester]);

    const state = await betaState(db_(), businessId);
    expect(state.enabled).toBe(true);
    expect(state.copiedAt).not.toBeNull();
  });

  it('starts only one copy when asked twice at once', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined)); // beta never answers
    await setBetaEnabled(db_(), businessId, true, owner);

    const [first, second] = await Promise.all([
      startBetaCopy(db_(), businessId, log),
      startBetaCopy(db_(), businessId, log),
    ]);
    expect([first, second]).toContainEqual({ started: true });
    expect([first, second]).toContainEqual({ started: false, reason: 'busy' });
  });

  it('records a failed copy with the reason', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'Could not reach the real site.' }) });
    await setBetaEnabled(db_(), businessId, true, owner);

    await startBetaCopy(db_(), businessId, log);
    await until(async () => (await betaState(db_(), businessId)).copyStatus === 'failed');
    expect((await betaState(db_(), businessId)).copyError).toBe('Could not reach the real site.');
  });

  it('marks exactly the ticked members as testers, never the owner', async () => {
    await setBetaTesters(db_(), businessId, [tester, owner]);
    const rows = await db.query('SELECT user_id, beta_tester FROM business_members ORDER BY role');
    const flags = Object.fromEntries(rows.rows.map((r: any) => [r.user_id, r.beta_tester]));
    expect(flags[tester]).toBe(true);
    expect(flags[member]).toBe(false);
    expect(flags[owner]).toBe(false);
  });

  describe('Open in beta links', () => {
    it('are refused to someone with no beta workspace', async () => {
      await setBetaEnabled(db_(), businessId, true, owner);
      await expect(createLoginCode(db_(), member, businessId)).resolves.toEqual({ error: 'not_allowed' });
    });

    it('are given to the owner of a beta workspace, pointing at beta', async () => {
      await setBetaEnabled(db_(), businessId, true, owner);
      const result = await createLoginCode(db_(), owner, businessId);
      expect('url' in result).toBe(true);
      const url = new URL((result as { url: string }).url);
      expect(url.origin + url.pathname).toBe('https://beta.finquanta.ai/sso');
      expect(url.searchParams.get('workspace')).toBe(businessId);
      expect(url.searchParams.get('code')).toBeTruthy();
    });

    it('are given to a ticked tester', async () => {
      await setBetaEnabled(db_(), businessId, true, owner);
      await setBetaTesters(db_(), businessId, [tester]);
      await expect(createLoginCode(db_(), tester, null)).resolves.toHaveProperty('url');
    });

    it('are given to staff, who may have no workspace of their own', async () => {
      const staff = await db.newUser('staff@finquanta.ai');
      await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [staff]);
      await expect(createLoginCode(db_(), staff, null)).resolves.toHaveProperty('url');
    });

    it('are not given while the workspace is out of beta', async () => {
      await expect(createLoginCode(db_(), owner, businessId)).resolves.toEqual({ error: 'not_allowed' });
    });
  });
});
