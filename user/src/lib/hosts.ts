/**
 * Which part of Finquanta a request belongs to, decided from its host and path.
 *
 * One Next.js app serves three addresses:
 *
 *   finquanta.ai        marketing — home, pricing, blog
 *   app.finquanta.ai    the product — dashboard, login, signup, demo
 *   admin.finquanta.ai  the admin panel
 *
 * plus `beta.finquanta.ai`, a separate deployment with its own database, which
 * serves every route unsplit so marketing, product and admin changes can all be
 * tried there.
 *
 * Kept free of Next imports so the whole routing table can be tested directly.
 * `proxy.ts` is only the wrapper that applies the decision.
 *
 * OFF UNTIL `enabled`. Shipping the redirects before the DNS records exist would
 * send every customer on finquanta.ai/dashboard to an app. address that does not
 * resolve — the site would be down. The switch is flipped once the new addresses
 * answer.
 */

export type Surface = 'marketing' | 'app' | 'admin';
export type HostKind = Surface | 'beta' | 'unsplit';
export type PathKind = Surface | 'shared';

/**
 * Domains the split applies to. Anything else — a Vercel preview URL, an IP —
 * is served unsplit, because there is no `app.` version of it to redirect to.
 */
export const DEFAULT_BASE_DOMAINS: readonly string[] = ['finquanta.ai', 'localhost'];

const PREFIXES: ReadonlyArray<[string, HostKind]> = [
  ['app.', 'app'],
  ['admin.', 'admin'],
  ['beta.', 'beta'],
  ['www.', 'marketing'],
];

/**
 * Classify a Host header, and find the base it hangs off (port included, so
 * `app.localhost:3000` has base `localhost:3000`).
 */
export function parseHost(
  rawHost: string,
  baseDomains: readonly string[] = DEFAULT_BASE_DOMAINS
): { kind: HostKind; base: string } {
  const host = rawHost.trim().toLowerCase();
  const colon = host.lastIndexOf(':');
  const hasPort = colon !== -1 && /^\d+$/.test(host.slice(colon + 1));
  const name = hasPort ? host.slice(0, colon) : host;
  const port = hasPort ? host.slice(colon) : '';

  for (const [prefix, kind] of PREFIXES) {
    if (name.startsWith(prefix) && baseDomains.includes(name.slice(prefix.length))) {
      return { kind, base: name.slice(prefix.length) + port };
    }
  }
  if (baseDomains.includes(name)) return { kind: 'marketing', base: name + port };
  return { kind: 'unsplit', base: host };
}

/**
 * First path segment → which address owns it.
 *
 * `src/lib/hosts.test.ts` reads the route folders and fails when one is missing
 * here, so a new page cannot silently end up on the wrong address.
 */
const APP_SEGMENTS = new Set([
  // (user_dashbord)
  'dashboard', 'activity', 'bookkeeping', 'brain', 'business-plan', 'council',
  'customers', 'documents', 'groups', 'inbox', 'invoices', 'needs', 'payroll',
  'profile-settings', 'referrals', 'statistics', 'workspace-settings',
  // (auth) — the login token is stored per address, so login must live where
  // the dashboard lives.
  'login', 'signup',
  // Reached from emails and links built from APP_URL.
  'onboarding', 'verify-email', 'reset-password', 'join',
  // The QR link is built from the dashboard's own origin.
  'capture',
  // Checkout needs the signed-in session; Stripe returns to APP_URL.
  'payment', 'payment-success',
  // The demo stashes its data for the account created at signup, in the same
  // browser storage — split them across addresses and the import finds nothing.
  'demo',
  // "Open in beta" lands here on beta with a one-time sign-in link.
  'sso',
]);

const MARKETING_SEGMENTS = new Set(['home', 'pricing', 'pricing-comparison', 'blog']);

/**
 * Served on every address. Legal pages are linked from signup and from emails;
 * `unsubscribe` comes from email links built with APP_URL; `api` is Next's own
 * route handlers, which both the landing and dashboard chat call.
 */
const SHARED_SEGMENTS = new Set([
  'terms', 'privacy', 'ai-risk-disclosure', 'unsubscribe', 'api', 'dev',
]);

export function pathKind(pathname: string): PathKind {
  if (pathname === '/' || pathname === '') return 'marketing';
  const segment = pathname.split('/')[1] ?? '';
  if (segment.startsWith('admin-')) return 'admin';
  if (APP_SEGMENTS.has(segment)) return 'app';
  if (MARKETING_SEGMENTS.has(segment)) return 'marketing';
  // Shared, and anything unknown: let Next render it or its own 404. The shared
  // list is not consulted here; it exists so the drift test can tell a
  // deliberately shared folder from a forgotten one.
  return 'shared';
}

/** Exposed for the drift test. */
export const KNOWN_SEGMENTS = { app: APP_SEGMENTS, marketing: MARKETING_SEGMENTS, shared: SHARED_SEGMENTS };

export type Decision =
  | { action: 'next' }
  | { action: 'redirect'; location: string }
  | { action: 'notFound' };

export function decide(input: {
  host: string;
  pathname: string;
  search: string;
  /** `https:` or `http:` */
  protocol: string;
  enabled: boolean;
  baseDomains?: readonly string[];
}): Decision {
  if (!input.enabled) return { action: 'next' };

  const { kind, base } = parseHost(input.host, input.baseDomains);
  if (kind === 'beta' || kind === 'unsplit') return { action: 'next' };

  const { pathname, search, protocol } = input;
  const on = (host: string, path = pathname) => `${protocol}//${host}${path}${search}`;

  if (kind === 'app' && pathname === '/') return { action: 'redirect', location: on(`app.${base}`, '/dashboard') };
  if (kind === 'admin' && pathname === '/') return { action: 'redirect', location: on(`admin.${base}`, '/admin-overview') };

  const owner = pathKind(pathname);
  if (owner === 'shared' || owner === kind) return { action: 'next' };

  // The admin panel is never reachable from the customer addresses, and the
  // admin address serves nothing else. A 404, not a redirect: the point is that
  // it is not there.
  if (owner === 'admin' || kind === 'admin') return { action: 'notFound' };

  // Marketing ↔ app: redirect, keeping the query string. Referral links are
  // `/signup?ref=CODE` and the code is read from the URL on arrival, so dropping
  // the query would silently stop referrers being credited.
  return { action: 'redirect', location: on(hostFor(owner, base)) };
}

/**
 * The host serving `surface` on a given base.
 *
 * Locally marketing is `www.localhost`, not `localhost`: Next turns a redirect
 * to its own host (`localhost:3000`) into a relative one, which keeps the
 * browser on app.localhost and loops.
 */
function hostFor(surface: Surface, base: string): string {
  if (surface !== 'marketing') return `${surface}.${base}`;
  return base.startsWith('localhost') ? `www.${base}` : base;
}

/**
 * A link to `path` on the address that serves `surface`, for links that cross
 * addresses — the dashboard's "Admin Panel" link, say.
 *
 * Relative unless you are on `app.` or `admin.`. Being on one of those means the
 * split is live; everywhere else (the unsplit site, beta, previews) every path
 * is served right where you are, and an absolute link would drop your login,
 * which is stored per address.
 */
export function hrefFor(
  surface: Surface,
  path: string,
  loc: { host: string; protocol: string } | undefined =
    typeof window === 'undefined' ? undefined : window.location,
  baseDomains?: readonly string[]
): string {
  if (!loc) return path;
  const { kind, base } = parseHost(loc.host, baseDomains);
  if ((kind !== 'app' && kind !== 'admin') || kind === surface) return path;
  return `${loc.protocol}//${hostFor(surface, base)}${path}`;
}
