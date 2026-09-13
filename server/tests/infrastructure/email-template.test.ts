import { renderEmail, appUrl } from '../../src/infrastructure/email-template';
import { actionLink } from '../../src/infrastructure/email';
import { inviteEmailHtml } from '../../src/modules/businesses/invite-email';

/**
 * What every Finquanta email must still do after any change to the shell.
 *
 * The first half was written BEFORE the dark-shell rewrite, against the old
 * template, and is deliberately template-agnostic: nothing in it asserts on
 * colours, layout or markup structure. Every assertion is a behaviour a customer
 * depends on — mostly "the link still works", because a broken password-reset
 * link is the one failure nobody notices until somebody is locked out of their
 * books. Run against the old shell it passed 12 of 13; the one failure was a
 * real bug in production (see "not double-encoded" below).
 *
 * Until this file existed, nothing in the suite rendered an email at all. The
 * shell could have been rewritten top to bottom and all 649 tests stayed green.
 */

const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));

const imageSources = (html: string): string[] =>
  [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

beforeAll(() => {
  process.env.APP_URL = 'https://app.finquanta.test';
  delete process.env.EMAIL_ASSET_URL;
});

describe('verification email', () => {
  const link = () => `${appUrl()}/verify-email?token=${TOKEN}`;
  const html = () => renderEmail({
    title: 'Verify Your Email',
    sections: [{
      paragraphs: ['Welcome! Please confirm your email address.'],
      cta: { label: 'Confirm email', url: link() },
    }],
    expiresIn: 'Expires in 24 hours',
    rawLink: link(),
  });

  it('has a clickable link carrying the full, unaltered token', () => {
    const target = hrefs(html()).find((h) => h.includes('/verify-email'));
    expect(target).toBeDefined();
    expect(new URL(target!).searchParams.get('token')).toBe(TOKEN);
  });

  it('prints the raw link in full, for clients that mangle the button', () => {
    expect(html()).toContain(link());
  });

  it('has no unsubscribe link — it is transactional', () => {
    expect(html().toLowerCase()).not.toContain('unsubscribe');
  });
});

describe('password reset email', () => {
  const link = () => `${appUrl()}/reset-password?token=${TOKEN}`;
  const html = () => renderEmail({
    title: 'Reset Your Password',
    sections: [{
      paragraphs: ['We received a request to reset your password.'],
      cta: { label: 'Reset password', url: link() },
    }],
    expiresIn: 'Expires in 1 hour',
    footerNote: "If you didn't request this, you can safely ignore this email.",
    rawLink: link(),
  });

  it('has a clickable link carrying the full, unaltered token', () => {
    const target = hrefs(html()).find((h) => h.includes('/reset-password'));
    expect(target).toBeDefined();
    expect(new URL(target!).searchParams.get('token')).toBe(TOKEN);
  });

  it('keeps the reassurance line for people who did not ask for this', () => {
    expect(html()).toContain('safely ignore');
  });

  it('has no unsubscribe link — a password reset has nothing to opt out of', () => {
    expect(html().toLowerCase()).not.toContain('unsubscribe');
  });
});

describe('lifecycle reminder email', () => {
  /** Mirrors LifecycleService.section(): the CTA goes through a click tracker. */
  const tracked = (path: string) =>
    `${appUrl()}/r/phone_recovery?t=${TOKEN}&next=${encodeURIComponent(path)}`;

  const html = () => renderEmail({
    title: 'Add a recovery phone number',
    sections: [{
      heading: 'Add a recovery phone number',
      paragraphs: ['A phone number on file helps verify it is really you.'],
      cta: { label: 'Add a phone number', url: tracked('/profile-settings') },
    }],
    unsubscribeUrl: `${appUrl()}/unsubscribe?t=${TOKEN}`,
  });

  it('carries an unsubscribe link, which bulk-sender rules require', () => {
    const unsub = hrefs(html()).find((h) => h.includes('/unsubscribe'));
    expect(unsub).toBeDefined();
    expect(new URL(unsub!).searchParams.get('t')).toBe(TOKEN);
  });

  /**
   * The tracker URL already contains a percent-encoded `next`. The old shell
   * ran the whole URL through `encodeURI`, turning `%2F` into `%252F`. The
   * redirect route decoded once, saw `%2Fprofile-settings`, failed its "must
   * start with /" guard and sent every reminder to /dashboard — so "Add a phone
   * number" and "See the plans" never reached their pages. Failed on the old
   * shell; this is the regression test for that.
   */
  it('delivers the redirect target intact, not double-encoded', () => {
    const cta = hrefs(html()).find((h) => h.includes('/r/phone_recovery'));
    expect(cta).toBeDefined();
    const url = new URL(cta!);
    expect(url.searchParams.get('t')).toBe(TOKEN);
    expect(url.searchParams.get('next')).toBe('/profile-settings');
  });

  it('keeps a query string inside the redirect target, too', () => {
    const out = renderEmail({
      title: 'Plans',
      sections: [{ paragraphs: ['x'], cta: { label: 'See the plans', url: tracked('/workspace-settings?tab=billing') } }],
    });
    const cta = hrefs(out).find((h) => h.includes('/r/phone_recovery'));
    expect(new URL(cta!).searchParams.get('next')).toBe('/workspace-settings?tab=billing');
  });
});

describe('escaping', () => {
  /** Business names and inviter names are user input and land in the HTML. */
  const hostile = `Acme <script>alert(1)</script> & "Sons"`;

  it('escapes user-supplied text in headings and paragraphs', () => {
    const html = renderEmail({
      title: `Getting more out of ${hostile}`,
      sections: [{ heading: hostile, paragraphs: [hostile] }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;Sons&quot;');
  });
});

describe('workspace invite email', () => {
  const link = () => `${appUrl()}/join/${TOKEN}`;
  const html = () => inviteEmailHtml({
    inviter: 'Gio <Dario>',
    businessName: 'Acme & Co',
    role: 'admin',
    link: link(),
    requiresPassword: true,
    expiresAt: null,
    singleUse: true,
  });

  it('links to the join page with the invite token intact', () => {
    const target = hrefs(html()).find((h) => h.includes('/join/'));
    expect(target).toBeDefined();
    expect(target).toBe(link());
  });

  it('escapes the inviter and business names', () => {
    expect(html()).not.toContain('Gio <Dario>');
    expect(html()).toContain('Gio &lt;Dario&gt;');
    expect(html()).toContain('Acme &amp; Co');
  });

  it('never puts the invite password in the email', () => {
    expect(html()).toContain('password protected');
  });

  it('says the link is single-use when it is', () => {
    expect(html()).toContain('used once');
  });

  /** It used to build its own markup, with a bare anchor Outlook renders unpadded. */
  it('now renders through the shared shell', () => {
    // Matches the site title and OG image, not the draft's lowercase "p".
    expect(html()).toContain('AI-Powered Company Brain');
    expect(html()).toMatch(/<table[^>]*role="presentation"[^>]*>\s*<tr><td bgcolor="#3AD542"/);
  });
});

describe('the dark shell', () => {
  const html = () => renderEmail({
    title: 'Verify Your Email',
    sections: [{
      paragraphs: ['Welcome.'],
      cta: { label: 'Confirm email', url: `${appUrl()}/verify-email?token=${TOKEN}` },
    }],
    expiresIn: 'Expires in 24 hours',
  });

  /** Without a full-width bgcolor table, Gmail floats the dark card on white. */
  it('paints the whole page ground, not just the card', () => {
    expect(html()).toMatch(/<table[^>]*width="100%"[^>]*bgcolor="#05040A"/);
  });

  it('declares itself dark so clients stop inverting it', () => {
    expect(html()).toContain('name="color-scheme" content="dark"');
  });

  /** Most clients block remote images by default; a blocked email must still read. */
  it('gives every image alt text', () => {
    const images = [...html().matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(images.length).toBe(3);
    for (const img of images) expect(img).toMatch(/\balt="/);
  });

  it('shows the expiry line only when one is given', () => {
    expect(html()).toContain('Expires in 24 hours');
    expect(renderEmail({ title: 't', sections: [{ paragraphs: ['p'] }] })).not.toContain('Expires in');
  });

  /**
   * `align="left"` on a table floats it, so in a digest the next reminder's
   * heading and text wrapped up beside the first reminder's button. Caught by
   * eye in a rendered preview; this keeps it from coming back.
   */
  it('never floats a table, so digest sections stack instead of wrapping beside buttons', () => {
    const digest = renderEmail({
      title: 'A couple of things on your Finquanta account',
      sections: [
        { heading: 'Add a recovery phone number', paragraphs: ['x'], cta: { label: 'Add a phone number', url: `${appUrl()}/r/a?t=${TOKEN}` } },
        { heading: 'Getting more out of Acme', paragraphs: ['y'], cta: { label: 'See the plans', url: `${appUrl()}/r/b?t=${TOKEN}` } },
      ],
    });
    expect(digest).not.toMatch(/<table[^>]*\balign="(left|right)"/);
    // Every button sits inside its own full-width row.
    const wrappers = digest.match(/<table role="presentation" width="100%"[^>]*style="margin:24px 0 8px">/g) ?? [];
    expect(wrappers.length).toBe(2);
  });

  it('keeps the footer links in the confirmed order', () => {
    const out = html();
    const at = ['>finquanta.ai<', '>Instagram<', '>X<', '>LinkedIn<'].map((s) => out.indexOf(s));
    for (const i of at) expect(i).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  /**
   * The localhost problem. Gmail fetches images through Google's proxy, which
   * cannot reach a developer's machine, so an email sent from localhost with
   * localhost image URLs arrives with every image broken. Links must still
   * point at the app, though — only the images move.
   */
  it('serves images from EMAIL_ASSET_URL while links stay on APP_URL', () => {
    process.env.EMAIL_ASSET_URL = 'https://cdn.finquanta.test/';
    try {
      const out = html();
      const sources = imageSources(out);
      expect(sources.length).toBe(3);
      for (const s of sources) expect(s.startsWith('https://cdn.finquanta.test/email/')).toBe(true);
      expect(hrefs(out).some((h) => h.startsWith('https://app.finquanta.test/verify-email'))).toBe(true);
    } finally {
      delete process.env.EMAIL_ASSET_URL;
    }
  });

  it('falls back to APP_URL for images when EMAIL_ASSET_URL is unset', () => {
    for (const s of imageSources(html())) {
      expect(s.startsWith('https://app.finquanta.test/email/')).toBe(true);
    }
  });
});

describe('the local dev link log', () => {
  /**
   * With no RESEND_API_KEY the sender logs the link instead of mailing it, which
   * is the only way to use a reset link locally. The dark shell puts a logo and a
   * brand link above the button, so the old "first URL in the HTML" rule would
   * now log a PNG.
   */
  it('picks the reset link, not the logo or the brand link', () => {
    const link = `${appUrl()}/reset-password?token=${TOKEN}`;
    const out = renderEmail({
      title: 'Reset Your Password',
      sections: [{ paragraphs: ['x'], cta: { label: 'Reset password', url: link } }],
      rawLink: link,
    });
    expect(actionLink(out)).toBe(link);
  });

  it('picks the reminder button, not the unsubscribe link', () => {
    const cta = `${appUrl()}/r/phone_recovery?t=${TOKEN}&next=${encodeURIComponent('/profile-settings')}`;
    const out = renderEmail({
      title: 'Add a recovery phone number',
      sections: [{ paragraphs: ['x'], cta: { label: 'Add a phone number', url: cta } }],
      unsubscribeUrl: `${appUrl()}/unsubscribe?t=${TOKEN}`,
    });
    expect(actionLink(out)).toBe(cta);
  });

  it('picks the invite join link', () => {
    const link = `${appUrl()}/join/${TOKEN}`;
    const out = inviteEmailHtml({
      inviter: 'Gio', businessName: 'Acme', role: 'admin', link,
      requiresPassword: false, expiresAt: null, singleUse: true,
    });
    expect(actionLink(out)).toBe(link);
  });
});
