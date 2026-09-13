"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { parseHost } from "@/lib/hosts";

/**
 * "Beta", under the logo, on beta.finquanta.ai only.
 *
 * beta. looks exactly like the real product, so without this it is easy to
 * forget which one you are in — and do something meant for your real books on
 * the test copy, or the other way round.
 *
 * Decided from the address in the browser, after mount, so the server render
 * and the first client render agree. Follows MaintenanceChip's shape.
 *
 * `BetaBadge` takes the theme as a prop for the marketing navbar, which has no
 * ThemeProvider — `useTheme` throws outside one.
 */
export function BetaBadge({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(parseHost(window.location.host).kind === "beta");
  }, []);

  if (!on) return null;

  return (
    <span
      title={t("dashboard", "betaChipTitle")}
      className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${
        isDark
          ? "border-violet-800 bg-violet-900/30 text-violet-300"
          : "border-violet-200 bg-violet-100 text-violet-800"
      }`}
    >
      <FlaskConical className="h-2.5 w-2.5" />
      {t("dashboard", "betaChipLabel")}
    </span>
  );
}

export default function BetaChip() {
  const { theme } = useTheme();
  return <BetaBadge isDark={theme === "dark"} />;
}
