import { Database } from '../../infrastructure/database';
import { cancelSubscription, isConfigured } from './stripe.client';

/**
 * Stop charging for workspaces that are about to stop existing.
 *
 * Called by the two teardown paths — closing an account and deleting a
 * workspace — because neither of them touched Stripe. The rows vanished from
 * our database and the subscription carried on billing the customer's card
 * every month for something they could no longer open. That is the kind of
 * charge people dispute with their bank rather than email support about, and
 * the first anyone here would have known is a chargeback.
 *
 * NEVER THROWS. Deletion is the user's decision and it has to complete: a
 * Stripe outage must not leave somebody unable to close their account. A missed
 * cancellation is recoverable by hand from the Stripe dashboard; a half-deleted
 * account is not.
 *
 * Returns the ids it cancelled, so callers can log or audit what happened.
 */
export async function stopBillingForBusinesses(
  database: Database,
  businessIds: string[],
  log?: { info?: (o: unknown, m?: string) => void; error?: (o: unknown, m?: string) => void }
): Promise<string[]> {
  if (businessIds.length === 0) return [];
  if (!isConfigured()) return []; // no keys — nothing is being charged anyway

  const cancelled: string[] = [];
  try {
    const rows = await database.query(
      `SELECT business_id, stripe_subscription_id
         FROM business_subscriptions
        WHERE business_id = ANY($1::uuid[])
          AND stripe_subscription_id IS NOT NULL`,
      [businessIds]
    );

    for (const row of rows.rows) {
      try {
        await cancelSubscription(row.stripe_subscription_id);
        cancelled.push(row.stripe_subscription_id);
        log?.info?.(
          { businessId: row.business_id, subscription: row.stripe_subscription_id },
          'Cancelled the Stripe subscription for a deleted workspace'
        );
      } catch (error) {
        /**
         * One failure must not stop the others.
         *
         * Someone closing an account may own several paying workspaces, and
         * abandoning the loop on the first error would leave the rest billing.
         */
        log?.error?.(
          { error, businessId: row.business_id, subscription: row.stripe_subscription_id },
          'COULD NOT CANCEL a Stripe subscription for a deleted workspace — cancel it by hand'
        );
      }
    }
  } catch (error) {
    log?.error?.({ error }, 'Could not read subscriptions while stopping billing');
  }
  return cancelled;
}
