"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const MOCK_USERS = [
  { id: 1, name: "Mickey Mike", company: "MM Real Estate", date: "May 1, 2024", plan: "Entrepreneur", country: "USA", city: "Florida", email: "mickey@mmre.com", role: "CEO", linkedin: "" },
  { id: 2, name: "Mickey Mike", company: "MM Real Estate", date: "May 1, 2024", plan: "Business", country: "China", city: "Hong Kong", email: "mickey2@mmre.com", role: "Director", linkedin: "" },
  { id: 3, name: "Mickey Mike", company: "MM Real Estate", date: "May 1, 2024", plan: "Corporate", country: "India", city: "Mumbai", email: "mickey3@mmre.com", role: "Manager", linkedin: "" },
  { id: 4, name: "Mickey Mike", company: "MM Real Estate", date: "May 1, 2024", plan: "Free", country: "Jamaica", city: "Kingston", email: "mickey4@mmre.com", role: "Analyst", linkedin: "" },
];

const planColors: Record<string, string> = {
  Entrepreneur: "#fff7ed", Business: "#dbeafe", Corporate: "#f3e8ff", Free: "#f3f4f6",
};
const planText: Record<string, string> = {
  Entrepreneur: "#c2410c", Business: "#1e40af", Corporate: "#6b21a8", Free: "#6b7280",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState(MOCK_USERS);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [dark, setDark] = useState(false);

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    surface: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    input: dark ? "#0f172a" : "#f9fafb",
    rowHover: dark ? "#1e293b" : "#fafafa",
    editBg: dark ? "#162032" : "#f0fdf4",
    editBorder: dark ? "#22c55e33" : "#bbf7d0",
  };

  const startEdit = (id: number) => {
    setEditData({ ...users.find(u => u.id === id) });
    setEditingId(id);
    setOpenDropdown(null);
  };

  const saveEdit = (id: number) => {
    setUsers(users.map(u => u.id === id ? { ...u, ...editData } : u));
    setEditingId(null);
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
        <div style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>
          Help
        </div>
        <div onClick={() => router.push("/admin-login")} style={{ padding: "9px 16px", color: d.muted, fontSize: 13, cursor: "pointer" }}>
          Log Out
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ background: d.surface, borderBottom: `0.5px solid ${d.border}`, padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: dark ? "#14532d33" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#16a34a" }}>AD</div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Admin</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input placeholder="Search..." style={{ width: 220, background: d.input, border: `0.5px solid ${d.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, outline: "none", color: d.text }} />
            <button
              onClick={() => setDark(!dark)}
              style={{ background: dark ? "#334155" : "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: d.text, fontWeight: 500 }}>
              {dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[["Total Users", users.length], ["Total Accounts", users.length]].map(([label, val]) => (
              <div key={label as string} style={{ background: d.surface, border: `0.5px solid ${d.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: d.muted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: d.surface, border: `0.5px solid ${d.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `0.5px solid ${d.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Users</span>
              <input placeholder="Search..." style={{ background: d.input, border: `0.5px solid ${d.border}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, outline: "none", color: d.text }} />
            </div>

            {users.map(u => (
              <div key={u.id}>
                <div style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: `0.5px solid ${d.border}`, position: "relative" }}
                  onClick={() => openDropdown && setOpenDropdown(null)}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: dark ? "#14532d33" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#16a34a", marginRight: 10, flexShrink: 0 }}>
                    {u.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: d.muted }}>{u.company}</div>
                  </div>
                  <div style={{ width: 110, fontSize: 12, color: d.muted }}>{u.date}</div>
                  <div style={{ width: 90 }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: planColors[u.plan], color: planText[u.plan] }}>{u.plan}</span>
                  </div>
                  <div style={{ width: 90, fontSize: 12, color: d.muted }}>
                    {u.country}<br />
                    <span style={{ fontSize: 11, color: d.muted }}>{u.city}</span>
                  </div>
                  <div style={{ width: 80, display: "flex", justifyContent: "flex-end", position: "relative" }}>
                    <button onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === u.id ? null : u.id); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: dark ? "#14532d33" : "#f0fdf4", border: `0.5px solid ${dark ? "#166534" : "#bbf7d0"}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#16a34a", fontWeight: 600 }}>
                      Modify ▾
                    </button>
                    {openDropdown === u.id && (
                      <div style={{ position: "absolute", right: 0, top: 32, background: d.surface, border: `0.5px solid ${d.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", width: 130, zIndex: 100 }}>
                        <div onClick={() => startEdit(u.id)} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", color: d.text }}>Edit</div>
                        <div onClick={() => setOpenDropdown(null)} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", color: d.text }}>Restrict</div>
                        <div onClick={() => setOpenDropdown(null)} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", color: "#dc2626" }}>Delete</div>
                      </div>
                    )}
                  </div>
                </div>

                {editingId === u.id && (
                  <div style={{ background: d.editBg, borderTop: `0.5px solid ${d.editBorder}`, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[["Full Name","name"],["Company","company"],["Email","email"],["Role","role"],["Country","country"],["City","city"],["LinkedIn","linkedin"]].map(([lbl, key]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: d.muted, display: "block", marginBottom: 3 }}>{lbl}</label>
                        <input value={editData[key] || ""} onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                          style={{ width: "100%", background: d.surface, border: `0.5px solid ${d.editBorder}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, outline: "none", color: d.text }} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize: 11, color: d.muted, display: "block", marginBottom: 3 }}>Plan</label>
                      <select value={editData.plan} onChange={e => setEditData({ ...editData, plan: e.target.value })}
                        style={{ width: "100%", background: d.surface, border: `0.5px solid ${d.editBorder}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, outline: "none", color: d.text }}>
                        {["Free","Entrepreneur","Business","Corporate"].map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                      <button onClick={() => setEditingId(null)} style={{ background: d.surface, color: d.muted, border: `0.5px solid ${d.border}`, borderRadius: 6, padding: "5px 16px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => saveEdit(u.id)} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, padding: "5px 16px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Save Changes</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "10px 16px", gap: 8, fontSize: 12, color: d.muted, borderTop: `0.5px solid ${d.border}` }}>
              <span>Items per page: 10</span>
              <span style={{ marginLeft: 12 }}>1–{users.length} of {users.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}