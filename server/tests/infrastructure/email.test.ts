import { sendEmail, setBetaRecipientCheck } from '../../src/infrastructure/email';

/**
 * On beta, a workspace imported from the real books carries real customers'
 * addresses. Delivery must be limited to people with a beta account, and must
 * fail closed when that cannot be checked.
 */
describe('sendEmail on beta', () => {
  const message = { to: 'customer@example.com', subject: 'Invoice INV-0007', html: '<p>hi</p>' };
  const saved = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    (global as any).fetch = fetchMock;
    process.env.RESEND_API_KEY = 're_test';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...saved };
    setBetaRecipientCheck(null);
    jest.restoreAllMocks();
  });

  it('delivers to a beta account', async () => {
    process.env.BETA_SITE = 'true';
    setBetaRecipientCheck(async () => true);
    await sendEmail(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips an address with no beta account', async () => {
    process.env.BETA_SITE = 'true';
    setBetaRecipientCheck(async () => false);
    await sendEmail(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when no check is registered', async () => {
    process.env.BETA_SITE = 'true';
    await sendEmail(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when the check itself fails', async () => {
    process.env.BETA_SITE = 'true';
    setBetaRecipientCheck(async () => { throw new Error('database down'); });
    await sendEmail(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is untouched outside beta', async () => {
    delete process.env.BETA_SITE;
    await sendEmail(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
