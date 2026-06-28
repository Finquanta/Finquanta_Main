"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin, getAuditLogs, AuditLog } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

export default function AdminAuditPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAuditLogs()
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load audit logs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login"));
  }, [router]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    head: dark ? "#0f172a" : "#f9fafb",
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="audit" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Audit Logs</h1>
              <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>Every admin action — who did it, to whom, and when. This record cannot be edited or deleted.</p>
            </div>
            <button onClick={load} disabled={loading} style={{ borderRadius: 8, background: c.card, color: c.text, border: `1px solid ${c.border}`, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0" }}>{error}</p>}

          <div style={{ marginTop: 16, borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: c.head, color: c.muted, textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>When</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Admin</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Action</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Target</th>
                </tr>
              </thead>
              <tbody>
                {loading && logs.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 20, color: c.muted }}>Loading…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 20, color: c.muted }}>No admin actions recorded yet.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${c.border}` }}>
                      <td style={{ padding: "10px 14px", color: c.muted, whiteSpace: "nowrap" }}>{fmt(l.createdAt)}</td>
                      <td style={{ padding: "10px 14px" }}>{l.actorEmail || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{l.action}</td>
                      <td style={{ padding: "10px 14px", color: c.muted }}>{l.targetEmail || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
