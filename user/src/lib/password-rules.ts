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
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One symbol (like ! ? @ # - _)', test: (pw) => SYMBOL_RE.test(pw) },
];

export const passwordIsValid = (pw: string) => PASSWORD_RULES.every((r) => r.test(pw));

/** The first unmet rule, for a single-line error. Null when the password is fine. */
export const firstPasswordProblem = (pw: string): string | null =>
  PASSWORD_RULES.find((r) => !r.test(pw))?.label ?? null;
