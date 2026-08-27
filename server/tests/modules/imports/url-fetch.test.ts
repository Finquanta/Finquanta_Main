import { __testing, UrlFetchError, fetchSpreadsheetFromUrl } from '../../../src/modules/imports/url-fetch';

const { isPrivateAddress, hostAllowed } = __testing;

/**
 * The SSRF guard, asserted directly.
 *
 * This is the only place the server fetches a URL a user typed, so these rules
 * are the difference between an import feature and a way to read the instance
 * metadata endpoint. They are tested as rules rather than only through the
 * fetch path, because the fetch path cannot exercise the interesting cases
 * without real DNS.
 */
describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'RFC1918 /8'],
    ['172.16.0.1', 'RFC1918 /12 lower bound'],
    ['172.31.255.255', 'RFC1918 /12 upper bound'],
    ['192.168.1.1', 'RFC1918 /16'],
    ['169.254.169.254', 'cloud instance metadata'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['0.0.0.0', 'unspecified'],
    ['224.0.0.1', 'multicast'],
    ['::1', 'IPv6 loopback'],
    ['fd00::1', 'IPv6 unique local'],
    ['fe80::1', 'IPv6 link-local'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
    ['not-an-ip', 'unparseable'],
  ])('refuses %s (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    ['8.8.8.8'],
    ['142.250.185.78'],
    ['172.15.0.1'],   // just below the private /12
    ['172.32.0.1'],   // just above it
    ['2606:4700::1'],
  ])('allows public address %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('hostAllowed', () => {
  it('allows the listed hosts and their subdomains', () => {
    expect(hostAllowed('docs.google.com')).toBe(true);
    expect(hostAllowed('DOCS.GOOGLE.COM')).toBe(true);
    expect(hostAllowed('team.sharepoint.com')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(hostAllowed('evil.com')).toBe(false);
    expect(hostAllowed('localhost')).toBe(false);
  });

  /**
   * The suffix check must not be a substring check: an attacker registering
   * `docs.google.com.evil.com` would otherwise pass.
   */
  it('refuses a lookalike that merely contains an allowed host', () => {
    expect(hostAllowed('docs.google.com.evil.com')).toBe(false);
    expect(hostAllowed('notdocs.google.com.attacker.net')).toBe(false);
  });
});

describe('fetchSpreadsheetFromUrl', () => {
  it('refuses http', async () => {
    await expect(fetchSpreadsheetFromUrl('http://docs.google.com/x.csv')).rejects.toBeInstanceOf(UrlFetchError);
  });

  it('refuses a non-allowlisted host before any DNS or network work', async () => {
    await expect(fetchSpreadsheetFromUrl('https://evil.com/x.csv')).rejects.toBeInstanceOf(UrlFetchError);
  });

  it('refuses the metadata endpoint', async () => {
    await expect(fetchSpreadsheetFromUrl('https://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(UrlFetchError);
  });

  it('refuses localhost', async () => {
    await expect(fetchSpreadsheetFromUrl('https://localhost:3000/x.csv')).rejects.toBeInstanceOf(UrlFetchError);
  });

  it('refuses gibberish', async () => {
    await expect(fetchSpreadsheetFromUrl('not a url')).rejects.toBeInstanceOf(UrlFetchError);
  });
});
