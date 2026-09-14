// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KNOWN_SEGMENTS, decide, hrefFor, parseHost, pathKind, realAppUrl } from './hosts';

describe('realAppUrl — from beta back to the real product', () => {
  it('points beta at app. on the same base', () => {
    expect(realAppUrl('/beta-import', { host: 'beta.finquanta.ai', protocol: 'https:' }))
      .toBe('https://app.finquanta.ai/beta-import');
    expect(realAppUrl('/beta-import', { host: 'beta.localhost:3000', protocol: 'http:' }))
      .toBe('http://app.localhost:3000/beta-import');
  });

  it('is null anywhere that is not beta — there is no real site to import from', () => {
    for (const host of ['app.finquanta.ai', 'finquanta.ai', 'admin.finquanta.ai', 'finquanta-abc.vercel.app']) {
      expect(realAppUrl('/beta-import', { host, protocol: 'https:' })).toBeNull();
    }
    expect(realAppUrl('/beta-import', undefined)).toBeNull();
  });
});

describe('hrefFor — links that cross addresses', () => {
  it('points the dashboard admin link at admin. once the split is live', () => {
    expect(hrefFor('admin', '/admin-users', { host: 'app.finquanta.ai', protocol: 'https:' }))
      .toBe('https://admin.finquanta.ai/admin-users');
    expect(hrefFor('admin', '/admin-users', { host: 'app.localhost:3000', protocol: 'http:' }))
      .toBe('http://admin.localhost:3000/admin-users');
  });

  it('stays relative where every path is served — or the login would be left behind', () => {
    for (const host of ['finquanta.ai', 'beta.finquanta.ai', 'finquanta-abc.vercel.app', 'localhost:3000']) {
      expect(hrefFor('admin', '/admin-users', { host, protocol: 'https:' })).toBe('/admin-users');
    }
    expect(hrefFor('admin', '/admin-users', { host: 'admin.finquanta.ai', protocol: 'https:' })).toBe('/admin-users');
  });

  it('is relative with no window (server render)', () => {
    expect(hrefFor('admin', '/admin-users', undefined)).toBe('/admin-users');
  });
});

const go = (host: string, url: string, enabled = true) => {
  const [pathname, query] = url.split('?');
  return decide({
    host,
    pathname,
    search: query ? `?${query}` : '',
    protocol: host.includes('localhost') ? 'http:' : 'https:',
    enabled,
  });
};

describe('parseHost', () => {
  it('recognises each address and its base', () => {
    expect(parseHost('finquanta.ai')).toEqual({ kind: 'marketing', base: 'finquanta.ai' });
    expect(parseHost('www.finquanta.ai')).toEqual({ kind: 'marketing', base: 'finquanta.ai' });
    expect(parseHost('app.finquanta.ai')).toEqual({ kind: 'app', base: 'finquanta.ai' });
    expect(parseHost('admin.finquanta.ai')).toEqual({ kind: 'admin', base: 'finquanta.ai' });
    expect(parseHost('beta.finquanta.ai')).toEqual({ kind: 'beta', base: 'finquanta.ai' });
  });

  it('keeps the port, so localhost works for testing', () => {
    expect(parseHost('app.localhost:3000')).toEqual({ kind: 'app', base: 'localhost:3000' });
    expect(parseHost('localhost:3000')).toEqual({ kind: 'marketing', base: 'localhost:3000' });
  });

  it('leaves unknown hosts unsplit — a Vercel preview has no app. version', () => {
    expect(parseHost('finquanta-git-feat-x.vercel.app').kind).toBe('unsplit');
    expect(parseHost('app.example.com').kind).toBe('unsplit');
  });
});

describe('decide — switched off', () => {
  it('changes nothing, anywhere', () => {
    expect(go('finquanta.ai', '/dashboard', false)).toEqual({ action: 'next' });
    expect(go('finquanta.ai', '/admin-users', false)).toEqual({ action: 'next' });
  });
});

describe('decide — finquanta.ai', () => {
  it('serves marketing', () => {
    expect(go('finquanta.ai', '/')).toEqual({ action: 'next' });
    expect(go('finquanta.ai', '/home')).toEqual({ action: 'next' });
    expect(go('finquanta.ai', '/blog/some-post')).toEqual({ action: 'next' });
  });

  it('sends product paths to app., keeping old bookmarks working', () => {
    expect(go('finquanta.ai', '/dashboard')).toEqual({
      action: 'redirect', location: 'https://app.finquanta.ai/dashboard',
    });
    expect(go('www.finquanta.ai', '/invoices/abc')).toEqual({
      action: 'redirect', location: 'https://app.finquanta.ai/invoices/abc',
    });
  });

  it('keeps the query string, or referrers stop being credited', () => {
    expect(go('finquanta.ai', '/signup?ref=ABC123')).toEqual({
      action: 'redirect', location: 'https://app.finquanta.ai/signup?ref=ABC123',
    });
  });

  it('does not serve the admin panel at all', () => {
    expect(go('finquanta.ai', '/admin-users')).toEqual({ action: 'notFound' });
    expect(go('finquanta.ai', '/admin-login')).toEqual({ action: 'notFound' });
  });

  it('serves shared pages', () => {
    expect(go('finquanta.ai', '/terms')).toEqual({ action: 'next' });
    expect(go('finquanta.ai', '/unsubscribe?t=x')).toEqual({ action: 'next' });
  });
});

describe('decide — app.finquanta.ai', () => {
  it('opens on the dashboard', () => {
    expect(go('app.finquanta.ai', '/')).toEqual({
      action: 'redirect', location: 'https://app.finquanta.ai/dashboard',
    });
  });

  it('serves the product, auth and email landing pages', () => {
    for (const p of ['/dashboard', '/login', '/signup', '/demo', '/join/tok', '/verify-email', '/payment-success']) {
      expect(go('app.finquanta.ai', p)).toEqual({ action: 'next' });
    }
  });

  it('sends marketing paths back to finquanta.ai', () => {
    expect(go('app.finquanta.ai', '/pricing')).toEqual({
      action: 'redirect', location: 'https://finquanta.ai/pricing',
    });
  });

  it('does not serve the admin panel', () => {
    expect(go('app.finquanta.ai', '/admin-overview')).toEqual({ action: 'notFound' });
  });

  it('serves shared pages — unsubscribe links are built from APP_URL', () => {
    expect(go('app.finquanta.ai', '/unsubscribe?t=x')).toEqual({ action: 'next' });
    expect(go('app.finquanta.ai', '/privacy')).toEqual({ action: 'next' });
  });
});

describe('decide — admin.finquanta.ai', () => {
  it('opens on the overview', () => {
    expect(go('admin.finquanta.ai', '/')).toEqual({
      action: 'redirect', location: 'https://admin.finquanta.ai/admin-overview',
    });
  });

  it('serves the admin panel and nothing else', () => {
    expect(go('admin.finquanta.ai', '/admin-users')).toEqual({ action: 'next' });
    expect(go('admin.finquanta.ai', '/dashboard')).toEqual({ action: 'notFound' });
    expect(go('admin.finquanta.ai', '/home')).toEqual({ action: 'notFound' });
  });
});

describe('decide — beta and previews', () => {
  it('serves everything unsplit on beta', () => {
    expect(go('beta.finquanta.ai', '/admin-users')).toEqual({ action: 'next' });
    expect(go('beta.finquanta.ai', '/dashboard')).toEqual({ action: 'next' });
    expect(go('beta.finquanta.ai', '/home')).toEqual({ action: 'next' });
  });

  it('leaves Vercel preview URLs alone', () => {
    expect(go('finquanta-abc.vercel.app', '/dashboard')).toEqual({ action: 'next' });
  });
});

describe('decide — localhost', () => {
  it('splits the same way, on the same port', () => {
    expect(go('localhost:3000', '/dashboard')).toEqual({
      action: 'redirect', location: 'http://app.localhost:3000/dashboard',
    });
    expect(go('admin.localhost:3000', '/admin-users')).toEqual({ action: 'next' });
  });

  it('sends marketing to www.localhost — Next relativizes a redirect to plain localhost, which loops', () => {
    expect(go('app.localhost:3000', '/pricing')).toEqual({
      action: 'redirect', location: 'http://www.localhost:3000/pricing',
    });
    expect(go('www.localhost:3000', '/pricing')).toEqual({ action: 'next' });
  });
});

/**
 * Every route folder must have a home. Without this, a new dashboard page would
 * fall through as "shared" and be served on finquanta.ai with nobody noticing.
 */
describe('route folders are all classified', () => {
  const appDir = path.resolve(process.cwd(), 'src/app');
  const dirs = (rel: string) =>
    fs.readdirSync(path.join(appDir, rel), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('['))
      .map((d) => d.name);

  it('(user_dashbord) and (auth) belong to app.', () => {
    for (const name of [...dirs('(user_dashbord)'), ...dirs('(auth)')]) {
      expect({ name, kind: pathKind(`/${name}`) }).toEqual({ name, kind: 'app' });
    }
  });

  it('(admin) belongs to admin.', () => {
    for (const name of dirs('(admin)')) {
      expect({ name, kind: pathKind(`/${name}`) }).toEqual({ name, kind: 'admin' });
    }
  });

  it('landing and top-level folders are each deliberately placed', () => {
    const placed = new Set([
      ...KNOWN_SEGMENTS.app, ...KNOWN_SEGMENTS.marketing, ...KNOWN_SEGMENTS.shared,
    ]);
    const top = dirs('.').filter((n) => !n.startsWith('('));
    const unplaced = [...dirs('(landing_routes)'), ...top].filter((n) => !placed.has(n));
    // A new folder here needs a decision in lib/hosts.ts: which address serves it?
    expect(unplaced).toEqual([]);
  });
});
