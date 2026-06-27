"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin, getAdminUsage, AdminUsage } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

export default function AdminUsagePage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
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

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login"));
  }, [router]);

  const money = (usd?: number, currency?: string) =>
    typeof usd === "number"
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(usd)
      : "—";
  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    chip: dark ? "#0f172a" : "#f3f4f6",
  };
  const code = { background: c.chip, borderRadius: 4, padding: "1px 6px", fontSize: 12 } as const;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="usage" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>API Usage</h1>
              <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>Anthropic spend, so you know when to top up credits.</p>
            </div>
            <button onClick={load} disabled={loading} style={{ borderRadius: 8, background: c.chip, color: c.text, border: `1px solid ${c.border}`, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, padding: 24 }}>
            {loading && !usage ? (
              <p style={{ fontSize: 13, color: c.muted }}>Loading…</p>
            ) : !usage ? (
              <p style={{ fontSize: 13, color: c.muted }}>No data.</p>
            ) : !usage.configured ? (
              <div style={{ display: "grid", gap: 12 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Usage tracking isn&apos;t set up yet.</p>
                <p style={{ fontSize: 13, color: c.muted, margin: 0, lineHeight: 1.5 }}>
                  To show your Anthropic spend here, add an <strong>Admin API key</strong> on Render as the env var <code style={code}>ANTHROPIC_ADMIN_KEY</code>.
                  This is a different key from the one Finna uses for chat — it starts with <code style={code}>sk-ant-admin01-…</code>.
                  In the Claude Console go to <em>Settings → Admin keys</em>, click <em>Create key</em>, then paste the value into Render. Only an organization admin/owner can create it.
                </p>
                <a href="https://platform.claude.com/settings/admin-keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", textDecoration: "none" }}>Open Admin keys →</a>
              </div>
            ) : usage.error ? (
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ fontWeight: 600, color: "#dc2626", margin: 0 }}>Couldn&apos;t reach Anthropic.</p>
                <p style={{ fontSize: 13, color: c.muted, margin: 0 }}>{usage.error}. Double-check that <code style={code}>ANTHROPIC_ADMIN_KEY</code> is a valid Admin API key.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ fontSize: 13, color: c.muted, margin: 0 }}>Spent this month ({fmtDate(usage.since)} – {fmtDate(usage.until)})</p>
                <p style={{ fontSize: 38, fontWeight: 700, margin: 0 }}>{money(usage.monthToDateUsd, usage.currency)}</p>
                <p style={{ fontSize: 12, color: c.muted, margin: 0 }}>Updates within ~5 minutes of API activity. Priority Tier spend isn&apos;t included.</p>
                <a href="https://console.anthropic.com/settings/usage" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", textDecoration: "none", paddingTop: 8 }}>Open full cost dashboard →</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
