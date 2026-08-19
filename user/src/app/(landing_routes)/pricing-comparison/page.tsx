import { redirect } from 'next/navigation';

/**
 * Retired. The comparison table now lives on /pricing, directly under the plan
 * cards, which is where someone comparing tiers already is.
 *
 * A redirect rather than a deletion: the URL was public, and anything holding
 * it — a bookmark, a link in an email, a search result — should land on the
 * table rather than a 404. Nothing in the app links here any more.
 *
 * Permanent (308), so search engines transfer the URL to /pricing rather than
 * keeping both and splitting the page's ranking between them.
 */
export default function PricingComparisonRedirect() {
  redirect('/pricing');
}
