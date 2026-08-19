import { BrainInsightsService } from '../../../src/modules/brain/brain.insights';
import { Database } from '../../../src/infrastructure/database';
import { HealthScore, Ratio, RatioKey } from '../../../src/modules/health/health.types';

/**
 * The whole value of an insight node is that it fires ONCE, when something
 * actually changes. A writer that repeats itself on every dashboard load would
 * bury the graph, and one that fires on a business's first-ever reading would
 * greet new users with a wall of observations about a day of data.
 */

/** Minimal stand-in: records state writes and node inserts, nothing else. */
class FakeDb {
  state = new Map<string, string>();
  createdNodes: { type: string; title: string; source: string }[] = [];

  async query(text: string, params: any[] = []): Promise<any> {
    if (text.includes('FROM brain_insight_state')) {
      return {
        rows: [...this.state.entries()].map(([metric_key, side]) => ({ metric_key, side })),
      };
    }
    if (text.includes('INSERT INTO brain_insight_state')) {
      this.state.set(params[1], params[2]);
      return { rows: [], rowCount: 1 };
    }
    if (text.includes('FROM brain_categories')) {
      return { rows: [{ id: 'cat-finance' }] };
    }
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = {
      query: async (text: string, params: any[] = []) => {
        if (text.includes('FROM brain_categories')) return { rows: [{ id: params[0] }] };
        if (text.includes('INSERT INTO brain_nodes')) {
          this.createdNodes.push({ type: params[2], title: params[3], source: params[7] });
          return {
            rows: [{
              id: `n${this.createdNodes.length}`, business_id: params[0], category_id: params[1],
              type: params[2], title: params[3], content: params[4], payload: {},
              source: params[7], status: 'active', created_at: new Date(), updated_at: new Date(),
            }],
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return fn(client);
  }
}

const ratio = (key: RatioKey, value: number | null): Ratio => ({
  key,
  name: key,
  label: key,
  value,
  format: key === 'profitability' ? 'percent' : 'ratio',
  score: 50,
  trend: null,
  explanation: 'what it measures',
  insight: 'what it means here',
});

/** A ready score with the four ratios at the values given. */
const health = (score: number, values: Partial<Record<RatioKey, number | null>>): HealthScore => ({
  ready: true,
  daysOfData: 90,
  daysRequired: 30,
  score,
  trend: null,
  ratios: [
    ratio('liquidity', values.liquidity ?? 2),
    ratio('profitability', values.profitability ?? 10),
    ratio('debtRisk', values.debtRisk ?? 0.5),
    ratio('cashFlow', values.cashFlow ?? 1.5),
  ],
  summary: '',
  periodDays: 90,
});

describe('BrainInsightsService', () => {
  let db: FakeDb;
  let service: BrainInsightsService;

  beforeEach(() => {
    db = new FakeDb();
    service = new BrainInsightsService(db as unknown as Database);
  });

  it('writes nothing on the first reading, but remembers where the business is', async () => {
    const written = await service.record('biz', health(85, {}));
    expect(written).toBe(0);
    expect(db.createdNodes).toHaveLength(0);
    // State seeded, so the NEXT change is detectable.
    expect(db.state.get('score')).toBe('strong');
    expect(db.state.get('ratio:liquidity')).toBe('can cover');
  });

  it('writes nothing when nothing has moved', async () => {
    await service.record('biz', health(85, {}));
    const written = await service.record('biz', health(84, {}));
    expect(written).toBe(0);
    expect(db.createdNodes).toHaveLength(0);
  });

  it('writes an insight when a ratio crosses its threshold', async () => {
    await service.record('biz', health(85, { profitability: 10 }));
    const written = await service.record('biz', health(85, { profitability: -4 }));

    expect(written).toBe(1);
    expect(db.createdNodes).toHaveLength(1);
    expect(db.createdNodes[0]!.type).toBe('insight');
    // Provenance matters: this came from the platform reading its own numbers.
    expect(db.createdNodes[0]!.source).toBe('system');
    expect(db.createdNodes[0]!.title).toContain('unprofitable');
  });

  it('does not repeat itself while the business stays on the same side', async () => {
    await service.record('biz', health(85, { profitability: 10 }));
    await service.record('biz', health(85, { profitability: -4 }));
    // The dashboard being refreshed three more times must not add three nodes.
    await service.record('biz', health(85, { profitability: -6 }));
    await service.record('biz', health(85, { profitability: -9 }));

    expect(db.createdNodes).toHaveLength(1);
  });

  it('writes again when the business crosses back', async () => {
    await service.record('biz', health(85, { profitability: 10 }));
    await service.record('biz', health(85, { profitability: -4 }));
    await service.record('biz', health(85, { profitability: 3 }));

    expect(db.createdNodes).toHaveLength(2);
    expect(db.createdNodes[1]!.title).toContain('profitable');
  });

  it('records a score moving between bands', async () => {
    await service.record('biz', health(85, {}));       // strong
    const written = await service.record('biz', health(45, {})); // weak

    // The band change, plus nothing else moved.
    expect(written).toBe(1);
    expect(db.createdNodes[0]!.title).toContain('strong to weak');
  });

  it('stays silent until the score is ready', async () => {
    const notReady: HealthScore = { ...health(85, {}), ready: false, score: null };
    await service.record('biz', notReady);
    await service.record('biz', notReady);

    expect(db.createdNodes).toHaveLength(0);
    // Nothing recorded either — an unready reading is not a position to be in.
    expect(db.state.size).toBe(0);
  });

  it('ignores a ratio that cannot be computed', async () => {
    await service.record('biz', health(85, { liquidity: 2 }));
    const written = await service.record('biz', health(85, { liquidity: null }));

    // No liabilities is not "crossed into danger" — it is no reading at all.
    expect(written).toBe(0);
  });

  it('never lets a write failure reach the caller', async () => {
    db.transaction = async () => { throw new Error('db exploded'); };
    await service.record('biz', health(85, { profitability: 10 }));
    await expect(service.record('biz', health(85, { profitability: -4 }))).resolves.toBe(0);
  });
});
