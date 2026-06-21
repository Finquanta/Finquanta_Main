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

  const canManage = (targetRole: string) => {
    if (myRole === "super_admin") return targetRole !== "super_admin";
    if (myRole === "admin") return targetRole === "user";
    return false;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.email, u.company, u.country, u.industry, u.role].some((f) => (f || "").toLowerCase().includes(q)));
  }, [users, query]);

  const act = async (fn: () => Promise<void>, id: string) => {
    setBusyId(id);
    setError(null);
    try { await fn(); await load(); }
    catch (e) { const m = e instanceof Error ? e.message : "Action failed."; if (!bounceToLogin(m)) setError(m); }
    finally { setBusyId(""); }
  };

  const startEdit = (u: AdminUser) => {
    const [first, ...rest] = u.name.split(" ");
    setEditingId(u.id); setEditFirst(first || ""); setEditLast(rest.join(" "));
  };
  const saveEdit = (id: string) => act(() => updateAdminUser(id, { firstName: editFirst.trim(), lastName: editLast.trim() }).then(() => setEditingId("")), id);
  const setRole = (id: string, role: string) => act(() => updateAdminUser(id, { role }), id);
  const toggleStatus = (u: AdminUser) => act(() => updateAdminUser(u.id, { status: u.status === "suspended" ? "active" : "suspended" }), u.id);
  const remove = (u: AdminUser) => { if (window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) act(() => deleteAdminUser(u.id), u.id); };

  const logout = () => { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); router.push("/admin-login"); };

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7", surface: dark ? "#1e293b" : "#fff", border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a", muted: dark ? "#94a3b8" : "#6b7280", input: dark ? "#0f172a" : "#f9fafb", head: dark ? "#0f172a" : "#fafafa",
  };
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
  const roleBadge = (role: string) => {
    const map: Record<string, [string, string]> = { admin: ["#fee2e2", "#b91c1c"], super_admin: ["#fce7f3", "#be185d"], user: ["#f3f4f6", "#6b7280"] };
    const [bg, fg] = map[role] || map.user;
    return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{role === "super_admin" ? "owner" : role}</span>;
  };
  const btn = (bg: string) => ({ background: bg, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" });

  return (
    <div style={{ display: "flex", height: "100vh", background: d.bg, fontFamily: "sans-serif", fontSize: 14, color: d.text }}>
      {/* Sidebar */}
      <div style={{ width: 180, background: d.surface, borderRight: `0.5px solid ${d.border}`, display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 16px 20px" }}><img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 32, width: "auto" }} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: dark ? "#14532d33" : "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 13, borderRight: "2px solid #22c55e" }}>Users</div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "4px 16px", color: d.muted, fontSize: 11 }}>Signed in as <b>{myRole === "super_admin" ? "owner" : myRole || "…"}</b></div>
        <div onClick={() => setDark((v) => !v)} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>{dark ? "☀ Light mode" : "🌙 Dark mode"}</div>
        <div onClick={logout} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>Log Out</div>
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
                  {["Name", "Email", "Company", "Country", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: `0.5px solid ${d.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === myId;
                  const manage = !isSelf && canManage(u.role);
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: `0.5px solid ${d.border}`, opacity: u.status === "suspended" ? 0.55 : 1 }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {editingId === u.id ? (
                          <span style={{ display: "flex", gap: 6 }}>
                            <input value={editFirst} onChange={(e) => setEditFirst(e.target.value)} placeholder="First" style={{ width: 80, padding: "4px 6px", border: `0.5px solid ${d.border}`, borderRadius: 6, background: d.input, color: d.text }} />
                            <input value={editLast} onChange={(e) => setEditLast(e.target.value)} placeholder="Last" style={{ width: 80, padding: "4px 6px", border: `0.5px solid ${d.border}`, borderRadius: 6, background: d.input, color: d.text }} />
                          </span>
                        ) : (<>{u.name}{isSelf && <span style={{ color: d.muted, fontWeight: 400 }}> (you)</span>}</>)}
                      </td>
                      <td style={{ padding: "10px 12px", color: d.muted }}>{u.email}</td>
                      <td style={{ padding: "10px 12px" }}>{u.company || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{u.country || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {myRole === "super_admin" && manage ? (
                          <select value={u.role} disabled={busy} onChange={(e) => setRole(u.id, e.target.value)}
                            style={{ padding: "4px 6px", border: `0.5px solid ${d.border}`, borderRadius: 6, background: d.input, color: d.text, fontSize: 12 }}>
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="super_admin">owner</option>
                          </select>
                        ) : roleBadge(u.role)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: u.status === "suspended" ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 12 }}>{u.status === "suspended" ? "restricted" : "active"}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: d.muted, whiteSpace: "nowrap" }}>{fmtDate(u.joinedAt)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        {!manage ? <span style={{ color: d.muted, fontSize: 12 }}>—</span> : editingId === u.id ? (
                          <span style={{ display: "flex", gap: 6 }}>
                            <button disabled={busy} onClick={() => saveEdit(u.id)} style={btn("#16a34a")}>Save</button>
                            <button disabled={busy} onClick={() => setEditingId("")} style={btn("#6b7280")}>Cancel</button>
                          </span>
                        ) : (
                          <span style={{ display: "flex", gap: 6 }}>
                            <button disabled={busy} onClick={() => startEdit(u)} style={btn("#2563eb")}>Edit</button>
                            <button disabled={busy} onClick={() => toggleStatus(u)} style={btn(u.status === "suspended" ? "#16a34a" : "#d97706")}>{u.status === "suspended" ? "Unrestrict" : "Restrict"}</button>
                            <button disabled={busy} onClick={() => remove(u)} style={btn("#dc2626")}>Delete</button>
                          </span>
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
