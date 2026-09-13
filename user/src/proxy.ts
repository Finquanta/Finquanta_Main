import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_BASE_DOMAINS, decide } from './lib/hosts';

/**
 * Sends each request to the address that owns it. The routing table and the
 * reasons behind it live in `lib/hosts.ts`.
 *
 * `proxy.ts`, not `middleware.ts`: Next 16 renamed the convention.
 *
 * Does nothing unless `DOMAIN_SPLIT=on`. Flip it only once app. and admin.
 * resolve and are added to the Vercel project.
 */
export function proxy(request: NextRequest) {
  const baseDomains = process.env.DOMAIN_SPLIT_BASES
    ? process.env.DOMAIN_SPLIT_BASES.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_BASE_DOMAINS;

  const decision = decide({
    host: request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    protocol: request.nextUrl.protocol,
    enabled: process.env.DOMAIN_SPLIT === 'on',
    baseDomains,
  });

  if (decision.action === 'redirect') {
    // 307, not 308. A permanent redirect is cached by browsers, so rolling the
    // split back would leave people bouncing to an address that no longer works.
    // Move to 308 once the split has settled.
    return NextResponse.redirect(decision.location, 307);
  }
  if (decision.action === 'notFound') {
    // Underscore folders are private in the App Router, so this never matches a
    // real page and Next renders its 404.
    return NextResponse.rewrite(new URL('/_not-on-this-host', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next's assets and anything with a file extension — public/ images and
  // email assets must load on every address.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
