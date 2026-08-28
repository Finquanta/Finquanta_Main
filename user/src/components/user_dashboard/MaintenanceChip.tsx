"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { getMaintenanceShared } from "@/lib/api/site";

/**
 * "Under Maintenance", under the logo in the sidebar.
 *
 * Deliberately NOT tied to the banner's dismissal. The banner across the top is
 * an announcement — you read it, you dismiss it, and it should stay dismissed.
 * This is a status light: it says the condition is still true, and it stays put
 * for as long as it is. Somebody who dismissed the notice an hour ago and is now
 * wondering why something is behaving oddly should still be able to see why.
 *
 * Reads its own theme rather than taking a prop, because it goes into two
 * different sidebars (the shared component and the copy still inlined in the
 * dashboard page) and threading a boolean through both is one more thing to get
 * out of step.
 */
export default function MaintenanceChip() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;
    getMaintenanceShared()
      .then((m) => { if (alive) setOn(m.enabled); })
      // No chip rather than a broken sidebar. A settings lookup must never be
      // able to take navigation down with it.
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, []);

  if (!on) return null;

  return (
    <span
      title={t("dashboard", "maintChipTitle")}
      className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${
        isDark
          ? "border-amber-800 bg-amber-900/30 text-amber-300"
          : "border-amber-200 bg-amber-100 text-amber-800"
      }`}
    >
      <Wrench className="h-2.5 w-2.5" />
      {t("dashboard", "maintChipLabel")}
    </span>
  );
}
