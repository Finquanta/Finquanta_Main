import { syncSeats } from '../../../src/modules/billing/seats';
import { Database } from '../../../src/infrastructure/database';

/**
 * syncSeats runs inside "accept invite" and "remove member", so the property
 * that matters most is not what it bills — it is that it CANNOT break those.
 * Somebody must never be locked out of a workspace they were invited to
 * because Stripe was slow, or because this machine has no keys.
 */

class FakeDb {
  constructor(private subscriptionId: string | null, private members = 3) {}
  queries: string[] = [];

  async query(text: string, _params: any[] = []): Promise<any> {
    this.queries.push(text);
    if (text.includes('FROM business_members')) return { rows: [{ n: this.members }] };
    if (text.includes('INSERT INTO business_subscriptions')) return { rows: [], rowCount: 1 };
    if (text.includes('FROM business_subscriptions')) {
      return {
        rows: [{
          business_id: 'biz', plan: 'business', status: 'active',
          trial_started_at: null, trial_ends_at: null, grandfathered_until: null,
          stripe_customer_id: 'cus_1', stripe_subscription_id: this.subscriptionId,
          current_period_end: null, cancel_at: null, updated_at: null,
        }],
      };
    }
    return { rows: [], rowCount: 0 };
  }
}

const OLD_KEY = process.env.STRIPE_SECRET_KEY;

describe('syncSeats', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = OLD_KEY;
  });

  it('does nothing at all without Stripe keys', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const db = new FakeDb('sub_1');

    await syncSeats(db as unknown as Database, 'biz');

    // Not even a database read: this is the normal state in development, and
    // it should cost nothing on every join.
    expect(db.queries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when the workspace has never bought anything', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    const db = new FakeDb(null);

    await syncSeats(db as unknown as Database, 'biz');

    // Seats get counted fresh at checkout, so there is no quantity to correct.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pushes the current member count to Stripe', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    fetchMock
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          id: 'sub_1', status: 'active',
          items: { data: [{ id: 'si_1', price: { id: 'price_1' }, quantity: 1 }] },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'sub_1' }) });

    await syncSeats(new FakeDb('sub_1', 3) as unknown as Database, 'biz');

    const body = Object.fromEntries(
      new URLSearchParams(fetchMock.mock.calls[1][1].body as string).entries()
    );
    expect(body['items[0][quantity]']).toBe('3');
  });

  it('swallows a Stripe failure rather than failing the join', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    fetchMock.mockRejectedValue(new Error('Stripe is down'));
    const logged: unknown[] = [];

    // The assertion IS that this resolves. If syncSeats ever throws, accepting
    // an invite returns a 500 and the member is left outside the workspace.
    await expect(
      syncSeats(new FakeDb('sub_1') as unknown as Database, 'biz', {
        error: (o) => { logged.push(o); },
      })
    ).resolves.toBeUndefined();

    // Silent is not the same as invisible — the miss is logged so it can be
    // corrected, and the next membership change re-syncs anyway.
    expect(logged).toHaveLength(1);
  });
});
