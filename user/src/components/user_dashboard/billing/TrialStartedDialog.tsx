"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MyBilling, dismissTrialPrompt, getMyBilling } from "@/lib/api/billing";
import { getMe } from "@/lib/api/me";
import { resendVerification } from "@/lib/api/verify";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { themeClasses } from "@/lib/theme";
import { useTheme } from "@/hooks/context/ThemeContext";

/**
 * Told once, when a free trial begins: you have one, here is when it ends, and
 * here is how to make it longer.
 *
 * The trial used to start in complete silence. Onboarding calls the endpoint in
 * the background — deliberately, so nobody has to claim it — but nothing ever
 * said so afterwards, which left people unaware they had it, unaware when it
 * ended, and unaware that confirming their address would add another week.
 *
 * That last part is the reason this cannot wait. The verification bonus only
 * tops up a trial that is still RUNNING (`awardVerificationBonus` requires
 * `trial_ends_at > NOW()`), so an unverified customer who finds out afterwards
 * gets nothing at all. Mentioning it on day one is the only time it is worth
 * anything.
 *
 * PREVIEW: `?trialPreview=start` renders it against the real workspace without
 * writing anything, so the wording can be checked without editing a trial date
 * in the database to make it appear.
 */
export default function TrialStartedDialog() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = themeClasses(isDark);
  const params = useSearchParams();
  const preview = params?.get("trialPreview") === "start";

  const [billing, setBilling] = useState<MyBilling | null>(null);
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(true);
  const [sent, setSent] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    Promise.all([getMyBilling(), getMe()])
      .then(([b, me]) => {
        setEmail(me.email);
        setVerified(me.emailVerified);
        if (b.trialStarted || preview) setBilling(b);
      })
      .catch(() => { /* never block the dashboard over this */ });
  }, [preview]);

  const close = async () => {
    setClosed(true);
    // A preview must not spend the one showing the real customer gets.
    if (preview) return;
    try { await dismissTrialPrompt("start"); } catch { /* it will simply say so once more */ }
  };

  const verify = async () => {
    setSent(true);
    if (preview) return;
    try { await resendVerification(email); } catch { /* the button already reads as sent */ }
  };

  if (!billing || closed) return null;

  const ends = billing.trialEndsAt
    ? new Date(billing.trialEndsAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;
  const days = billing.daysRemaining;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-started-title"
      onClick={close}
    >
      <div
        className={`w-full max-w-md rounded-xl shadow-xl max-h-[90vh] overflow-y-auto ${c.surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        {preview && (
          <div className={`px-5 py-1.5 text-[11px] font-semibold ${isDark ? "bg-amber-900/40 text-amber-200" : "bg-amber-100 text-amber-800"}`}>
            {t("dashboard", "trialPreviewNote")}
          </div>
        )}

        <div className="p-5">
          <h2 id="trial-started-title" className={`text-lg font-bold ${c.heading}`}>
            {t("dashboard", "trialStartTitle")}
          </h2>

          {/* The end date is the whole point of showing this at all — a trial
              nobody can name the end of is one they cannot plan around. */}
          <p className={`mt-2 text-sm ${c.label}`}>
            {t("dashboard", "trialStartBody")}
          </p>
          {ends && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${isDark ? "bg-gray-700/40" : "bg-gray-50"} ${c.heading}`}>
              {t("dashboard", "trialStartEnds")} {ends}
              {typeof days === "number" && (
                <span className={`font-normal ${c.body}`}>
                  {` · ${days} ${days === 1 ? t("dashboard", "trialStartDay") : t("dashboard", "trialStartDays")}`}
                </span>
              )}
            </p>
          )}

          {/* Only worth saying to somebody who can still act on it. A verified
              customer already has the full fortnight, so telling them how to
              earn a week they were given at signup reads as a mistake. */}
          {!verified && (
            <div className={`mt-4 rounded-lg border p-3 ${c.successTint}`}>
              <p className={`text-sm font-semibold ${c.success}`}>
                {t("dashboard", "trialStartBonusTitle")}
              </p>
              <p className={`mt-1 text-xs ${c.success}`}>
                {t("dashboard", "trialStartBonusBody")}
              </p>
              <button
                onClick={verify}
                disabled={sent}
                className="mt-2 w-full rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-70"
              >
                {sent ? t("dashboard", "trialStartSent") : t("dashboard", "trialStartVerify")}
              </button>
            </div>
          )}
        </div>

        <div className="p-5 pt-0">
          <button
            onClick={close}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold ${isDark ? "border-gray-600 text-gray-200 hover:bg-gray-700/40" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            {t("dashboard", "trialStartGotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
