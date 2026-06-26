"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin, getAdminUsage, AdminUsage } from "@/lib/api/admin";

export default function AdminUsagePage() {
  const router = useRouter();
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAdminUsage()
      .then(setUsage)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load usage."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login"));
  }, [router]);

  const money = (usd?: number, currency?: string) =>
    typeof usd === "number"
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(usd)
      : "—";
  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">API Usage</h1>
            <p className="text-sm text-gray-500">Anthropic spend, so you know when to top up credits.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin-users")} className="text-sm text-gray-600 hover:underline">← Users</button>
            <button onClick={load} disabled={loading} className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-60">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          {loading && !usage ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : !usage ? (
            <p className="text-sm text-gray-500">No data.</p>
          ) : !usage.configured ? (
            <div className="space-y-3">
              <p className="font-semibold text-gray-900">Usage tracking isn&apos;t set up yet.</p>
              <p className="text-sm text-gray-600">
                To show your Anthropic spend here, add an <strong>Admin API key</strong> on Render as the env var{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5">ANTHROPIC_ADMIN_KEY</code>. This is a different key
                from the one Finna uses for chat — it starts with <code className="rounded bg-gray-100 px-1.5 py-0.5">sk-ant-admin…</code>{" "}
                and is created in the Anthropic Console under <em>Admin keys</em>.
              </p>
              <a href="https://platform.claude.com/settings/admin-keys" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-green-600 hover:underline">
                Create an Admin API key →
              </a>
            </div>
          ) : usage.error ? (
            <div className="space-y-2">
              <p className="font-semibold text-red-600">Couldn&apos;t reach Anthropic.</p>
              <p className="text-sm text-gray-600">{usage.error}. Double-check that <code className="rounded bg-gray-100 px-1.5 py-0.5">ANTHROPIC_ADMIN_KEY</code> is a valid Admin API key.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Spent this month ({fmtDate(usage.since)} – {fmtDate(usage.until)})</p>
              <p className="text-4xl font-bold text-gray-900">{money(usage.monthToDateUsd, usage.currency)}</p>
              <p className="text-xs text-gray-400">Updates within ~5 minutes of API activity. Priority Tier spend isn&apos;t included.</p>
              <a href="https://platform.claude.com/settings/cost" target="_blank" rel="noopener noreferrer" className="inline-block pt-2 text-sm font-medium text-green-600 hover:underline">
                Open full cost dashboard →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
