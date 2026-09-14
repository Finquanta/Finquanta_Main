import { assertBetaConfig } from '../../src/config/config';

/**
 * beta.finquanta.ai runs in production mode, where the development safety nets
 * are off. These checks are what stops it charging real cards or opening
 * production's database, so each refusal is pinned here.
 */
const PROD_HOST = 'ep-prod-123-pooler.eu-central-1.aws.neon.tech';

const good = (): NodeJS.ProcessEnv => ({
  BETA_SITE: 'true',
  APP_URL: 'https://beta.finquanta.ai',
  DATABASE_URL: 'postgresql://u:p@ep-beta-456-pooler.eu-central-1.aws.neon.tech/neondb',
  PRODUCTION_DB_HOST: PROD_HOST,
  STRIPE_SECRET_KEY: 'sk_test_abc',
});

describe('assertBetaConfig', () => {
  it('starts with a correct beta setup', () => {
    expect(() => assertBetaConfig(good())).not.toThrow();
  });

  it('does nothing for production or local development', () => {
    expect(() => assertBetaConfig({ APP_URL: 'https://app.finquanta.ai', STRIPE_SECRET_KEY: 'sk_live_x' })).not.toThrow();
    expect(() => assertBetaConfig({})).not.toThrow();
  });

  it('refuses a live Stripe key', () => {
    expect(() => assertBetaConfig({ ...good(), STRIPE_SECRET_KEY: 'sk_live_abc' })).toThrow(/test-mode/);
  });

  it('allows Stripe to be unset', () => {
    const env = good();
    delete env.STRIPE_SECRET_KEY;
    expect(() => assertBetaConfig(env)).not.toThrow();
  });

  it("refuses production's database", () => {
    expect(() =>
      assertBetaConfig({ ...good(), DATABASE_URL: `postgresql://u:p@${PROD_HOST}/neondb` })
    ).toThrow(/production database/);
  });

  it("refuses production's database through its other Neon hostname", () => {
    expect(() =>
      assertBetaConfig({ ...good(), DATABASE_URL: 'postgresql://u:p@ep-prod-123.eu-central-1.aws.neon.tech/neondb' })
    ).toThrow(/production database/);
  });

  it('refuses to run without knowing where production is', () => {
    expect(() => assertBetaConfig({ ...good(), PRODUCTION_DB_HOST: '' })).toThrow(/PRODUCTION_DB_HOST/);
  });

  it('refuses secrets copied from production', () => {
    expect(() => assertBetaConfig({ ...good(), CRON_SECRET: 'x' })).toThrow(/CRON_SECRET/);
    expect(() => assertBetaConfig({ ...good(), RESEND_INBOUND_SIGNING_SECRET: 'x' })).toThrow(/RESEND_INBOUND_SIGNING_SECRET/);
  });

  it('refuses a non-beta APP_URL', () => {
    expect(() => assertBetaConfig({ ...good(), APP_URL: 'https://app.finquanta.ai' })).toThrow(/not a beta address/);
  });

  it('refuses a beta address without BETA_SITE, which would skip every check', () => {
    const env = good();
    delete env.BETA_SITE;
    expect(() => assertBetaConfig(env)).toThrow(/BETA_SITE/);
  });

  it('lists every problem at once', () => {
    let message = '';
    try {
      assertBetaConfig({ ...good(), STRIPE_SECRET_KEY: 'sk_live_abc', CRON_SECRET: 'x' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/test-mode/);
    expect(message).toMatch(/CRON_SECRET/);
  });
});
