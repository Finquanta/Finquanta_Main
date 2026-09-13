import { ProfileRepository } from '../../../src/modules/profile/profile.repository';
import { TestDatabase } from '../../helpers/test-database';

/**
 * The business profile save, against a real Postgres.
 *
 * Written when the registration and tax number fields were added. The upsert is
 * one long INSERT with 29 numbered placeholders and a hand-ordered parameter
 * list, so the easy mistake is an off-by-one that saves the tax number into
 * `description` and nothing complains. A mocked database would agree with any
 * ordering; only a real one round-trips the values and proves they line up.
 */

let db: TestDatabase;
let repo: ProfileRepository;

beforeAll(async () => {
  db = await TestDatabase.create();
  // ensureBusinessSchema() backfills profiles from businesses.owner_id and
  // created_at, which the shared stub table does not carry.
  await db.exec(`
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID;
    ALTER TABLE businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  `);
  repo = new ProfileRepository(db.asDatabase());
  await repo.ensureBusinessSchema();
}, 60_000);

afterEach(() => db.reset());
afterAll(() => db.close());

async function workspace() {
  const userId = await db.newUser('owner@example.com');
  const businessId = await db.newBusiness('Acme Trading');
  return { userId, businessId };
}

describe('registration and tax numbers', () => {
  it('save and read back', async () => {
    const { userId, businessId } = await workspace();
    await repo.upsertBusiness(businessId, userId, {
      registrationNumber: '12345678',
      taxNumber: 'GB123456789',
    });

    const read = await repo.getBusiness(businessId);
    expect(read.registrationNumber).toBe('12345678');
    expect(read.taxNumber).toBe('GB123456789');
  });

  /**
   * The off-by-one guard. Every field on either side of the new ones must land
   * in its own column, or the new parameters have shifted the old ones.
   */
  it('do not shift any other field out of its column', async () => {
    const { userId, businessId } = await workspace();
    await repo.upsertBusiness(businessId, userId, {
      businessName: 'Acme Trading',
      businessPhone: '+1 555 0134',
      website: 'https://acme.example',
      hasDebt: 'No',
      primaryGoal: 'Grow revenue',
      foundedDate: '2020-05-01',
      description: 'We trade things.',
      registrationNumber: 'REG-1',
      taxNumber: 'TAX-1',
      onboardingCompleted: true,
    });

    const read = await repo.getBusiness(businessId);
    expect(read).toMatchObject({
      businessName: 'Acme Trading',
      businessPhone: '+1 555 0134',
      website: 'https://acme.example',
      hasDebt: 'No',
      primaryGoal: 'Grow revenue',
      foundedDate: '2020-05-01',
      description: 'We trade things.',
      registrationNumber: 'REG-1',
      taxNumber: 'TAX-1',
      onboardingCompleted: true,
    });
  });

  it('are kept when a later save does not mention them', async () => {
    const { userId, businessId } = await workspace();
    await repo.upsertBusiness(businessId, userId, { registrationNumber: 'REG-1', taxNumber: 'TAX-1' });
    await repo.upsertBusiness(businessId, userId, { businessPhone: '+1 555 0000' });

    const read = await repo.getBusiness(businessId);
    expect(read.registrationNumber).toBe('REG-1');
    expect(read.taxNumber).toBe('TAX-1');
    expect(read.businessPhone).toBe('+1 555 0000');
  });

  /** Clearing the input sends '', and the export treats '' as absent. */
  it('can be cleared by saving an empty string', async () => {
    const { userId, businessId } = await workspace();
    await repo.upsertBusiness(businessId, userId, { registrationNumber: 'REG-1', taxNumber: 'TAX-1' });
    await repo.upsertBusiness(businessId, userId, { registrationNumber: '', taxNumber: '' });

    const read = await repo.getBusiness(businessId);
    expect(read.registrationNumber ?? '').toBe('');
    expect(read.taxNumber ?? '').toBe('');
  });

  it('trim stray spaces, so a blank-looking value does not print as filled in', async () => {
    const { userId, businessId } = await workspace();
    await repo.upsertBusiness(businessId, userId, { registrationNumber: '  12345678 ', taxNumber: '   ' });

    const read = await repo.getBusiness(businessId);
    expect(read.registrationNumber).toBe('12345678');
    expect(read.taxNumber ?? '').toBe('');
  });

  /** The request body is untyped JSON; a number must not crash the save. */
  it('ignore a non-string value instead of failing the save', async () => {
    const { userId, businessId } = await workspace();
    await repo.upsertBusiness(businessId, userId, { registrationNumber: 'REG-1' });
    await repo.upsertBusiness(businessId, userId, { registrationNumber: 12345 as unknown as string });

    const read = await repo.getBusiness(businessId);
    expect(read.registrationNumber).toBe('REG-1');
  });

  it('stay with their own workspace', async () => {
    const userId = await db.newUser('owner@example.com');
    const first = await db.newBusiness('First');
    const second = await db.newBusiness('Second');
    await repo.upsertBusiness(first, userId, { registrationNumber: 'FIRST-REG' });
    await repo.upsertBusiness(second, userId, { businessName: 'Second' });

    expect((await repo.getBusiness(first)).registrationNumber).toBe('FIRST-REG');
    expect((await repo.getBusiness(second)).registrationNumber).toBeUndefined();
  });
});
