/**
 * What plan a business is on.
 *
 * Nothing in the server knows this yet — there is no subscription, tier or
 * entitlement data anywhere, because that is spec 08 (Subscription Plans). The
 * admin Businesses tab still wants the column, so this is a single named seam
 * that reports the truth today: everyone is on the free tier because there is
 * nothing else to be on.
 *
 * Spec 08 replaces the body of this function with the entitlements lookup.
 * Deliberately a function rather than a constant so that swap doesn't change
 * any call site, and deliberately taking the businessId it will eventually need.
 */
export const planForBusiness = (_businessId: string): string => 'Freemium';
