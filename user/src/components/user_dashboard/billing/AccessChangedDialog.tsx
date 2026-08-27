"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MyBilling, dismissAccessNotice, getMyBilling } from "@/lib/api/billing";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { themeClasses } from "@/lib/theme";
import { useTheme } from "@/hooks/context/ThemeContext";

/**
 * Told when free access is granted, extended or shortened.
 *
 * Access used to change in complete silence: an admin adds a fortnight and the
 * workspace never learns it has one, or the window quietly lapses and features
 * stop working with no warning. Both read as the product behaving randomly.
 *
 * Shown to EVERY member, not only the owner. A plan is an owner's decision, but
 * what the workspace can currently do affects everyone working in it — and the
 * person who notices the Council has appeared is rarely the person who pays.
 *
 * Whether to show it is the server's call (`accessChanged` on /v1/billing/me),
 * which compares the live end date against the one the workspace was last told
 * about. Storing the DATE rather than a flag is what makes a second extension
 * announce itself too.
 *
 * PREVIEW: `?trialPreview=access` renders it without writing anything.
 */
export default function AccessChangedDialog() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = themeClasses(isDark);
  const params = useSearchParams();
  const preview = params?.get("trialPreview") === "access";

  const [billing, setBilling] = useState<MyBilling | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    getMyBilling()
      .then((b) => { if (b.accessChanged || preview) setBilling(b); })
      .catch(() => { /* never block the dashboard over this */ });
  }, [preview]);

  const close = async () => {
    setClosed(true);
    // A preview must not spend the real notice.
    if (preview) return;
    try { await dismissAccessNotice(); } catch { /* it will simply say so once more */ }
  };

  if (!billing || closed) return null;

  const until = billing.accessUntil || billing.grandfatheredUntil;
  const ends = until
    ? new Date(until).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;
  const days = until
    // The same minute of tolerance the server uses: an end date written from
    // the database clock sits a fraction above a whole number of days, and a
    // bare ceil turns 14 days into 15.
    ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now() - 60_000) / 86_400_000))
    : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-changed-title"
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
          <h2 id="access-changed-title" className={`text-lg font-bold ${c.heading}`}>
            {t("dashboard", "accessChangedTitle")}
          </h2>
          <p className={`mt-2 text-sm ${c.label}`}>
            {t("dashboard", "accessChangedBody")}
          </p>

          {/* The end date is the whole point. "You have free access" without a
              date is something nobody can plan around, and the day it stops is
              the day the product looks broken. */}
          {ends && (
            <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${c.successTint} ${c.success}`}>
              {t("dashboard", "accessChangedUntil")} {ends}
              {typeof days === "number" && (
                <span className="font-normal">
                  {` · ${days} ${days === 1 ? t("dashboard", "trialStartDay") : t("dashboard", "trialStartDays")}`}
                </span>
              )}
            </p>
          )}

          <p className={`mt-3 text-xs ${c.muted}`}>
            {t("dashboard", "accessChangedNote")}
          </p>
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
