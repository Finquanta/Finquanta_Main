import { Database } from '../../infrastructure/database';
import { BillingRepository } from './billing.repository';
import { EntitlementsService } from './entitlements.service';
import { isConfigured, syncSubscriptionQuantity } from './stripe.client';

/**
 * Keep the seat quantity Stripe bills in step with who is actually in the
 * workspace — spec 08 §1, per-seat pricing.
 *
 * The quantity used to be set once, at checkout, and never again. Since invites
 * started working that is a straight revenue leak: a workspace that buys one
 * seat and then adds four colleagues is billed for one of them forever. It cuts
 * the other way too — a team that shrinks keeps paying for people who left,
 * which is the version customers notice and resent.
 *
 * Viewers are excluded, because `seatCount` excludes them: read-only access is
 * not a paid seat.
 *
 * NEVER THROWS. This runs alongside joining and leaving a workspace, and those
 * must not fail because Stripe was slow or a key is missing. A missed sync is
 * corrected by the next membership change, and the amount at stake is one
 * seat's proration; a 500 on "accept invite" would strand somebody outside a
 * workspace they were invited to.
 */
export async function syncSeats(
  database: Database,
  businessId: string,
  log?: { info?: (o: unknown, m?: string) => void; error?: (o: unknown, m?: string) => void }
): Promise<void> {
  try {
    // No keys, nothing to talk to — the normal state in development.
    if (!isConfigured()) return;

    const billing = new BillingRepository(database);
    const sub = await billing.get(businessId);
    // Nothing bought yet: seats are counted fresh at checkout, so there is no
    // quantity to correct.
    if (!sub?.stripeSubscriptionId) return;

    const seats = await new EntitlementsService(database).seatCount(businessId);
    const result = await syncSubscriptionQuantity({
      subscriptionId: sub.stripeSubscriptionId,
      quantity: seats,
    });

    if (result.changed) {
      log?.info?.(
        { businessId, from: result.from, to: result.to },
        'Updated billed seats'
      );
    }
  } catch (error) {
    log?.error?.({ error, businessId }, 'Could not sync billed seats');
  }
}
