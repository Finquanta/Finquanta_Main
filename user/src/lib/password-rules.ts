/**
 * The password rules, mirrored from the server.
 *
 * These MUST stay in step with `validatePassword()` in
 * `server/src/modules/auth/auth.service.ts`. They drifted apart once already:
 * the form only checked length while the server also demanded upper, lower,
 * digit and a special character — so people typed a password that looked fine,
 * the button enabled, and signup failed with a message that flashed for five
 * seconds in the corner. Two of the three people it hit were on iPhones, where
 * a corner toast behind the keyboard is invisible in practice.
 *
 * If you change one side, change the other.
 */
export interface PasswordRule {
  /**
   * Translation key in the `auth` section. The rules live at module level, out
   * of reach of the translation hook, so they carry a key and the form resolves
   * it at render — a literal here is a string no language can reach.
   */
  key: string;
  /** English, used as the fallback when a locale is missing the key. */
  label: string;
  test: (pw: string) => boolean;
}

/**
 * What counts as a symbol: anything that isn't a letter, a digit, or a space.
 * Spaces are excluded because a space in the middle of a password is almost
 * always a typo, and accepting one as "the symbol" would be a trap.
 */
export const SYMBOL_RE = /[^A-Za-z0-9\s]/;

/** Shown to the user so "add a symbol" isn't a guessing game. */
export const SYMBOL_EXAMPLES = '! ? @ # $ % & * - _ + = . , : ; ( ) [ ] { } / \\ | < > ~ ` \' "';

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'pwRuleLen', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'pwRuleLower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'pwRuleUpper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'pwRuleDigit', label: 'One number', test: (pw) => /\d/.test(pw) },
  { key: 'pwRuleSymbol', label: 'One symbol (like ! ? @ # - _)', test: (pw) => SYMBOL_RE.test(pw) },
];

export const passwordIsValid = (pw: string) => PASSWORD_RULES.every((r) => r.test(pw));

/**
 * The first unmet rule, for a single-line error. Null when the password is fine.
 * Returns the rule rather than its text so the caller can translate it — the
 * previous version handed back an English label that got embedded, lower-cased,
 * into an otherwise translated sentence.
 */
export const firstPasswordProblem = (pw: string): PasswordRule | null =>
  PASSWORD_RULES.find((r) => !r.test(pw)) ?? null;
