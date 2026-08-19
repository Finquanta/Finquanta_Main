"use client";

import { useEffect, useState } from "react";
import { MyBilling, getMyBilling } from "@/lib/api/billing";
import { FINNA_VISIBILITY_EVENT, isFinnaHidden, setFinnaHidden } from "@/lib/finnaVisibility";
import UsageMeter from "./UsageMeter";

/**
 * Settings → Finna.
 *
 * Two things belong together here and were previously in neither place: the
 * switch that hides Finna, which only existed as a small icon in the dashboard
 * header, and how much of the monthly allowance has been used, which was buried
 * in Billing among the prices.
 *
 * Both answer the same question — "what is this assistant doing for me, and how
 * much of it do I have left" — so they sit above Billing rather than inside it.
 */
export default function FinnaSettings({ isDark }: { isDark: boolean }) {
  const [billing, setBilling] = useState<MyBilling | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    getMyBilling().then(setBilling).catch(() => setBilling(null));
    setHidden(isFinnaHidden());
    // The header toggle writes the same value, so mirror it rather than letting
    // the two disagree while both are on screen.
    const sync = () => setHidden(isFinnaHidden());
    window.addEventListener(FINNA_VISIBILITY_EVENT, sync);
    return () => window.removeEventListener(FINNA_VISIBILITY_EVENT, sync);
  }, []);

  const card = isDark
    ? "bg-gray-800 border-gray-700 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  const toggle = () => {
    const next = !hidden;
    setFinnaHidden(next);
    setHidden(next);
  };

  return (
    <div className="space-y-3">
      {/* The switch */}
      <div className={`border rounded-xl p-4 ${card}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-sm">Finna</p>
            <p className={`text-xs mt-0.5 ${muted}`}>
              Your financial assistant. Turning it off hides the chat everywhere — it never
              runs on its own, so a hidden Finna costs nothing and uses none of your allowance.
            </p>
          </div>

          <button
            onClick={toggle}
            role="switch"
            aria-checked={!hidden}
            className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${
              hidden ? (isDark ? "bg-gray-600" : "bg-gray-300") : "bg-green-500"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                hidden ? "left-0.5" : "left-[22px]"
              }`}
            />
          </button>
        </div>
        <p className={`text-xs mt-2 font-medium ${hidden ? "text-amber-600" : "text-green-600"}`}>
          {hidden ? "Finna is turned off" : "Finna is on"}
        </p>
      </div>

      {/* What has been used this month */}
      <div className={`border rounded-xl p-4 ${card}`}>
        <p className="font-semibold text-sm">Messages this month</p>
        <p className={`text-xs mb-2 ${muted}`}>
          Resets on the 1st. Your plan sets the allowance.
        </p>

        {!billing ? (
          <p className={`text-sm ${muted}`}>Loading…</p>
        ) : (
          <>
            <UsageMeter
              label="Finna messages"
              used={billing.usage?.finna_messages?.used ?? 0}
              limit={billing.usage?.finna_messages?.limit ?? null}
              isDark={isDark}
            />
            <UsageMeter
              label="Council sessions"
              used={billing.usage?.council_sessions?.used ?? 0}
              limit={billing.usage?.council_sessions?.limit ?? null}
              isDark={isDark}
            />
            {/* Only worth saying when they are close to it. */}
            {(() => {
              const m = billing.usage?.finna_messages;
              if (!m || m.limit === null || m.limit === 0) return null;
              const left = Math.max(0, m.limit - m.used);
              if (left > m.limit * 0.2) return null;
              return (
                <p className="text-xs text-amber-600 mt-2">
                  {left === 0
                    ? "You have used this month's messages. They reset on the 1st, or you can upgrade in Billing."
                    : `${left} message${left === 1 ? "" : "s"} left this month.`}
                </p>
              );
            })()}
          </>
        )}
      </div>

      {/* What the Council is, for anyone who has not opened it */}
      <div className={`border rounded-xl p-4 ${card}`}>
        <p className="font-semibold text-sm">Finna Council</p>
        <p className={`text-xs mt-0.5 ${muted}`}>
          Several advisors weighing in on one question, rather than a single answer. Each session
          counts once against the allowance above, however long the discussion runs. Available from
          the Entrepreneur plan.
        </p>
      </div>
    </div>
  );
}
