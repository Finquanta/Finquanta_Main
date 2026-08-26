"use client";

import { useRouter } from "next/navigation";
import { logoutAndRedirect } from "@/lib/auth";
import { ADMIN_VERSION } from "@/lib/version";

type Tab = "overview" | "users" | "businesses" | "blog" | "usage" | "playbook" | "audit" | "patch" | "referrals" | "notifications" | "deletions";

/**
 * Grouped rather than one long list of eleven.
 *
 * The order was already meaningful — people, then things you send, then
 * records — but nothing showed it, so every visit meant reading all eleven
 * labels to find the one you wanted. A hairline between groups is enough to
 * make it three short lists instead, and costs two pixels each.
 */
const NAV: { key: Tab; label: string; href: string; group: number }[] = [
  { key: "overview", label: "Overview", href: "/admin-overview", group: 0 },
  { key: "users", label: "Users", href: "/admin-users", group: 0 },
  // Directly under Users: business data used to be columns on that tab, where
  // joining it duplicated every owner of more than one workspace.
  { key: "businesses", label: "Workspaces", href: "/admin-businesses", group: 0 },
  // Beside Users and Workspaces, because it answers a question about them: the
  // accounts that USED to be there. Not folded into Audit Logs — that records
  // admin actions only, so self-closed accounts never appeared in it.
  { key: "deletions", label: "Deletions", href: "/admin-deletions", group: 0 },

  { key: "notifications", label: "Notifications", href: "/admin-notifications", group: 1 },
  { key: "referrals", label: "Referrals", href: "/admin-referrals", group: 1 },
  { key: "blog", label: "Blog", href: "/admin-blog", group: 1 },
  { key: "patch", label: "Patch Notes", href: "/admin-patch-notes", group: 1 },

  { key: "usage", label: "API Usage", href: "/admin-usage", group: 2 },
  { key: "audit", label: "Audit Logs", href: "/admin-audit", group: 2 },
  { key: "playbook", label: "Playbook", href: "/admin-playbook", group: 2 },
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
  const hover = dark ? "#33415555" : "#f3f4f6";

  const logout = () => logoutAndRedirect("/admin-login");
  const toggleDark = () => { writeAdminDark(!dark); setDark(!dark); };

  return (
    <div
      className="admin-nav"
      style={{ width: 172, background: surface, borderRight: `0.5px solid ${border}`, display: "flex", flexDirection: "column", padding: "16px 0 10px", flexShrink: 0, height: "100vh" }}
    >
      {/*
        Hover needs a stylesheet — inline styles cannot express a pseudo-class,
        and the alternative is per-row mouse-enter state on every one of eleven
        rows. Scoped to .admin-nav so it cannot reach the pages themselves.
      */}
      <style>{`
        .admin-nav .nav-row {
          display: flex; align-items: center; gap: 8px;
          margin: 0 8px; padding: 5px 10px; border-radius: 6px;
          font-size: 12.5px; line-height: 1.35; cursor: pointer;
          transition: background-color .12s ease, color .12s ease;
          text-decoration: none; white-space: nowrap;
        }
        .admin-nav .nav-row:hover { background: ${hover}; }
        .admin-nav .nav-row.on { cursor: default; font-weight: 600; }
        .admin-nav .nav-row.on:hover { background: ${dark ? "#14532d40" : "#f0fdf4"}; }
        .admin-nav .nav-sep { height: 1px; margin: 6px 16px; background: ${border}; }
      `}</style>

      <div style={{ padding: "0 14px 14px" }}>
        <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 26, width: "auto" }} />
      </div>

      {NAV.map((n, i) => {
        const on = n.key === active;
        // A hairline wherever the group changes — never above the first row.
        const sep = i > 0 && NAV[i - 1].group !== n.group;
        return (
          <div key={n.key}>
            {sep && <div className="nav-sep" />}
            <div
              className={`nav-row${on ? " on" : ""}`}
              onClick={() => { if (!on) router.push(n.href); }}
              style={on
                ? { background: dark ? "#14532d40" : "#f0fdf4", color: "#16a34a" }
                : { color: muted }}
            >
              {/*
                The active marker is a dot inside the row rather than the old
                2px border on the sidebar's right edge — that stripe sat
                outside the highlight and detached from it once the highlight
                gained corners. A slot is kept on every row so labels stay on
                one left edge whether or not they are selected.
              */}
              <span style={{ width: 4, height: 4, borderRadius: "50%", flexShrink: 0, background: on ? "#22c55e" : "transparent" }} />
              {n.label}
            </div>
          </div>
        );
      })}

      <div className="nav-sep" />

      <a
        className="nav-row"
        href="https://airtable.com/appvpi5gHRidiIhw8/tbldacFlsstOnow6j/viwChC133lPy3TU55?blocks=hide"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: muted }}
      >
        <span style={{ width: 4, flexShrink: 0 }} />
        Feedback
      </a>

      <div style={{ flex: 1 }} />

      <div className="nav-row" onClick={toggleDark} style={{ color: muted }}>
        <span style={{ width: 4, flexShrink: 0 }} />
        {dark ? "☀ Light mode" : "🌙 Dark mode"}
      </div>
      <div className="nav-row" onClick={logout} style={{ color: muted }}>
        <span style={{ width: 4, flexShrink: 0 }} />
        Log Out
      </div>
      {/* Tracks separately from the dashboard's number — see lib/version.ts. */}
      <div style={{ padding: "6px 18px 0", color: muted, fontSize: 10.5, opacity: .8 }}>Version {ADMIN_VERSION}</div>
    </div>
  );
}
