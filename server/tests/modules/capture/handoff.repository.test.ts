import crypto from 'crypto';
import { HANDOFF_TTL_MINUTES, HandoffRepository } from '../../../src/modules/capture/capture.handoff.repository';
import { Database } from '../../../src/infrastructure/database';

jest.mock('../../../src/infrastructure/database');

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * QR handoff sessions.
 *
 * The token minted here is the ONLY credential a logged-out phone presents, so
 * these tests are about the properties that keep it narrow rather than about
 * the happy path. Each one below corresponds to a way the feature would be
 * unsafe if the SQL were written slightly differently.
 */
describe('HandoffRepository', () => {
  let database: jest.Mocked<Database>;
  let query: jest.Mock;
  let repo: HandoffRepository;

  const BUSINESS = '11111111-1111-1111-1111-111111111111';
  const USER = '22222222-2222-2222-2222-222222222222';
  const SESSION = '33333333-3333-3333-3333-333333333333';

  const row = (over: Record<string, unknown> = {}) => ({
    id: SESSION,
    business_id: BUSINESS,
    user_id: USER,
    capture_id: null,
    status: 'waiting',
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    database = new Database() as jest.Mocked<Database>;
    query = jest.fn();
    database.query = query;
    repo = new HandoffRepository(database);
  });

  describe('create', () => {
    it('returns the raw token but stores only its SHA-256 hash', async () => {
      query.mockResolvedValue({ rows: [row()] });

      const { token } = await repo.create(BUSINESS, USER);
      const [, params] = query.mock.calls[0];

      expect(token).toBeTruthy();
      // The raw token must not appear in ANY parameter. A database dump has to
      // be worthless for impersonating a phone.
      expect(params).not.toContain(token);
      expect(params[0]).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    });

    it('scopes the session to the workspace and the user who asked for it', async () => {
      query.mockResolvedValue({ rows: [row()] });

      await repo.create(BUSINESS, USER);
      const [, params] = query.mock.calls[0];

      expect(params[1]).toBe(BUSINESS);
      expect(params[2]).toBe(USER);
    });

    it('sets the expiry from HANDOFF_TTL_MINUTES, computed by the database', async () => {
      query.mockResolvedValue({ rows: [row()] });

      await repo.create(BUSINESS, USER);
      const [sql, params] = query.mock.calls[0];

      expect(params[3]).toBe(String(HANDOFF_TTL_MINUTES));
      // NOW() + interval, not a timestamp built in Node: the database owns the
      // clock, so a server whose time has drifted cannot mint a long-lived one.
      expect(sql).toContain('NOW()');
      expect(sql).toContain('minutes');
    });

    it('mints a different token every time', async () => {
      query.mockResolvedValue({ rows: [row()] });

      const a = await repo.create(BUSINESS, USER);
      const b = await repo.create(BUSINESS, USER);

      expect(a.token).not.toBe(b.token);
      // 32 random bytes, base64url — long enough that guessing one inside a
      // five-minute window is not a thing that happens.
      expect(a.token.length).toBeGreaterThanOrEqual(43);
    });
  });

  describe('findByToken', () => {
    it('looks up by hash and lets the database reject an expired session', async () => {
      query.mockResolvedValue({ rows: [row()] });

      const token = 'a-token-from-a-qr-code';
      await repo.findByToken(token);
      const [sql, params] = query.mock.calls[0];

      expect(params[0]).toBe(crypto.createHash('sha256').update(token).digest('hex'));
      // Expiry enforced in SQL rather than compared in JS afterwards.
      expect(sql).toContain('expires_at > NOW()');
    });

    it('returns null when nothing matches', async () => {
      query.mockResolvedValue({ rows: [] });
      await expect(repo.findByToken('expired-or-wrong')).resolves.toBeNull();
    });

    it('maps the row onto the session shape', async () => {
      query.mockResolvedValue({ rows: [row({ status: 'uploaded', capture_id: 'cap-1' })] });

      const session = await repo.findByToken('t');

      expect(session).toMatchObject({
        id: SESSION,
        businessId: BUSINESS,
        userId: USER,
        captureId: 'cap-1',
        status: 'uploaded',
      });
    });
  });

  describe('findForOwner', () => {
    it('requires the workspace AND the user, not just the session id', async () => {
      query.mockResolvedValue({ rows: [row()] });

      await repo.findForOwner(SESSION, BUSINESS, USER);
      const [, params] = query.mock.calls[0];

      expect(params).toEqual([SESSION, BUSINESS, USER]);
    });

    it('returns null for a session belonging to somebody else', async () => {
      query.mockResolvedValue({ rows: [] });
      await expect(repo.findForOwner(SESSION, BUSINESS, 'someone-else')).resolves.toBeNull();
    });
  });

  describe('attachCapture — the single-use guarantee', () => {
    it('only claims a session that is still waiting and still alive', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      await repo.attachCapture(SESSION, 'cap-1');
      const [sql] = query.mock.calls[0];

      // Both conditions live in the UPDATE itself. A check-then-write in the
      // route would let two phones race through the gap between them.
      expect(sql).toContain("status = 'waiting'");
      expect(sql).toContain('expires_at > NOW()');
    });

    it('reports success when a row was updated', async () => {
      query.mockResolvedValue({ rowCount: 1 });
      await expect(repo.attachCapture(SESSION, 'cap-1')).resolves.toBe(true);
    });

    it('reports failure when the token was already spent', async () => {
      // The loser of a two-phone race: the UPDATE matches nothing.
      query.mockResolvedValue({ rowCount: 0 });
      await expect(repo.attachCapture(SESSION, 'cap-2')).resolves.toBe(false);
    });

    it('treats a missing rowCount as failure rather than success', async () => {
      query.mockResolvedValue({});
      await expect(repo.attachCapture(SESSION, 'cap-1')).resolves.toBe(false);
    });
  });

  describe('expireNow', () => {
    it('kills the token immediately, scoped to its owner', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      await repo.expireNow(SESSION, BUSINESS, USER);
      const [sql, params] = query.mock.calls[0];

      expect(sql).toContain('expires_at = NOW()');
      expect(params).toEqual([SESSION, BUSINESS, USER]);
    });
  });

  describe('markConsumed', () => {
    it('closes the session so a stale poll cannot re-deliver the document', async () => {
      query.mockResolvedValue({ rowCount: 1 });

      await repo.markConsumed(SESSION);
      const [sql, params] = query.mock.calls[0];

      expect(sql).toContain("status = 'consumed'");
      expect(params).toEqual([SESSION]);
    });
  });

  describe('purgeExpired', () => {
    it('leaves an hour of grace so a dead session can be reported as expired', async () => {
      query.mockResolvedValue({ rowCount: 3 });

      await repo.purgeExpired();
      const [sql] = query.mock.calls[0];

      expect(sql).toContain('DELETE');
      expect(sql).toContain("INTERVAL '1 hour'");
    });
  });
});
