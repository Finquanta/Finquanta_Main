"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminBusiness, checkAdmin, deleteAdminBusiness, listAdminBusinesses,
  setAdminBusinessStatus, updateAdminBusiness,
} from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

/**
 * Workspaces, one row each.
 *
 * This tab exists because business data used to be columns on the Users tab,
 * joined on `user_id`. `business_profiles` became one row per BUSINESS in the
 * 2026-08-10 migration, so that join multiplied rows: 26 users rendered as 29,
 * and an owner of four workspaces appeared four times. Here one row per
 * business is the point rather than a bug.
 */
export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [openMenuId, setOpenMenuId] = useState<string>("");
  const [editBiz, setEditBiz] = useState<AdminBusiness | null>(null);
  const [form, setForm] = useState({ name: "", country: "" });

  const bounceToLogin = (msg: string) => {
    if (/admin access|authentication|session|401|403/i.test(msg)) { router.replace("/admin-login"); return true; }
    return false;
  };

  const load = () =>
    listAdminBusinesses()
      .then((data) => setBusinesses(data))
      .catch((e) => { const m = e instanceof Error ? e.message : ""; if (!bounceToLogin(m)) setError(m || "Could not load businesses."); });

  useEffect(() => { setDark(readAdminDark()); }, []);

  useEffect(() => {
    checkAdmin()
      .then((me) => { setMyRole(me.role); return load(); })
      .catch((e) => { if (!bounceToLogin(e instanceof Error ? e.message : "")) router.replace("/admin-login"); })
      .finally(() => setLoading(false));
  }, [router]);

  // Same capability matrix as the Users tab, but applied to the workspace
  // OWNER's role. Deleting someone's workspace destroys the same financial
  // history deleting their account does, so it cannot be the softer path.
  const rank = (r: string) => ({ user: 0, admin: 1, super_admin: 2, owner: 3 } as Record<string, number>)[r] ?? 0;
  const canRestrict = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1) || (myRole === "admin" && t === "user");
  const canDelete = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1);
  const canEditName = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1) || (myRole === "admin" && t === "user");
  // The list doesn't carry the owner's role, so actions are offered against a
  // plain user and the server re-checks properly against the real role.
  const canManage = () => canRestrict("user") || canDelete("user") || canEditName("user");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) =>
      [b.name, b.ownerName, b.ownerEmail, b.country, b.industry, b.plan].some((f) => (f || "").toLowerCase().includes(q))
    );
  }, [businesses, query]);

  const act = async (fn: () => Promise<void>, id: string) => {
    setBusyId(id); setError(null); setOpenMenuId("");
    try { await fn(); await load(); }
    catch (e) { const m = e instanceof Error ? e.message : "Action failed."; if (!bounceToLogin(m)) setError(m); }
    finally { setBusyId(""); }
  };

  const startEdit = (b: AdminBusiness) => {
    setForm({ name: b.name || "", country: b.country || "" });
    setEditBiz(b);
    setOpenMenuId("");
  };
  const saveEdit = () => {
    if (!editBiz) return;
    act(() => updateAdminBusiness(editBiz.id, {
      name: form.name.trim(), country: form.country.trim(),
    }).then(() => setEditBiz(null)), editBiz.id);
  };
  const toggleStatus = (b: AdminBusiness) =>
    act(() => setAdminBusinessStatus(b.id, b.status === "suspended" ? "active" : "suspended"), b.id);
  const remove = (b: AdminBusiness) => {
    // Spelled out because this is not the same as deleting a note: the cascade
    // takes the whole ledger — invoices, transactions, customers, the Brain.
    const ok = window.confirm(
      `Delete the workspace "${b.name}" owned by ${b.ownerEmail}?\n\n` +
      `This permanently removes its entire financial history — invoices, transactions, customers, groups and Company Brain. ` +
      `It cannot be undone.`
    );
    if (ok) act(() => deleteAdminBusiness(b.id), b.id);
  };

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7", surface: dark ? "#1e293b" : "#fff", border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a", muted: dark ? "#94a3b8" : "#6b7280", input: dark ? "#0f172a" : "#f9fafb",
    head: dark ? "#0f172a" : "#fafafa", menuHover: dark ? "#334155" : "#f3f4f6",
  };
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

  const planBadge = (plan: string) => (
    <span style={{ background: dark ? "#334155" : "#f3f4f6", color: dark ? "#cbd5e1" : "#6b7280", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>
      {plan}
    </span>
  );

  const MenuItem = ({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = d.menuHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", color: danger ? "#dc2626" : d.text }}
    >
      {label}
    </button>
  );

  const restrictedCount = businesses.filter((b) => b.status === "suspended").length;
  const multiMember = businesses.filter((b) => b.memberCount > 1).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: d.bg, fontFamily: "sans-serif", fontSize: 14, color: d.text }}>
      <AdminSidebar active="businesses" dark={dark} setDark={setDark} />

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px", borderBottom: `0.5px solid ${d.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Businesses</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: d.muted }}>{loading ? "Loading…" : `${businesses.length} workspaces`}</p>
          </div>
          <input placeholder="Search business, owner, country…" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ width: 300, padding: "8px 12px", border: `0.5px solid ${d.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: d.input, color: d.text }} />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 28px" }}>
          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 660, marginBottom: 16 }}>
            <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
              <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>Workspaces</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>{businesses.length}</p>
            </div>
            <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
              <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>With a team</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: "#16a34a" }}>{multiMember}</p>
            </div>
            <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
              <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>Restricted</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: restrictedCount ? "#dc2626" : d.text }}>{restrictedCount}</p>
            </div>
          </div>

          {loading ? <p style={{ color: d.muted, fontSize: 13 }}>Loading businesses…</p> : filtered.length === 0 ? <p style={{ color: d.muted, fontSize: 13 }}>No businesses found.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: d.muted, background: d.head }}>
                  {["Business", "Owner", "Members", "Plan", "Country", "Status", "Created", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: `0.5px solid ${d.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const busy = busyId === b.id;
                  // Dim only the content cells for restricted workspaces — never
                  // the actions cell, or its dropdown inherits the low opacity
                  // (CSS opacity on a parent caps its children) and renders
                  // see-through.
                  const dim = b.status === "suspended" ? 0.55 : 1;
                  return (
                    <tr key={b.id} style={{ borderBottom: `0.5px solid ${d.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, opacity: dim }}>{b.name || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>
                        <div>{b.ownerName}</div>
                        <div style={{ color: d.muted, fontSize: 12 }}>{b.ownerEmail}</div>
                      </td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{b.memberCount}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{planBadge(b.plan)}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{b.country || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>
                        <span style={{ color: b.status === "suspended" ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 12 }}>
                          {b.status === "suspended" ? "restricted" : "active"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: d.muted, whiteSpace: "nowrap", opacity: dim }}>{fmtDate(b.createdAt)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", position: "relative", textAlign: "right" }}>
                        {!canManage() ? <span style={{ color: d.muted }}>—</span> : (
                          <>
                            <button disabled={busy} onClick={() => setOpenMenuId(openMenuId === b.id ? "" : b.id)}
                              style={{ background: "transparent", border: `0.5px solid ${d.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 16, lineHeight: 1, cursor: "pointer", color: d.text }}>
                              ⋯
                            </button>
                            {openMenuId === b.id && (
                              <>
                                <div onClick={() => setOpenMenuId("")} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                                <div style={{ position: "absolute", right: 12, top: 40, zIndex: 50, background: d.surface, border: `0.5px solid ${d.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.18)", minWidth: 160, overflow: "hidden", paddingTop: 4, paddingBottom: 4 }}>
                                  <MenuItem label="Edit" onClick={() => startEdit(b)} />
                                  <MenuItem label={b.status === "suspended" ? "Unrestrict" : "Restrict"} onClick={() => toggleStatus(b)} />
                                  <MenuItem label="Delete" danger onClick={() => remove(b)} />
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editBiz && (
        <div onClick={() => setEditBiz(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "90vw", background: d.surface, color: d.text, borderRadius: 14, padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Edit workspace</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: d.muted }}>Owned by {editBiz.ownerEmail}</p>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 12, color: d.muted }}>Business name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginTop: 4, width: "100%", padding: "8px 10px", border: `0.5px solid ${d.border}`, borderRadius: 8, background: d.input, color: d.text, fontSize: 13, boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, color: d.muted }}>Country
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={{ marginTop: 4, width: "100%", padding: "8px 10px", border: `0.5px solid ${d.border}`, borderRadius: 8, background: d.input, color: d.text, fontSize: 13, boxSizing: "border-box" }} />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button disabled={busyId === editBiz.id || !form.name.trim()} onClick={saveEdit} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: busyId === editBiz.id || !form.name.trim() ? 0.6 : 1 }}>{busyId === editBiz.id ? "Saving…" : "Save"}</button>
                <button onClick={() => setEditBiz(null)} style={{ background: d.input, color: d.text, border: `0.5px solid ${d.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
