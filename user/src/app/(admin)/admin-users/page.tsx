"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUser, listAdminUsers } from "@/lib/api/admin";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    listAdminUsers()
      .then((data) => setUsers(data))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        // Not logged in or not an admin → back to admin login.
        if (/admin access|authentication|session|401|403/i.test(msg)) {
          router.replace("/admin-login");
        } else {
          setError(msg || "Could not load users.");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.company, u.country, u.industry, u.role].some((f) => (f || "").toLowerCase().includes(q))
    );
  }, [users, query]);

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    router.push("/admin-login");
  };

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    surface: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    input: dark ? "#0f172a" : "#f9fafb",
    head: dark ? "#0f172a" : "#fafafa",
  };

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
  const roleBadge = (role: string) => {
    const map: Record<string, [string, string]> = {
      admin: ["#fee2e2", "#b91c1c"], super_admin: ["#fce7f3", "#be185d"], user: ["#f3f4f6", "#6b7280"],
    };
    const [bg, fg] = map[role] || map.user;
    return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>{role}</span>;
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: d.bg, fontFamily: "sans-serif", fontSize: 14, color: d.text }}>
      {/* Sidebar */}
      <div style={{ width: 180, background: d.surface, borderRight: `0.5px solid ${d.border}`, display: "flex", flexDirection: "column", padding: "20px 0" }}>
        <div style={{ padding: "0 16px 20px" }}>
          <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 32, width: "auto" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: dark ? "#14532d33" : "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: 13, borderRight: "2px solid #22c55e" }}>
          Users
        </div>
        <div style={{ flex: 1 }} />
        <div onClick={() => setDark((v) => !v)} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>
          {dark ? "☀ Light mode" : "🌙 Dark mode"}
        </div>
        <div onClick={logout} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>
          Log Out
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px", borderBottom: `0.5px solid ${d.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Users</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: d.muted }}>{loading ? "Loading…" : `${users.length} total`}</p>
          </div>
          <input
            placeholder="Search name, email, company, country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 320, padding: "8px 12px", border: `0.5px solid ${d.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: d.input, color: d.text }}
          />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 28px" }}>
          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
          {loading ? (
            <p style={{ color: d.muted, fontSize: 13 }}>Loading users…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: d.muted, fontSize: 13 }}>No users found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: d.muted, background: d.head }}>
                  {["Name", "Email", "Company", "Country", "Industry", "Role", "Joined"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: `0.5px solid ${d.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ borderBottom: `0.5px solid ${d.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: "10px 12px", color: d.muted }}>{u.email}</td>
                    <td style={{ padding: "10px 12px" }}>{u.company || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{u.country || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{u.industry || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{roleBadge(u.role)}</td>
                    <td style={{ padding: "10px 12px", color: d.muted, whiteSpace: "nowrap" }}>{fmtDate(u.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
