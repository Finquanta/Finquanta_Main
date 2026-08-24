"use client";

import { useEffect, useState } from "react";
import { CheckoutOutcome, MyBilling, dismissTrialPrompt, getBillingStatus, getMyBilling, startCheckout } from "@/lib/api/billing";
import { useLanguage } from "@/hooks/context/LanguageContext";

/**
 * Asked once, when a free trial has run out: what would you like to do now?
 *
 * The trial ends silently otherwise. `status` is never moved off 'trialing'
 * when one lapses, so nothing anywhere announces it — the features simply stop
 * working, which reads as the product breaking rather than as a trial ending.
 * This is the moment the customer is best placed to decide, and the only moment
 * they are thinking about it.
 *
 * WHETHER to show it is the server's call, not ours (`trialEnded` on
 * /v1/billing/me). Three reasons it cannot be worked out here: the client does
 * not know whether a grandfather window is still covering them, browser storage
 * is per-device so a second machine would ask again, and only the server knows
 * whether this person owns the workspace and could act on the answer at all.
 *
 * Staying on Freemium is a real button rather than only the X, because it is a
 * legitimate answer. A dialog whose only exit is dismissal is a paywall wearing
 * a question mark, and people treat it accordingly.
 */
export default function TrialEndedDialog() {
  const { t } = useLanguage();
  const [billing, setBilling] = useState<MyBilling | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    /**
     * Both calls, because a workspace whose trial lapsed while Stripe was
     * switched off has nothing to be offered — showing plans that cannot be
     * bought would be worse than staying quiet.
     */
    Promise.all([getMyBilling(), getBillingStatus()])
      .then(([b, status]) => { if (b.trialEnded && status.configured) setBilling(b); })
      .catch(() => { /* never block the dashboard over this */ });
  }, []);

  /**
   * Stamped on ANSWER, not on appearance.
   *
   * Stamping when it mounts would spend the one showing on somebody who
   * refreshed half a second later and never read it — asked once, in effect
   * never asked. Every explicit exit counts as an answer: a plan, staying free,
   * the backdrop, Escape.
   */
  const answer = async () => {
    setClosed(true);
    try { await dismissTrialPrompt(); } catch { /* it will simply ask once more */ }
  };

  const buy = async (planKey: string) => {
    setBusy(planKey); setError(null);

    /**
     * The tab is claimed on the click, before any await — browsers only allow
     * `window.open` while a click is still being handled, and opening after the
     * network call is how popup blockers kill checkout silently. `noopener` is
     * left out on purpose: in the feature string it makes `window.open` return
     * null, leaving no handle to point at Stripe or to close.
     */
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;

    try {
      // Recorded before leaving, so /payment-success can tell whether the
      // webhook has actually landed rather than assuming that it has.
      try { sessionStorage.setItem("planBeforeCheckout", billing?.plan ?? "freemium"); } catch { /* private mode */ }
      const res: CheckoutOutcome = await startCheckout(planKey, interval);
      // Put the prompt away: they have answered, whether or not they go on to
      // complete the payment on Stripe's page.
      void dismissTrialPrompt().catch(() => { /* ignore */ });
      if (res.url) {
        if (tab) tab.location.href = res.url;
        else window.location.href = res.url; // popup blocked — use this tab
        return;
      }
      tab?.close();
      setClosed(true);
    } catch (e) {
      tab?.close();
      setBusy("");
      setError(e instanceof Error ? e.message : t("dashboard", "trialEndErr"));
    }
  };

  if (!billing || closed) return null;

  // Freemium is where they already are, and Corporate is not on sale yet.
  const options = (billing.plans ?? []).filter((p) => p.key !== "freemium" && !p.contactSales);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-ended-title"
      onClick={answer}
      onKeyDown={(e) => { if (e.key === "Escape") void answer(); }}
    >
      {/* Stop a click inside the card from counting as dismissal. */}
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 id="trial-ended-title" className="text-lg font-bold text-gray-900 dark:text-white">
            {t("dashboard", "trialEndTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t("dashboard", "trialEndBody")}
          </p>
        </div>

        <div className="p-5">
          {/* Yearly is the cheaper option, so it is worth showing rather than
              burying — but monthly leads, because it is the smaller commitment
              at the moment somebody is deciding whether to pay at all. */}
          <div className="flex gap-2 mb-4">
            {(["monthly", "yearly"] as const).map((i) => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  interval === i
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                    : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                }`}
              >
                {t("dashboard", i === "monthly" ? "trialEndMonthly" : "trialEndYearly")}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {options.map((p) => {
              const unit = interval === "monthly" ? p.monthly : p.annual;
              return (
                <button
                  key={p.key}
                  disabled={!!busy}
                  onClick={() => buy(p.key)}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 disabled:opacity-60"
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {busy === p.key
                      ? t("dashboard", "trialEndOpening")
                      : `$${unit}${interval === "monthly" ? t("dashboard", "trialEndPerMo") : t("dashboard", "trialEndPerYr")}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Per seat, said here rather than found out later on an invoice. */}
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
            {t("dashboard", "trialEndPerSeat")}
          </p>

          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="p-5 pt-0 flex flex-col gap-2">
          <button
            onClick={answer}
            disabled={!!busy}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 disabled:opacity-60"
          >
            {t("dashboard", "trialEndStayFree")}
          </button>
          {/* What staying free actually costs them, so it is an informed
              choice rather than the path of least resistance. */}
          <p className="text-[11px] text-center text-gray-500 dark:text-gray-400">
            {t("dashboard", "trialEndStayFreeHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
