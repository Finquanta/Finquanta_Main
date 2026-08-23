"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBillingStatus, getMyBilling } from "@/lib/api/billing";

/**
 * The sidebar's upgrade shortcut. One button, nothing else.
 *
 * It opens Workspace Settings → Billing rather than a dialog of its own. Both
 * used to exist: a cut-down plan picker here, and the full surface in settings,
 * which meant two places to change a plan, two things to keep in step, and a
 * shortcut that could not show a cancellation notice, a failed payment, or the
 * usage meters sitting a click away. Now the sidebar navigates and settings
 * does the work.
 *
 * WORKSPACE settings, not personal ones. A plan belongs to a workspace — it is
 * billed by that workspace's seats — so Billing moved out of /profile-settings
 * when the workspace-scoped tabs were split off. This button kept pointing at
 * the old `?section=billing` and landed on a page that no longer has one.
 *
 * Renders nothing until it knows both that billing is switched on and what the
 * current plan is — a button that can only fail is worse than no button.
 */
export default function PlanChip({ isDark }: { isDark: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([getMyBilling(), getBillingStatus()])
      .then(([, status]) => setReady(status.configured))
      .catch(() => setReady(false));
  }, []);

  if (!ready) return null;

  return (
    <button
      onClick={() => router.push("/workspace-settings?tab=billing")}
      className={`w-full rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        isDark
          ? "border-green-500 text-green-400 hover:bg-green-500/10"
          : "border-green-600 text-green-700 hover:bg-green-50"
      }`}
    >
      Upgrade Plan
    </button>
  );
}
