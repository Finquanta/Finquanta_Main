"use client";

import { useRouter } from "next/navigation";
import { logoutAndRedirect } from "@/lib/auth";

type Tab = "users" | "blog" | "usage" | "playbook" | "audit" | "patch";

const NAV: { key: Tab; label: string; href: string }[] = [
  { key: "users", label: "Users", href: "/admin-users" },
  { key: "blog", label: "Blog", href: "/admin-blog" },
  { key: "usage", label: "API Usage", href: "/admin-usage" },
  { key: "audit", label: "Audit Logs", href: "/admin-audit" },
  { key: "patch", label: "Patch Notes", href: "/admin-patch-notes" },
  { key: "playbook", label: "Playbook", href: "/admin-playbook" },
];

/** Read the persisted admin dark-mode preference (call inside useEffect). */
export const readAdminDark = () => (typeof window !== "undefined" && localStorage.getItem("adminDark") === "1");
/** Persist the admin dark-mode preference. */
export const writeAdminDark = (v: boolean) => { if (typeof window !== "undefined") localStorage.setItem("adminDark", v ? "1" : "0"); };

export default function AdminSidebar({ active, dark, setDark }: { active: Tab; dark: boolean; setDark: (v: boolean) => void }) {
  const router = useRouter();
  const muted = dark ? "#94a3b8" : "#6b7280";
  const surface = dark ? "#1e293b" : "#fff";
  const border = dark ? "#334155" : "#e5e7eb";

  const logout = () => logoutAndRedirect("/admin-login");

  const toggleDark = () => { writeAdminDark(!dark); setDark(!dark); };

  return (
    <div style={{ width: 180, background: surface, borderRight: `0.5px solid ${border}`, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, height: "100vh" }}>
      <div style={{ padding: "0 16px 20px" }}>
        <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 32, width: "auto" }} />
      </div>

      {NAV.map((n) => {
        const on = n.key === active;
        return (
          <div
            key={n.key}
            onClick={() => { if (!on) router.push(n.href); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13,
              cursor: on ? "default" : "pointer",
              ...(on
                ? { background: dark ? "#14532d33" : "#f0fdf4", color: "#16a34a", fontWeight: 600, borderRight: "2px solid #22c55e" }
                : { color: muted }),
            }}
          >
            {n.label}
          </div>
        );
      })}

      <a
        href="https://airtable.com/appvpi5gHRidiIhw8/tbldacFlsstOnow6j/viwChC133lPy3TU55?blocks=hide"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", padding: "9px 16px", fontSize: 13, color: muted, textDecoration: "none", cursor: "pointer" }}
      >
        Feedback
      </a>

      <div style={{ flex: 1 }} />
      <div onClick={toggleDark} style={{ padding: "9px 16px", color: muted, fontSize: 13, cursor: "pointer" }}>{dark ? "☀ Light mode" : "🌙 Dark mode"}</div>
      <div onClick={logout} style={{ padding: "9px 16px", color: muted, fontSize: 13, cursor: "pointer" }}>Log Out</div>
      <div style={{ padding: "8px 16px 0", color: muted, fontSize: 11 }}>Version 1.3.0</div>
    </div>
  );
}
