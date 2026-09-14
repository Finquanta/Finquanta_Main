"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, FlaskConical, Trash2, Bell, Gift, Newspaper, ScrollText,
  BarChart3, FileClock, BookOpen, MessageSquare, Sun, Moon, LogOut, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { parseHost } from "@/lib/hosts";
import { logoutAndRedirect } from "@/lib/auth";
import { ADMIN_VERSION } from "@/lib/version";
import NavTooltip from "@/components/ui/NavTooltip";
import { useSidebarCollapsed, ADMIN_SIDEBAR_KEY } from "@/hooks/useSidebarCollapsed";

type Tab = "overview" | "users" | "businesses" | "beta" | "blog" | "usage" | "playbook" | "audit" | "patch" | "referrals" | "notifications" | "deletions";

/**
 * Grouped rather than one long list of eleven.
 *
 * The order was already meaningful — people, then things you send, then
 * records — but nothing showed it, so every visit meant reading all eleven
 * labels to find the one you wanted. A hairline between groups is enough to
 * make it three short lists instead, and costs two pixels each.
 */
const NAV: { key: Tab; label: string; href: string; group: number; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", href: "/admin-overview", group: 0, icon: LayoutDashboard },
  { key: "users", label: "Users", href: "/admin-users", group: 0, icon: Users },
  // Directly under Users: business data used to be columns on that tab, where
  // joining it duplicated every owner of more than one workspace.
  { key: "businesses", label: "Workspaces", href: "/admin-businesses", group: 0, icon: Building2 },
  // The workspaces cloned into beta.finquanta.ai.
  { key: "beta", label: "Beta", href: "/admin-beta", group: 0, icon: FlaskConical },
  // Beside Users and Workspaces, because it answers a question about them: the
  // accounts that USED to be there. Not folded into Audit Logs — that records
  // admin actions only, so self-closed accounts never appeared in it.
  { key: "deletions", label: "Deletions", href: "/admin-deletions", group: 0, icon: Trash2 },

  { key: "notifications", label: "Notifications", href: "/admin-notifications", group: 1, icon: Bell },
  { key: "referrals", label: "Referrals", href: "/admin-referrals", group: 1, icon: Gift },
  { key: "blog", label: "Blog", href: "/admin-blog", group: 1, icon: Newspaper },
  { key: "patch", label: "Patch Notes", href: "/admin-patch-notes", group: 1, icon: ScrollText },

  { key: "usage", label: "API Usage", href: "/admin-usage", group: 2, icon: BarChart3 },
  { key: "audit", label: "Audit Logs", href: "/admin-audit", group: 2, icon: FileClock },
  { key: "playbook", label: "Playbook", href: "/admin-playbook", group: 2, icon: BookOpen },
];

/** Read the persisted admin dark-mode preference (call inside useEffect). */
export const readAdminDark = () => (typeof window !== "undefined" && localStorage.getItem("adminDark") === "1");
/** Persist the admin dark-mode preference. */
export const writeAdminDark = (v: boolean) => { if (typeof window !== "undefined") localStorage.setItem("adminDark", v ? "1" : "0"); };

export default function AdminSidebar({ active, dark, setDark }: { active: Tab; dark: boolean; setDark: (v: boolean) => void }) {
  const router = useRouter();
  // beta. is the test copy; say so, so nobody mistakes it for the real panel.
  const [isBeta, setIsBeta] = useState(false);
  useEffect(() => { setIsBeta(parseHost(window.location.host).kind === "beta"); }, []);
  // Collapses to a 72px icon rail, remembered on this device separately from
  // the app sidebar.
  const { collapsed, toggle, animate } = useSidebarCollapsed(ADMIN_SIDEBAR_KEY);
  const muted = dark ? "#94a3b8" : "#6b7280";
  const surface = dark ? "#1e293b" : "#fff";
  const border = dark ? "#334155" : "#e5e7eb";
  const hover = dark ? "#33415555" : "#f3f4f6";

  const logout = () => logoutAndRedirect("/admin-login");
  const toggleDark = () => { writeAdminDark(!dark); setDark(!dark); };
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  /** A label that stays readable to screen readers when only the icon shows. */
  const label = (text: string) => <span className={collapsed ? "sr-only" : undefined}>{text}</span>;

  return (
    <div
      id="admin-sidebar"
      className={`admin-nav${collapsed ? " collapsed" : ""}`}
      style={{
        width: collapsed ? 72 : 172, background: surface, borderRight: `0.5px solid ${border}`,
        display: "flex", flexDirection: "column", padding: "16px 0 10px", flexShrink: 0, height: "100vh",
        transition: animate ? "width .2s ease" : undefined,
      }}
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
        .admin-nav.collapsed .nav-row { justify-content: center; padding: 7px 0; }
        .admin-nav .nav-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px; border: 0; border-radius: 6px; background: transparent;
          color: ${muted}; cursor: pointer;
        }
        .admin-nav .nav-btn:hover { background: ${hover}; }
        @media (prefers-reduced-motion: reduce) { .admin-nav { transition: none !important; } }
      `}</style>

      <div style={collapsed
        ? { padding: "0 0 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }
        : { padding: "0 10px 14px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: collapsed ? "center" : "flex-start" }}>
          {/* The F mark stands in for the wordmark on the icon rail. */}
          <img src={collapsed ? "/favicon.svg" : "/images/finquanta_logo.svg"} alt="Finquanta" style={{ height: 26, width: "auto" }} />
          {/* Admin stays English, so a plain label rather than the dashboard's BetaChip. */}
          {isBeta && (
            <span style={{
              marginTop: 6, display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "2px 8px",
              fontSize: 10, fontWeight: 600, lineHeight: 1.2,
              border: `1px solid ${dark ? "#166534" : "#bbf7d0"}`,
              background: dark ? "#14532d40" : "#dcfce7", color: dark ? "#86efac" : "#15803d",
            }}>
              Beta
            </span>
          )}
        </div>
        <button
          type="button"
          className="nav-btn"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="admin-sidebar"
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
        </button>
      </div>

      {NAV.map((n, i) => {
        const on = n.key === active;
        // A hairline wherever the group changes — never above the first row.
        const sep = i > 0 && NAV[i - 1].group !== n.group;
        const Icon = n.icon;
        return (
          <div key={n.key}>
            {sep && <div className="nav-sep" />}
            <NavTooltip label={n.label} show={collapsed} lgOnly={false}>
              <div
                className={`nav-row${on ? " on" : ""}`}
                onClick={() => { if (!on) router.push(n.href); }}
                style={on
                  ? { background: dark ? "#14532d40" : "#f0fdf4", color: "#16a34a" }
                  : { color: muted }}
              >
                {/* The icon took over from the old active dot: it keeps every
                    label on one left edge, and the green row marks the tab. */}
                <Icon size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                {label(n.label)}
              </div>
            </NavTooltip>
          </div>
        );
      })}

      <div className="nav-sep" />

      <NavTooltip label="Feedback" show={collapsed} lgOnly={false}>
        <a
          className="nav-row"
          href="https://airtable.com/appvpi5gHRidiIhw8/tbldacFlsstOnow6j/viwChC133lPy3TU55?blocks=hide"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: muted }}
        >
          <MessageSquare size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
          {label("Feedback")}
        </a>
      </NavTooltip>

      <div style={{ flex: 1 }} />

      <NavTooltip label={dark ? "Light mode" : "Dark mode"} show={collapsed} lgOnly={false}>
        <div className="nav-row" onClick={toggleDark} style={{ color: muted }}>
          {dark ? <Sun size={15} aria-hidden="true" style={{ flexShrink: 0 }} /> : <Moon size={15} aria-hidden="true" style={{ flexShrink: 0 }} />}
          {label(dark ? "Light mode" : "Dark mode")}
        </div>
      </NavTooltip>
      <NavTooltip label="Log Out" show={collapsed} lgOnly={false}>
        <div className="nav-row" onClick={logout} style={{ color: muted }}>
          <LogOut size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
          {label("Log Out")}
        </div>
      </NavTooltip>
      {/* Tracks separately from the dashboard's number — see lib/version.ts. */}
      {!collapsed && (
        <div style={{ padding: "6px 18px 0", color: muted, fontSize: 10.5, opacity: .8 }}>Version {ADMIN_VERSION}</div>
      )}
    </div>
  );
}
