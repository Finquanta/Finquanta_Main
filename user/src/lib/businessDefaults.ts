/**
 * Workspace naming defaults, mirroring the server's
 * `server/src/modules/businesses/businesses.repository.ts`. Keep the two in step.
 *
 * A workspace is created at registration, before anyone has said what the
 * business is called, so it starts with a placeholder. That placeholder is what
 * someone sees if they skip the business-name step in onboarding.
 */
export const DEFAULT_BUSINESS_NAME = 'My Finances';

/**
 * Every name meaning "nobody has named this workspace yet".
 *
 * Both entries matter. 'My Finances' is the current default; 'My Business' is
 * what accounts created earlier still carry. Anything deciding "has this been
 * named?" must check membership here rather than comparing against the current
 * default, or every older account gets treated as deliberately named and stops
 * being renamed when onboarding finally supplies a real one.
 *
 * Only ever append to this.
 */
export const PLACEHOLDER_BUSINESS_NAMES = [DEFAULT_BUSINESS_NAME, 'My Business'];
