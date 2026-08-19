"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyBilling } from '@/lib/api/billing';

/**
 * Where Stripe sends someone after checkout.
 *
 * This page used to be a static thank-you note, which is a problem: the plan is
 * granted by WEBHOOK, not by the customer arriving here. The redirect proves
 * they finished Stripe's form, nothing more. If the webhook is misconfigured —
 * which is the normal state of a fresh environment until the endpoint is added
 * in the Stripe dashboard — an unconditional "thank you" tells somebody their
 * payment worked while nothing was granted at all.
 *
 * So it asks. It polls the plan for a few seconds and says which of the three
 * things actually happened: it landed, it is still settling, or something needs
 * looking at. Nothing here GRANTS anything; the webhook remains the only thing
 * that can, because it is the only one that cannot be spoofed by opening a URL.
 */

const ATTEMPTS = 6;
const GAP_MS = 1500;

type Outcome = 'checking' | 'confirmed' | 'pending';

export default function PaymentSuccess() {
  const [outcome, setOutcome] = useState<Outcome>('checking');
  const [planName, setPlanName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    // The plan as it stood when they left for Stripe. Anything different means
    // the webhook has landed; comparing beats testing for a specific plan,
    // since this page is not told which one they bought.
    const before = sessionStorage.getItem('planBeforeCheckout');

    const poll = async (attempt: number): Promise<void> => {
      if (cancelled) return;
      try {
        const billing = await getMyBilling();
        /**
         * "Settled" means the PLAN changed — not merely that the subscription
         * is active.
         *
         * Those are different events and they arrive separately.
         * `customer.subscription.updated` marks the row active as soon as
         * Stripe creates the subscription, but only `invoice.paid` grants the
         * plan. Treating active as done reported success while the customer
         * was still on Freemium — which is exactly what it did the first time
         * this ran for real.
         */
        const settled =
          (before !== null && billing.plan !== before) ||
          (billing.plan !== 'freemium' && billing.status === 'active');
        if (settled) {
          setPlanName(billing.planName);
          setOutcome('confirmed');
          sessionStorage.removeItem('planBeforeCheckout');
          return;
        }
      } catch {
        // Ignore and retry: a single failed read says nothing either way.
      }
      if (attempt >= ATTEMPTS) { setOutcome('pending'); return; }
      setTimeout(() => poll(attempt + 1), GAP_MS);
    };

    poll(1);
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-lg px-4">
        {outcome === 'checking' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Confirming your payment…</h1>
            <p className="text-sm text-gray-600 mb-8">
              This takes a few seconds. You do not need to pay again.
            </p>
          </>
        )}

        {outcome === 'confirmed' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {planName ? `You're now on our ${planName} Plan` : "You're now on your new plan"}
            </h1>
            <p className="text-base text-gray-800 mb-8">
              Thank you for choosing Finquanta AI. If you have any questions, our support team is
              always ready to help.
            </p>
          </>
        )}

        {/* Deliberately not an error. Card payments confirm in seconds, but a
            SEPA or ACH debit settles over days and is genuinely still pending —
            the same reason access is granted on `invoice.paid` rather than on
            checkout completing. Telling those customers something went wrong
            would be false. */}
        {outcome === 'pending' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Payment received — still settling</h1>
            <p className="text-sm text-gray-600 mb-2">
              Stripe has your payment. Some methods take a little longer to clear, and your plan
              updates automatically the moment it does.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              If nothing changes within an hour, contact us and we will sort it out — do not pay again.
            </p>
          </>
        )}

        <Link href="/dashboard">
          <button className="bg-[#4CAF50] text-white px-10 py-3 rounded-lg font-medium hover:bg-[#45a049] text-base">
            Go To Dashboard
          </button>
        </Link>
      </div>
    </main>
  );
}
