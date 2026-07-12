"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/hooks/context/ThemeContext";
import { Activity, ACTIVITY_META, ActivityType, listActivity } from "@/lib/api/activity";
import DashboardShell from "@/components/user_dashboard/DashboardShell";

const money = (n: number | null) =>
  n == null ? "" : `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Today", "Yesterday", then the date — so the timeline scans quickly. */
function dayLabel(iso: string | null): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const FILTERS: { key: "all" | "money-in" | "money-out" | "invoices" | "debt"; label: string; types?: ActivityType[] }[] = [
  { key: "all", label: "Everything" },
  { key: "money-in", label: "Money In", types: ["revenue_added", "receivable_settled", "invoice_paid", "loan_received", "loan_repayment_received"] },
  { key: "money-out", label: "Money Out", types: ["expense_created", "payable_settled", "loan_payment", "loan_issued"] },
  { key: "invoices", label: "Invoices", types: ["invoice_created", "invoice_sent", "invoice_paid", "invoice_cancelled", "invoice_deleted", "invoice_restored", "receivable_created"] },
  { key: "debt", label: "Debt", types: ["loan_received", "loan_issued", "loan_payment", "loan_repayment_received", "payable_created", "payable_settled"] },
];

export default function ActivityPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  useEffect(() => {
    listActivity(200)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load activity."))
      .finally(() => setLoading(false));
  }, []);

  const active = FILTERS.find((f) => f.key === filter)!;
  const rows = active.types ? items.filter((a) => active.types!.includes(a.type)) : items;

  // Group by day for the timeline headers.
  const groups: { day: string; items: Activity[] }[] = [];
  for (const a of rows) {
    const day = dayLabel(a.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const line = isDark ? "bg-gray-700" : "bg-gray-200";

  return (
    <DashboardShell><div className="p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${text}`}>Activity</h1>
          <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">← Dashboard</Link>
        </div>
        <p className={`text-sm mb-5 ${sub}`}>
          Every financial event in your business, newest first. This history is a record of what happened — it&apos;s never edited or removed.
        </p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "bg-blue-500 text-white"
                  : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className={`text-sm ${sub}`}>Loading activity…</p>
        ) : rows.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${card}`}>
            <p className={`text-sm ${sub}`}>
              {items.length === 0 ? "Nothing has happened yet. Add data or send an invoice and it'll show up here." : "No events match that filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.day}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${sub}`}>{g.day}</p>

                <div className="relative">
                  {/* The timeline spine */}
                  <div className={`absolute left-[7px] top-2 bottom-2 w-px ${line}`} aria-hidden="true" />

                  <div className="space-y-3">
                    {g.items.map((a) => {
                      const meta = ACTIVITY_META[a.type] ?? { label: a.type, color: "#6b7280" };
                      const time = a.occurredAt
                        ? new Date(a.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                        : "";
                      return (
                        <div key={a.id} className="relative flex items-start gap-4 pl-6">
                          <span className="absolute left-0 top-3 w-[15px] h-[15px] rounded-full border-2"
                            style={{ backgroundColor: meta.color, borderColor: isDark ? "#1f2937" : "#fff" }} />
                          <div className={`flex-1 rounded-xl border p-3 ${card}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                    style={{ backgroundColor: meta.color }}>
                                    {meta.label}
                                  </span>
                                  <span className={`text-[11px] ${sub}`}>{time}</span>
                                </div>
                                <p className={`text-sm font-medium mt-1.5 ${text}`}>{a.title}</p>
                                {a.description && <p className={`text-xs mt-0.5 ${sub}`}>{a.description}</p>}
                              </div>
                              {a.amount != null && a.amount > 0 && (
                                <span className={`text-sm font-semibold flex-shrink-0 ${text}`}>{money(a.amount)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div></DashboardShell>
  );
}
