"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/api/billing";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { themeClasses } from "@/lib/theme";
import { useTheme } from "@/hooks/context/ThemeContext";

/**
 * "You have used all of them — would you like more?"
 *
 * Shown when a metered feature refuses (the server's 402, surfaced as
 * PaymentRequiredError). Deliberately a QUESTION rather than a wall: the
 * reasoning is the same one written into TrialEndedDialog, that a dialog whose
 * only exit is dismissal is a paywall wearing a question mark, and people treat
 * it accordingly. So "Not now" is a real button, not just the X.
 *
 * It names real numbers — what the cap was, what the next tier gives — because
 * "upgrade for more" is a slogan and "25 used, Entrepreneur includes 100" is a
 * decision somebody can actually make without leaving the dialog.
 *
 * Generic on purpose. Document scans are the first caller, but Company Brain's
 * graph and backlinks, auto-summarisation and Council all answer 402 the same
 * way and can open this without changing it.
 */

export interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  /** Headline — what ran out. */
  title: string;
  /** One line explaining the limit, already filled with the real numbers. */
  body: string;
  /** The plan to send them to. Falls back to the pricing page when unknown. */
  requiredPlan?: string | null;
}

export default function UpgradePromptDialog({
  open, onClose, title, body, requiredPlan,
}: UpgradePromptProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = themeClasses(isDark);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const upgrade = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!requiredPlan) {
        // No plan named: the pricing page can at least explain the tiers.
        window.location.href = "/pricing";
        return;
      }
      const { url } = await startCheckout(requiredPlan, interval);
      if (url) window.location.href = url;
      else setError(t("dashboard", "upgradeCheckoutFailed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "upgradeCheckoutFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-prompt-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className={`w-full max-w-md rounded-xl shadow-xl ${c.surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-5 border-b ${c.line}`}>
          <h2 id="upgrade-prompt-title" className={`text-lg font-bold ${c.heading}`}>
            {title}
          </h2>
          <p className={`mt-1 text-sm ${c.body}`}>{body}</p>
        </div>

        <div className="p-5">
          {/* Monthly leads — it is the smaller commitment at the moment somebody
              is deciding whether to pay at all. Same order as TrialEndedDialog. */}
          <div className="flex gap-2 mb-4">
            {(["monthly", "yearly"] as const).map((i) => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  interval === i
                    ? `border-green-500 ${isDark ? "bg-green-900/20 text-green-300" : "bg-green-50 text-green-700"}`
                    : isDark ? "border-gray-600 text-gray-300" : "border-gray-200 text-gray-600"
                }`}
              >
                {t("dashboard", i === "monthly" ? "trialEndMonthly" : "trialEndYearly")}
              </button>
            ))}
          </div>

          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium ${c.body} ${c.hover}`}
            >
              {t("dashboard", "upgradeNotNow")}
            </button>
            <button
              onClick={upgrade}
              disabled={busy}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-60"
            >
              {busy ? t("dashboard", "saving") : t("dashboard", "upgradeCta")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
