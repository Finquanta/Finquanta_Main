"use client";

import { useEffect, useState } from "react";
import { MemberUsage, getMemberUsage } from "@/lib/api/billing";

/**
 * Who in this workspace has used what, this month.
 *
 * The meters above answer "how much is left"; this answers "where is it
 * going", which is the question a shared allowance actually raises. On a plan
 * billed per seat with one pooled quota, a team hitting the ceiling has no way
 * to see which of them is spending it — and the first sign is Finna refusing
 * to answer for everybody at once.
 *
 * IMPORTANT, and stated on screen rather than hidden here: attribution starts
 * from the release that introduced it. Usage was previously counted per
 * workspace only, with no record of who spent it, so nothing before that can
 * be shown. An empty table therefore means "nothing recorded yet", not "nobody
 * used it" — and saying so is the difference between a new feature and an
 * apparent bug.
 */
export default function MemberUsageTable({ isDark }: { isDark: boolean }) {
  const [rows, setRows] = useState<MemberUsage[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getMemberUsage().then(setRows).catch(() => setError(true));
  }, []);

  const card = isDark
    ? "bg-gray-800 border-gray-700 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const line = isDark ? "border-gray-700" : "border-gray-200";

  if (error) return null; // The meters above still work; this is extra detail.

  /**
   * Busiest first — the reason somebody opens this is to find the outlier, and
   * alphabetical would bury it. Council is weighted ahead of Finna in the tie
   * only because a session costs materially more to run than a message.
   */
  const sorted = rows
    ? [...rows]
        .filter((r) => r.finnaMessages > 0 || r.councilSessions > 0 || r.documentScans > 0 || r.userId)
        .sort(
          (a, b) =>
            b.councilSessions - a.councilSessions ||
            b.finnaMessages - a.finnaMessages ||
            b.documentScans - a.documentScans ||
            (a.name || a.email || "").localeCompare(b.name || b.email || "")
        )
    : [];

  return (
    <div className={`border rounded-xl p-4 ${card}`}>
      <p className="font-semibold text-sm">Usage by member</p>
      <p className={`text-xs mt-0.5 mb-3 ${muted}`}>
        This month, across everyone in this workspace. The allowance is shared, so these add up to
        the meters above.
      </p>

      {rows === null ? (
        <p className={`text-xs ${muted}`}>Loading…</p>
      ) : sorted.length === 0 ? (
        <p className={`text-xs ${muted}`}>No usage recorded yet this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs ${muted} text-left border-b ${line}`}>
                <th className="py-2 pr-3 font-medium">Member</th>
                <th className="py-2 px-3 font-medium text-right">Finna messages</th>
                <th className="py-2 px-3 font-medium text-right">Council sessions</th>
                <th className="py-2 pl-3 font-medium text-right">Documents scanned</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.userId ?? `removed-${i}`} className={`border-b last:border-0 ${line}`}>
                  <td className="py-2 pr-3">
                    <span className="block truncate max-w-[220px]">
                      {r.name || r.email || "Removed member"}
                    </span>
                    {/* The email sits under the name, because a display name is
                        not who somebody is on a team — two people called Sam
                        are told apart by their address, not by their row. Only
                        when a name is actually shown above it, so a member with
                        no name does not get their address printed twice. */}
                    {r.name && r.email && (
                      <span className={`block text-[11px] truncate max-w-[220px] ${muted}`}>
                        {r.email}
                      </span>
                    )}
                    <span className={`block text-[11px] ${muted}`}>
                      {/* A row with no user is spend that outlived the person. */}
                      {r.userId ? r.role : "no longer in this workspace"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.finnaMessages}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.councilSessions}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{r.documentScans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={`text-[11px] mt-3 ${muted}`}>
        Per-member figures start from when this was added — earlier usage was only counted for the
        workspace as a whole, so it cannot be broken down.
      </p>
    </div>
  );
}
