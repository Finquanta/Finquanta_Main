"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin, getAccountDeletions, AccountDeletion } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

/**
 * Closed accounts.
 *
 * Its own tab rather than a filter on Audit Logs, because the two record
 * different things. The audit log holds ADMIN actions — so it showed a
 * deletion only when an admin performed it, and somebody closing their own
 * account from profile settings appeared nowhere at all. That is the majority
 * of deletions and the one most likely to be asked about afterwards.
 *
 * Everything shown here is a copy taken inside the deletion transaction. There
 * is no user row left to join to, which is exactly why the copy exists.
 */
export default function AdminDeletionsPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [rows, setRows] = useState<AccountDeletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAccountDeletions()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load account deletions."))
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

  /** Who closed it. The distinction people actually ask about. */
  const Source = ({ source }: { source: string }) => {
    const admin = source === "admin";
    return (
      <span style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: admin ? (dark ? "rgba(239,68,68,.18)" : "#fee2e2") : (dark ? "rgba(148,163,184,.18)" : "#f1f5f9"),
        color: admin ? (dark ? "#f87171" : "#b91c1c") : (dark ? "#cbd5e1" : "#475569"),
      }}>
        {admin ? "Removed by admin" : "Closed by user"}
      </span>
    );
  };

  const selfCount = rows.filter((r) => r.source !== "admin").length;
  const adminCount = rows.length - selfCount;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="deletions" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Account Deletions</h1>
              <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>
                Every account that no longer exists. Deletion is irreversible and takes the owner&apos;s
                workspaces and their financial history with it — this record is what remains.
              </p>
            </div>
            <button onClick={load} disabled={loading} style={{ borderRadius: 8, background: c.card, color: c.text, border: `1px solid ${c.border}`, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {rows.length > 0 && (
            <p style={{ fontSize: 12, color: c.muted, margin: "10px 0 0" }}>
              {rows.length} total — {selfCount} closed by the account holder, {adminCount} removed by an admin.
            </p>
          )}

          {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0" }}>{error}</p>}

          <div style={{ marginTop: 16, borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: c.head, color: c.muted, textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>When</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Account</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Name</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>How</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Removed by</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Workspaces lost</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, color: c.muted }}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 20, color: c.muted }}>
                      No accounts have been deleted. Deletions from this point on are recorded here —
                      anything before this feature shipped left no record to show.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${c.border}` }}>
                      <td style={{ padding: "10px 14px", color: c.muted, whiteSpace: "nowrap" }}>{fmt(r.createdAt)}</td>
                      <td style={{ padding: "10px 14px" }}>{r.email || "—"}</td>
                      <td style={{ padding: "10px 14px", color: c.muted }}>{r.name || "—"}</td>
                      <td style={{ padding: "10px 14px" }}><Source source={r.source} /></td>
                      <td style={{ padding: "10px 14px", color: c.muted }}>
                        {r.source === "admin" ? (r.actorEmail || "—") : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: c.muted }}>{r.workspacesDestroyed}</td>
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
