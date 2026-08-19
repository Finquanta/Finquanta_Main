"use client";

/**
 * A usage bar for one plan allowance.
 *
 * Lives in its own file because two screens need it — Settings → Finna shows
 * the message and Council counts, and Billing shows what the plan allows. One
 * copy, so the thresholds cannot drift into disagreeing about when something is
 * nearly used up.
 */
export default function UsageMeter({
  label, used, limit, isDark,
}: { label: string; used: number; limit: number | null; isDark: boolean }) {
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const track = isDark ? "bg-gray-700" : "bg-gray-200";

  // `null` means unlimited — there is no bar to draw, and drawing an empty one
  // would suggest a ceiling that does not exist.
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
  // BEFORE somebody is blocked, not as an error afterwards.
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
