import { redirect } from 'next/navigation';

/**
 * Retired.
 *
 * This was a hand-built card form on the marketing site — plain inputs for card
 * number, expiry and CVC — that was never wired to anything, and later a
 * "checkout is coming soon" placeholder. Neither should be reachable now that
 * real checkout exists: card details are collected by Stripe and nowhere else,
 * which is what keeps Finquanta out of PCI scope entirely.
 *
 * The old page also took the amount from the query string
 * (`/payment?plan=entrepreneur&price=49.99`), which anyone could edit. Real
 * checkout sends a plan key and lets the SERVER decide the price.
 *
 * Permanent (308), so anything still linking here — an old bookmark, a stale
 * search result — lands on the page that replaced it rather than on a dead end.
 */
export default function PaymentRedirect() {
  redirect('/pricing');
}
