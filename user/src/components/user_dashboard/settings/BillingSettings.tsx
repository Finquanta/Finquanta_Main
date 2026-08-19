"use client";

import { useEffect, useState } from "react";
import {
  CheckoutOutcome, MyBilling, getBillingStatus, getMyBilling, openBillingPortal, startCheckout,
  startMyTrial,
} from "@/lib/api/billing";

/**
 * Settings → Billing (spec 08 §3, "Dashboard changes").
 *
 * The full billing surface, and the reason it exists: Manage Billing was buried
 * inside the upgrade dialog, so finding an invoice meant clicking "Change plan"
 * — the one thing you were not trying to do. Settings is where people look for
 * subscriptions, so everything lives here and the sidebar keeps only the quick
 * upgrade shortcut.
 */

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

/** A usage meter. `limit` of null means unlimited, so there is no bar to draw. */
function Meter({
  label, used, limit, isDark,
}: { label: string; used: number; limit: number | null; isDark: boolean }) {
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const track = isDark ? "bg-gray-700" : "bg-gray-200";

  if (limit === null) {
    return (
      <div className="flex items-center justify-between text-sm py-2">
        <span>{label}</span>
        <span className={muted}>{used.toLocaleString()} used · unlimited</span>
      </div>
    );
  }

  const pct = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  // Amber before the wall, red at it. Spec 08 asks for meters to be visible
  // BEFORE someone is blocked, not as an error afterwards.
  const bar = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-green-500";

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-sm mb-1">
        <span>{label}</span>
        <span className={muted}>
          {limit === 0 ? "Not on your plan" : `${used.toLocaleString()} of ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className={`h-1.5 w-full rounded-full ${track}`}>
        <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingSettings({ isDark }: { isDark: boolean }) {
  const [billing, setBilling] = useState<MyBilling | null>(null);
  const [canBuy, setCanBuy] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /**
   * The plan the user has asked to switch to, awaiting confirmation.
   *
   * An in-app dialog rather than `window.confirm`: the browser's own box is
   * unstyled, says "localhost:3000 says", cannot show the amount in a way
   * anyone reads, and looks like the phishing prompts people are trained to
   * dismiss. This is a decision about money — it should look like part of the
   * product.
   */
  const [switching, setSwitching] = useState<
    { key: string; name: string; unit: number; up: boolean } | null
  >(null);


  const load = () => getMyBilling().then(setBilling).catch(() => setBilling(null));

  useEffect(() => {
    load();
    getBillingStatus()
      .then((s) => { setCanBuy(s.configured); setTestMode(s.testMode); })
      .catch(() => setCanBuy(false));
  }, []);

  if (!billing) {
    return <p className={isDark ? "text-gray-400" : "text-gray-500"}>Loading your plan…</p>;
  }

  // `text-*` matters as much as the background here: without it the cards
  // inherited near-black text and were unreadable in dark mode.
  const card = isDark
    ? "bg-gray-800 border-gray-700 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  /**
   * Both billing journeys leave for Stripe, so they share one handler — but a
   * plan change for an EXISTING subscriber has nowhere to go. The server
   * switches their subscription in place (selling them a second one would
   * charge them twice) and returns no URL, so this reloads and says what
   * happened instead of navigating.
   */
  const go = async (
    fn: () => Promise<CheckoutOutcome>,
    tag: string,
    { expectRedirect }: { expectRedirect: boolean }
  ) => {
    setBusy(tag); setError(null); setNote(null);

    /**
     * A tab is claimed on the click, BEFORE the await — but only when we know
     * we are going to Stripe.
     *
     * Two things this gets right, both learned the hard way:
     *
     *  - Browsers only permit `window.open` while a click is still being
     *    handled. Waiting for the network and opening afterwards is the classic
     *    way to be silently killed by a popup blocker.
     *  - `noopener` in the feature string makes `window.open` return NULL. With
     *    it we had no handle: the blank tab could not be closed (hello
     *    `about:blank`) and checkout quietly fell back to navigating this tab.
     *    `opener` is cleared on the handle instead, which is the same
     *    protection with a usable return value.
     *
     * A plan change for an existing subscriber returns no URL at all, so no tab
     * is opened for it — that is what left a stray blank tab behind.
     */
    const tab = expectRedirect ? window.open("", "_blank") : null;
    if (tab) tab.opener = null;

    try {
      const res = await fn();
      if (res.url) {
        // Remember the plan we are leaving on, so /payment-success can tell
        // whether the webhook has actually landed rather than assuming it has.
        try { sessionStorage.setItem("planBeforeCheckout", billing.plan); } catch { /* private mode */ }
        if (tab) { tab.location.href = res.url; setBusy(""); }
        else window.location.href = res.url; // popup blocked: use this tab
        return;
      }
      tab?.close(); // nothing to show it — the change happened here
      setNote(
        res.pending
          ? "Plan change submitted. Your new plan appears as soon as the payment clears."
          : "Your plan has been changed."
      );
      await load();
      setBusy("");
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy("");
    }
  };

  const beginTrial = async () => {
    setBusy("trial"); setError(null);
    try { await startMyTrial(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start your trial."); }
    finally { setBusy(""); }
  };

  const buyable = billing.plans.filter((p) => p.selfServe && p.monthly > 0);
  const hasSubscription = billing.status === "active" || billing.status === "past_due";

  // Why they can currently use more than they pay for, and until when.
  const windowNote =
    billing.reason === "trial"
      ? `Free trial — ends ${fmtDate(billing.trialEndsAt)}`
      : billing.reason === "grandfathered"
        ? `Early access — ends ${fmtDate(billing.grandfatheredUntil)}`
        : null;

  const cancelling = !!billing.cancelAt;
  const pastDue = billing.status === "past_due";

  return (
    <div className="space-y-3">
      {/* A live site can be running test keys. In that window a test card
          completes checkout and everything downstream behaves like a real
          sale — so this has to be said out loud, not inferred. */}
      {testMode && (
        <div className="border border-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Stripe is in test mode</p>
          <p className="text-xs text-purple-700 dark:text-purple-300/80">
            Payments made here are not real and no money changes hands.
          </p>
        </div>
      )}

      {/* The two states a paying customer can be in without knowing it. */}
      {pastDue && (
        <div className="border border-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Your last payment failed</p>
          <p className="text-xs text-red-700 dark:text-red-300/80">
            Update your card to keep your plan. We will retry it for you in the meantime.
          </p>
        </div>
      )}

      {/* A downgrade they have already chosen. Without this the change looks
          like it failed: nothing on the page moves until the date arrives. */}
      {billing.pendingPlan && billing.pendingPlanAt && (
        <div className="border border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Changing to {billing.pendingPlanName} on {fmtDate(billing.pendingPlanAt)}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300/80">
            You keep {billing.badgeLabel} until then — you have already paid for this period. Nothing
            is charged or refunded in the meantime.
          </p>
        </div>
      )}

      {cancelling && (
        <div className="border border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Your plan ends on {fmtDate(billing.cancelAt)}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300/80">
            You keep everything until then. Reactivate any time under Manage billing.
          </p>
        </div>
      )}

      {/* Where they stand */}
      <div className={`border rounded-xl p-4 ${card}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className={`text-xs font-semibold ${muted}`}>CURRENT PLAN</p>
            {/* What they PAY for. It used to show the plan their early-access
                window grants, which read "Business" directly above a list that
                marked Entrepreneur as current — the same page disagreeing with
                itself. The window is explained on the line below instead. */}
            <p className="text-xl font-bold mt-0.5">{billing.badgeLabel || billing.planName}</p>
            {windowNote && (
              <p className="text-sm text-amber-600 mt-1">
                {windowNote}
                {billing.daysRemaining !== null && ` · ${billing.daysRemaining} day${billing.daysRemaining === 1 ? "" : "s"} left`}
              </p>
            )}
            {/* Only worth saying when the two differ, which is exactly when it
                would otherwise be confusing. */}
            {billing.plan !== billing.effectivePlan && (
              <p className={`text-xs mt-1 ${muted}`}>
                You keep {billing.effectivePlanName} features until the date above.
              </p>
            )}
          </div>
          <div className="text-right">
            {!cancelling && billing.currentPeriodEnd && (
              <p className={`text-xs mb-1 ${muted}`}>Renews {fmtDate(billing.currentPeriodEnd)}</p>
            )}
            <p className={`text-xs font-semibold ${muted}`}>SEATS</p>
            <p className="text-xl font-bold mt-0.5">{billing.seats}</p>
            <p className={`text-xs ${muted}`}>billed per seat</p>
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {hasSubscription && canBuy && (
            <button
              onClick={() => go(openBillingPortal, "portal", { expectRedirect: true })}
              disabled={!!busy}
              className={`border text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60 ${
                isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {busy === "portal" ? "Opening…" : "Manage billing & invoices"}
            </button>
          )}
          {billing.trialAvailable && billing.reason !== "trial" && (
            <button
              onClick={beginTrial}
              disabled={!!busy}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy === "trial" ? "Starting…" : "Start free trial"}
            </button>
          )}
        </div>
      </div>

      {/* Usage meters — shown before someone hits a wall, not after. */}
      <div className={`border rounded-xl p-4 ${card}`}>
        <p className="font-semibold text-sm">This month</p>
        <p className={`text-xs mb-2 ${muted}`}>Resets on the 1st.</p>
        <Meter
          label="Finna messages"
          used={billing.usage?.finna_messages?.used ?? 0}
          limit={billing.usage?.finna_messages?.limit ?? null}
          isDark={isDark}
        />
        <Meter
          label="Council sessions"
          used={billing.usage?.council_sessions?.used ?? 0}
          limit={billing.usage?.council_sessions?.limit ?? null}
          isDark={isDark}
        />
      </div>

      {/* Change plan */}
      {canBuy && (
        <div className={`border rounded-xl p-4 ${card}`}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="font-semibold text-sm">Change plan</p>
            <div className={`inline-flex p-0.5 rounded-full ${isDark ? "bg-gray-900" : "bg-gray-100"}`}>
              {(["monthly", "yearly"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                    interval === i ? "bg-green-500 text-white" : muted
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {buyable.map((p) => {
              const unit = interval === "yearly" ? p.annual : p.monthly;
              const total = unit * Math.max(1, billing.seats);
              const current = p.key === billing.plan;
              // Rank by price: the catalogue is ordered cheapest first, so a
              // higher unit price is an upgrade and a lower one is a downgrade.
              const currentUnit = billing.plans.find((x) => x.key === billing.plan);
              const currentPrice = currentUnit
                ? (interval === "yearly" ? currentUnit.annual : currentUnit.monthly)
                : 0;
              const isSubscriber = billing.status === "active";
              return (
                <button
                  key={p.key}
                  disabled={current || !!busy}
                  onClick={() => {
                    // Only an existing subscriber is *switching*; a first
                    // purchase goes straight to Stripe, where the amount is
                    // shown before anything is charged.
                    if (isSubscriber) {
                      setSwitching({ key: p.key, name: p.name, unit, up: unit > currentPrice });
                      return;
                    }
                    // A first purchase goes to Stripe's hosted page.
                    go(() => startCheckout(p.key, interval), p.key, { expectRedirect: true });
                  }}
                  className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-left ${
                    current
                      ? "border-green-500 " + (isDark ? "bg-green-900/20" : "bg-green-50")
                      : (isDark ? "border-gray-700 hover:bg-gray-700/40" : "border-gray-200 hover:bg-gray-50")
                  } disabled:cursor-default`}
                >
                  <span className="font-semibold text-sm">
                    {p.name}
                    {current && <span className="text-green-600 font-medium"> · current</span>}
                  </span>
                  <span className="text-right text-xs">
                    <span className={`block ${muted}`}>
                      ${unit.toFixed(2)} / seat / {interval === "yearly" ? "yr" : "mo"}
                    </span>
                    <span className="block font-bold">
                      {busy === p.key ? "Opening…" : `$${total.toFixed(2)} total`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className={`text-xs mt-3 ${muted}`}>
            Payment is handled by Stripe. Your card details never reach Finquanta.
          </p>
        </div>
      )}

      {!canBuy && (
        <p className={`text-sm ${muted}`}>
          Online payment is not switched on yet. Contact us to change your plan.
        </p>
      )}

      {note && <p className="text-sm text-green-600">{note}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {switching && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSwitching(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${card}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {switching.up ? "Upgrade" : "Downgrade"} to {switching.name}?
            </h3>

            <div className={`mt-3 rounded-xl p-3 text-sm ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
              <div className="flex justify-between">
                <span className={muted}>New price</span>
                <span className="font-semibold">
                  ${(switching.unit * Math.max(1, billing.seats)).toFixed(2)} / {interval === "yearly" ? "yr" : "mo"}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className={muted}>Seats</span>
                <span className="font-semibold">
                  {billing.seats} × ${switching.unit.toFixed(2)}
                </span>
              </div>
            </div>

            {/* The consequence, which is different in each direction and is the
                thing worth reading. */}
            <p className={`text-sm mt-3 ${muted}`}>
              {switching.up
                ? "You will be charged the difference now, and your new plan starts as soon as the payment clears."
                : `You keep your current plan until the end of the period you have paid for, then drop to ${switching.name}. Nothing is charged or refunded now.`}
            </p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  const target = switching;
                  setSwitching(null);
                  // An existing subscriber's plan change happens server-side
                  // and returns no URL, so there is nowhere to send a tab.
                  go(() => startCheckout(target.key, interval), target.key, { expectRedirect: false });
                }}
                className={`flex-1 text-white text-sm font-semibold px-4 py-2.5 rounded-lg ${
                  switching.up ? "bg-green-500 hover:bg-green-600" : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {switching.up ? "Upgrade" : "Downgrade"}
              </button>
              <button
                onClick={() => setSwitching(null)}
                className={`px-4 py-2.5 rounded-lg border text-sm font-semibold ${
                  isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
