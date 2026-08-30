import { FxRepository, SUPPORTED_CURRENCIES } from '../../../src/modules/fx/fx.repository';
import { Database } from '../../../src/infrastructure/database';

/**
 * Currency conversion — the one place in the money path that depends on a
 * third party.
 *
 * The books are kept in USD, and a foreign-currency entry is converted at the
 * rate ON ITS OWN DATE. That rate is fetched once from Frankfurter and cached
 * forever, because a historical rate cannot change. Two properties matter and
 * neither was covered:
 *
 *  - a cached rate must never trigger a second fetch, or every page view costs
 *    a network round trip in the middle of recording money;
 *  - a failed lookup must THROW rather than fall back to some other rate. A
 *    wrong rate is a wrong number in someone's accounts that nothing will ever
 *    flag. Refusing to record is the safe failure, and it is deliberate.
 *
 * No fake Postgres here: a recording stub stands in for the database, so what
 * is asserted is this module's own behaviour rather than a hand-written SQL
 * interpreter agreeing with itself.
 */

/**
 * Duck-typed rather than `extends Database` on purpose: the Database
 * constructor builds a real pg Pool (with a 30s idle timeout) before anything
 * can override it, so a subclass-per-test leaves pools open, keeps jest workers
 * alive and turns a 12-second suite into a three-minute one. The repositories
 * only ever call `.query()`.
 */
class StubDatabase {
  calls: { text: string; params?: any[] }[] = [];
  /** Rows returned to the next SELECT; empty means a cache miss. */
  nextRows: any[] = [];

  async query(text: string, params?: any[]): Promise<any> {
    this.calls.push({ text, params });
    if (/^\s*SELECT/i.test(text)) {
      const rows = this.nextRows;
      this.nextRows = [];
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  /** The repository's constructor wants a Database; this is the shape it uses. */
  asDatabase() { return this as unknown as Database; }

  selects() { return this.calls.filter((c) => /^\s*SELECT/i.test(c.text)); }
  inserts() { return this.calls.filter((c) => /INSERT/i.test(c.text)); }

  /** The first of each, asserted present so a miss reads as a clear failure. */
  firstSelect() {
    const c = this.selects()[0];
    if (!c) throw new Error('expected a SELECT, but none was issued');
    return c;
  }
  firstInsert() {
    const c = this.inserts()[0];
    if (!c) throw new Error('expected an INSERT, but none was issued');
    return c;
  }
}

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('FxRepository.getRate', () => {
  let db: StubDatabase;
  let repo: FxRepository;
  const realFetch = global.fetch;

  beforeEach(() => {
    db = new StubDatabase();
    repo = new FxRepository(db.asDatabase());
  });

  afterEach(() => { global.fetch = realFetch; });

  describe('the same currency', () => {
    it('is 1, without a query or a fetch', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as any;

      const result = await repo.getRate('USD', 'USD', '2026-03-01');

      expect(result).toEqual({ rate: 1, effectiveDate: '2026-03-01' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(db.calls).toHaveLength(0);
    });

    it('ignores case', async () => {
      global.fetch = jest.fn() as any;
      await expect(repo.getRate('usd', 'USD', '2026-03-01')).resolves.toEqual({
        rate: 1, effectiveDate: '2026-03-01',
      });
    });
  });

  describe('a cached rate', () => {
    it('is returned without touching the network', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as any;
      db.nextRows = [{ rate: '0.92', rate_date: new Date('2026-03-02T00:00:00Z') }];

      const result = await repo.getRate('USD', 'EUR', '2026-03-02');

      expect(result.rate).toBe(0.92);
      expect(result.effectiveDate).toBe('2026-03-02');
      expect(fetchSpy).not.toHaveBeenCalled();
      // A read, and no write: a cache hit must not re-insert.
      expect(db.selects()).toHaveLength(1);
      expect(db.inserts()).toHaveLength(0);
    });

    it('is looked up by date and both currencies', async () => {
      global.fetch = jest.fn() as any;
      db.nextRows = [{ rate: '0.92', rate_date: new Date('2026-03-02T00:00:00Z') }];

      await repo.getRate('usd', 'eur', '2026-03-02');

      // Upper-cased, and passed as parameters rather than interpolated.
      expect(db.firstSelect().params).toEqual(['2026-03-02', 'USD', 'EUR']);
    });
  });

  describe('a cache miss', () => {
    it('fetches the rate and caches it under BOTH dates', async () => {
      // A weekend has no ECB rate, so Frankfurter answers with the Friday.
      global.fetch = jest.fn(async () => okResponse({ date: '2026-02-27', rates: { EUR: 0.9134 } })) as any;

      const result = await repo.getRate('USD', 'EUR', '2026-03-01');

      expect(result).toEqual({ rate: 0.9134, effectiveDate: '2026-02-27' });

      const insert = db.firstInsert();
      // The date asked for AND the date the rate belongs to, so the next
      // weekend lookup is a hit instead of another round trip.
      expect(insert.params).toEqual(['2026-03-01', 'USD', 'EUR', 0.9134, '2026-02-27']);
      expect(insert.text).toMatch(/ON CONFLICT DO NOTHING/i);
    });

    it('asks Frankfurter for the transaction date, not today', async () => {
      const urls: string[] = [];
      global.fetch = (async (url: string) => {
        urls.push(String(url));
        return okResponse({ date: '2024-01-15', rates: { EUR: 0.9 } });
      }) as any;

      await repo.getRate('USD', 'EUR', '2024-01-15');

      expect(urls[0]).toContain('/2024-01-15?');
      expect(urls[0]).toContain('from=USD');
      expect(urls[0]).toContain('to=EUR');
    });

    it('uses "latest" for a future date, which has no published rate', async () => {
      const urls: string[] = [];
      global.fetch = (async (url: string) => {
        urls.push(String(url));
        return okResponse({ date: '2026-08-30', rates: { EUR: 0.9 } });
      }) as any;

      const future = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
      await repo.getRate('USD', 'EUR', future);

      expect(urls[0]).toContain('/latest?');
    });
  });

  describe('refuses to guess', () => {
    it('throws when the lookup fails', async () => {
      global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as any;

      await expect(repo.getRate('USD', 'EUR', '2026-03-01')).rejects.toThrow(/503/);
      // Nothing cached, so a later attempt retries rather than reusing a dud.
      expect(db.inserts()).toHaveLength(0);
    });

    it('throws when the response has no rate for the currency', async () => {
      global.fetch = jest.fn(async () => okResponse({ date: '2026-03-01', rates: {} })) as any;

      await expect(repo.getRate('USD', 'EUR', '2026-03-01')).rejects.toThrow(/No exchange rate/i);
      expect(db.inserts()).toHaveLength(0);
    });

    it.each([0, -1, 'nonsense', null])('throws on a nonsense rate (%p)', async (rate) => {
      global.fetch = jest.fn(async () => okResponse({ date: '2026-03-01', rates: { EUR: rate } })) as any;
      await expect(repo.getRate('USD', 'EUR', '2026-03-01')).rejects.toThrow(/No exchange rate/i);
    });
  });

  describe('supported currencies', () => {
    it('includes the base currency the books are kept in', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
    });
  });
});
