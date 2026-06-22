"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUser, listAdminUsers, checkAdmin, updateAdminUser, deleteAdminUser } from "@/lib/api/admin";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [myId, setMyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [openMenuId, setOpenMenuId] = useState<string>("");
  const [editingId, setEditingId] = useState<string>("");
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");

  const bounceToLogin = (msg: string) => {
    if (/admin access|authentication|session|401|403/i.test(msg)) { router.replace("/admin-login"); return true; }
    return false;
  };

  const load = () =>
    listAdminUsers()
      .then((data) => setUsers(data))
      .catch((e) => { const m = e instanceof Error ? e.message : ""; if (!bounceToLogin(m)) setError(m || "Could not load users."); });

  useEffect(() => {
    checkAdmin()
      .then((me) => { setMyRole(me.role); setMyId(me.id); return load(); })
      .catch((e) => { if (!bounceToLogin(e instanceof Error ? e.message : "")) router.replace("/admin-login"); })
      .finally(() => setLoading(false));
  }, [router]);

  // Capability matrix (mirrors the backend). Internal rank: user<admin<super_admin<owner,
  // shown as User < Moderator (admin) < Admin (super_admin) < Owner.
  // - Owner: edit/restrict/delete anyone; assign any role.
  // - Admin (super_admin): manage Moderators & Users (rank<=1); promote/demote User<->Moderator only.
  // - Moderator (admin): edit/restrict Users only.
  const rank = (r: string) => ({ user: 0, admin: 1, super_admin: 2, owner: 3 } as Record<string, number>)[r] ?? 0;
  const canRestrict = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1) || (myRole === "admin" && t === "user");
  const canDelete = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1);
  const canEditName = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1) || (myRole === "admin" && t === "user");
  // Assign `newRole` to a `targetRole` account. Owner: anything. Admin: only set
  // Users/Moderators to User or Moderator (can't create Admins/Owners).
  const canAssign = (targetRole: string, newRole: string) =>
    myRole === "owner" || (myRole === "super_admin" && rank(targetRole) <= 1 && rank(newRole) <= 1);
  const canManage = (t: string) => canRestrict(t) || canDelete(t) || canEditName(t);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.email, u.company, u.country, u.industry, u.role].some((f) => (f || "").toLowerCase().includes(q)));
  }, [users, query]);

  const act = async (fn: () => Promise<void>, id: string) => {
    setBusyId(id); setError(null); setOpenMenuId("");
    try { await fn(); await load(); }
    catch (e) { const m = e instanceof Error ? e.message : "Action failed."; if (!bounceToLogin(m)) setError(m); }
    finally { setBusyId(""); }
  };

  const startEdit = (u: AdminUser) => { const [first, ...rest] = u.name.split(" "); setEditingId(u.id); setEditFirst(first || ""); setEditLast(rest.join(" ")); setOpenMenuId(""); };
  const saveEdit = (id: string) => act(() => updateAdminUser(id, { firstName: editFirst.trim(), lastName: editLast.trim() }).then(() => setEditingId("")), id);
  const setRole = (id: string, role: string) => act(() => updateAdminUser(id, { role }), id);
  const toggleStatus = (u: AdminUser) => act(() => updateAdminUser(u.id, { status: u.status === "suspended" ? "active" : "suspended" }), u.id);
  const remove = (u: AdminUser) => { if (window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) act(() => deleteAdminUser(u.id), u.id); };

  const logout = () => { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); router.push("/admin-login"); };

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7", surface: dark ? "#1e293b" : "#fff", border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a", muted: dark ? "#94a3b8" : "#6b7280", input: dark ? "#0f172a" : "#f9fafb",
    head: dark ? "#0f172a" : "#fafafa", menuHover: dark ? "#334155" : "#f3f4f6",
  };
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
  // Display names: internal keys stay (user<admin<super_admin<owner), but the UI
  // shows Owner > Admin (super_admin) > Moderator (admin) > User.
  const roleLabel = (role: string) =>
    (({ owner: "Owner", super_admin: "Admin", admin: "Moderator", user: "User" } as Record<string, string>)[role] || role);
  const roleBadge = (role: string) => {
    const map: Record<string, [string, string]> = { admin: ["#dbeafe", "#1e40af"], super_admin: ["#f3e8ff", "#6b21a8"], owner: ["#fce7f3", "#be185d"], user: ["#f3f4f6", "#6b7280"] };
    const [bg, fg] = map[role] || map.user;
    return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{roleLabel(role)}</span>;
  };

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

  return (
    <div style={{ display: "flex", height: "100vh", background: d.bg, fontFamily: "sans-serif", fontSize: 14, color: d.text }}>
      {/* Sidebar */}
      <div style={{ width: 180, background: d.surface, borderRight: `0.5px solid ${d.border}`, display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 16px 20px" }}><img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 32, width: "auto" }} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: dark ? "#14532d33" : "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 13, borderRight: "2px solid #22c55e" }}>Users</div>
        <div style={{ flex: 1 }} />
        <div onClick={() => setDark((v) => !v)} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>{dark ? "☀ Light mode" : "🌙 Dark mode"}</div>
        <div onClick={logout} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>Log Out</div>
        <div style={{ padding: "8px 16px 0", color: d.muted, fontSize: 11 }}>Version 1.0.0.0</div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px", borderBottom: `0.5px solid ${d.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Users</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: d.muted }}>{loading ? "Loading…" : `${users.length} total`}</p>
          </div>
          <input placeholder="Search name, email, company…" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ width: 300, padding: "8px 12px", border: `0.5px solid ${d.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: d.input, color: d.text }} />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 28px" }}>
          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
          {loading ? <p style={{ color: d.muted, fontSize: 13 }}>Loading users…</p> : filtered.length === 0 ? <p style={{ color: d.muted, fontSize: 13 }}>No users found.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: d.muted, background: d.head }}>
                  {["Name", "Email", "Company", "Country", "Role", "Status", "Joined", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: `0.5px solid ${d.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === myId;
                  // You can always edit your own name; role/restrict/delete on
                  // yourself stay blocked so you can't lock yourself out.
                  const manage = isSelf || canManage(u.role);
                  const busy = busyId === u.id;
                  // Dim only the content cells for restricted accounts — never the
                  // actions cell, or its dropdown would inherit the low opacity
                  // (CSS opacity on a parent caps its children) and look transparent.
                  const dim = u.status === "suspended" ? 0.55 : 1;
                  return (
                    <tr key={u.id} style={{ borderBottom: `0.5px solid ${d.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, opacity: dim }}>
                        {editingId === u.id ? (
                          <span style={{ display: "flex", gap: 6 }}>
                            <input value={editFirst} onChange={(e) => setEditFirst(e.target.value)} placeholder="First" style={{ width: 80, padding: "4px 6px", border: `0.5px solid ${d.border}`, borderRadius: 6, background: d.input, color: d.text }} />
                            <input value={editLast} onChange={(e) => setEditLast(e.target.value)} placeholder="Last" style={{ width: 80, padding: "4px 6px", border: `0.5px solid ${d.border}`, borderRadius: 6, background: d.input, color: d.text }} />
                          </span>
                        ) : (<>{u.name}{isSelf && <span style={{ color: d.muted, fontWeight: 400 }}> (you)</span>}</>)}
                      </td>
                      <td style={{ padding: "10px 12px", color: d.muted, opacity: dim }}>{u.email}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{u.company || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{u.country || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{roleBadge(u.role)}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>
                        <span style={{ color: u.status === "suspended" ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 12 }}>{u.status === "suspended" ? "restricted" : "active"}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: d.muted, whiteSpace: "nowrap", opacity: dim }}>{fmtDate(u.joinedAt)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", position: "relative", textAlign: "right" }}>
                        {editingId === u.id ? (
                          <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button disabled={busy} onClick={() => saveEdit(u.id)} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                            <button disabled={busy} onClick={() => setEditingId("")} style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                          </span>
                        ) : !manage ? <span style={{ color: d.muted }}>—</span> : (
                          <>
                            <button disabled={busy} onClick={() => setOpenMenuId(openMenuId === u.id ? "" : u.id)}
                              style={{ background: "transparent", border: `0.5px solid ${d.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 16, lineHeight: 1, cursor: "pointer", color: d.text }}>
                              ⋯
                            </button>
                            {openMenuId === u.id && (
                              <>
                                <div onClick={() => setOpenMenuId("")} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                                <div style={{ position: "absolute", right: 12, top: 40, zIndex: 50, background: d.surface, border: `0.5px solid ${d.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.18)", minWidth: 160, overflow: "hidden", paddingTop: 4, paddingBottom: 4 }}>
                                  {(isSelf || canEditName(u.role)) && <MenuItem label="Edit name" onClick={() => startEdit(u)} />}
                                  {!isSelf && u.role !== "user" && canAssign(u.role, "user") && <MenuItem label={`Remove ${roleLabel(u.role)}`} onClick={() => setRole(u.id, "user")} />}
                                  {!isSelf && u.role !== "admin" && canAssign(u.role, "admin") && <MenuItem label={`Make ${roleLabel("admin")}`} onClick={() => setRole(u.id, "admin")} />}
                                  {!isSelf && u.role !== "super_admin" && canAssign(u.role, "super_admin") && <MenuItem label={`Make ${roleLabel("super_admin")}`} onClick={() => setRole(u.id, "super_admin")} />}
                                  {!isSelf && u.role !== "owner" && canAssign(u.role, "owner") && <MenuItem label={`Make ${roleLabel("owner")}`} onClick={() => setRole(u.id, "owner")} />}
                                  {!isSelf && canRestrict(u.role) && <MenuItem label={u.status === "suspended" ? "Unrestrict" : "Restrict"} onClick={() => toggleStatus(u)} />}
                                  {!isSelf && canDelete(u.role) && <MenuItem label="Delete" danger onClick={() => remove(u)} />}
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
    </div>
  );
}
