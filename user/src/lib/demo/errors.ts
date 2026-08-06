/**
 * Translatable errors for the demo's fake API.
 *
 * The api/* modules are plain functions with no React context, so they cannot
 * reach the translation hook — which is exactly how every one of their messages
 * stayed English in all ten languages. Instead of translating at the throw, the
 * error carries a key and the component translates at the point of display,
 * where `t` is actually in scope.
 */
export class DemoError extends Error {
  constructor(readonly key: string, fallback: string) {
    super(fallback);
    this.name = 'DemoError';
  }
}

type T = (ns: string, key: string) => string;

/**
 * The message to show for a caught error. Falls back to the English text baked
 * into the DemoError when a language is missing the key, then to the caller's
 * own generic message for anything that isn't a DemoError at all.
 */
export function demoErrorText(e: unknown, t: T, fallback: string): string {
  if (e instanceof DemoError) {
    const translated = t('demo', e.key);
    return translated && !translated.startsWith('demo.') ? translated : e.message;
  }
  return e instanceof Error ? e.message : fallback;
}
