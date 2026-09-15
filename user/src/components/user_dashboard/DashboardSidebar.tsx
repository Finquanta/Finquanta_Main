"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X, MessageSquare, LogOut, PanelLeftClose, PanelLeftOpen,
  Brain, LayoutDashboard, FileText, Users, Activity, Layers, Gift, Settings, Shield,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { getMe, finquantaAccountId } from "@/lib/api/me";
import { checkAdmin } from "@/lib/api/admin";
import { logoutAndRedirect } from "@/lib/auth";
import MaintenanceChip from "./MaintenanceChip";
import BetaChip from "./BetaChip";
import { hrefFor } from "@/lib/hosts";
import PlanChip from "./PlanChip";
import VerifyEmailChip from "./VerifyEmailChip";
import PhoneChip from "./PhoneChip";
import { DASHBOARD_VERSION } from "@/lib/version";
import NavTooltip from "@/components/ui/NavTooltip";
import { useSidebarCollapsed, APP_SIDEBAR_KEY } from "@/hooks/useSidebarCollapsed";

const FEEDBACK_FORM = "https://airtable.com/appvpi5gHRidiIhw8/pagLtSSYVhxqHrWFk/form";

export interface SidebarNavItem {
  href: string;
  labelKey?: string;
  label?: string;
  /** Beside the label, and on its own when the sidebar is collapsed. */
  icon?: LucideIcon;
  /** A [data-tour] anchor the dashboard tour spotlights. */
  tour?: string;
}

export const DASHBOARD_NAV: SidebarNavItem[] = [
  // `label` is the English fallback the renderer uses when labelKey is absent —
  // every item carries a key now, so the sidebar translates like the rest of the
  // dashboard instead of staying English in all ten languages.
  { href: "/brain", labelKey: "brainTitle", label: "Company Brain", icon: Brain },
  // The Council is deliberately NOT here — it lives inside the Finna widget,
  // which is reachable from every product page. /council still exists as the
  // full-transcript destination the widget links to.
  { href: "/dashboard", labelKey: "title", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", labelKey: "invoices", label: "Invoices", icon: FileText },
  { href: "/customers", labelKey: "customers", label: "Customers", icon: Users },
  { href: "/activity", labelKey: "activity", label: "Activity", icon: Activity, tour: "activity" },
  { href: "/groups", labelKey: "groups", label: "Groups", icon: Layers },
  { href: "/referrals", labelKey: "referAB", label: "Refer a Business", icon: Gift },
  { href: "/profile-settings", labelKey: "settings", label: "Settings", icon: Settings },
];

/**
 * The dashboard's left sidebar, shared by every page under (user_dashbord) —
 * the Dashboard page included, which used to build its own copy — so navigation
 * never disappears or drifts between pages. Static on desktop; an off-canvas
 * drawer on tablet/mobile.
 *
 * At lg and up it collapses to a 72px icon rail, remembered on this device.
 * Below lg the collapse is ignored: the drawer always shows labels.
 *
 * The Try-It Demo renders this same component so its shell is the real one
 * rather than a lookalike that drifts. It passes its own `items`, turns
 * `showAccount` off (an anonymous visitor has no account to call getMe/checkAdmin
 * for) and swaps Log Out for its own action via `footerAction`. Defaults keep
 * the signed-in usage exactly as it was.
 */
export default function DashboardSidebar({
  isDark, isOpen, onClose,
  items = DASHBOARD_NAV,
  showAccount = true,
  footerAction,
}: {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  items?: SidebarNavItem[];
  showAccount?: boolean;
  /** Replaces Log Out — the demo uses it for "Exit demo". */
  footerAction?: { label: string; onClick: () => void };
}) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { collapsed, toggle, animate } = useSidebarCollapsed(APP_SIDEBAR_KEY);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!showAccount) return;
    checkAdmin().then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
    getMe()
      .then((me) => {
        setAccountId(finquantaAccountId(me.id));
        setName(`${me.firstName ?? ""} ${me.lastName ?? ""}`.trim());
      })
      .catch(() => setAccountId(""));
  }, [showAccount]);

  const colors = {
    sidebar: isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200",
    text: isDark ? "text-gray-300" : "text-gray-600",
    subtext: isDark ? "text-gray-500" : "text-gray-400",
    hover: isDark ? "hover:bg-gray-700" : "hover:bg-gray-200",
  };

  /** Applies `cls` only while collapsed. Every such class is lg-prefixed. */
  const whenCollapsed = (cls: string) => (collapsed ? cls : "");

  const linkClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const shape = `flex items-center gap-2.5 text-[13px] px-3 py-1.5 rounded-lg ${whenCollapsed("lg:justify-center lg:px-0 lg:py-2.5")}`;
    if (active) return `${shape} font-semibold text-orange-500 bg-orange-50`;
    return `${shape} font-medium ${isDark ? "text-gray-200 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`;
  };

  const navLink = (key: string, href: string, label: string, Icon?: LucideIcon, tour?: string, activeHref = href) => (
    <NavTooltip key={key} label={label} show={collapsed}>
      <Link href={href} data-tour={tour} className={linkClass(activeHref)} onClick={onClose}>
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
        <span className={whenCollapsed("lg:sr-only")}>{label}</span>
      </Link>
    </NavTooltip>
  );

  const toggleLabel = t("dashboard", collapsed ? "sidebarExpand" : "sidebarCollapse");
  const logout = footerAction ?? { label: t("settings", "logOut"), onClick: () => logoutAndRedirect("/login") };

  return (
    <>
      {/* Mobile/tablet overlay behind the drawer */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <div
        id="app-sidebar"
        data-nav-rail
        className={`fixed lg:static inset-y-0 left-0 z-40 w-56 sm:w-48 flex-shrink-0 ${colors.sidebar} border-r flex flex-col py-6 px-4 overflow-y-auto overscroll-contain transform transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 ${whenCollapsed("lg:w-[72px]")} ${animate ? "lg:transition-[width] lg:duration-200" : ""}`}
      >
        <div className={`mb-8 flex items-start justify-between gap-2 ${whenCollapsed("lg:flex-col lg:items-center lg:gap-3")}`}>
          <div className={`flex flex-col items-start ${whenCollapsed("lg:items-center")}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/finquanta_logo.svg" alt="Finquanta" className={`w-28 h-auto ${whenCollapsed("lg:hidden")}`} />
            {/* The F mark stands in for the wordmark on the icon rail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="Finquanta" className={`hidden h-8 w-auto ${whenCollapsed("lg:block")}`} />
            <div className={`flex flex-col items-start ${whenCollapsed("lg:hidden")}`}>
              <MaintenanceChip />
              <BetaChip />
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            aria-label={toggleLabel}
            title={toggleLabel}
            className={`hidden lg:inline-flex p-1 rounded-md ${colors.text} ${colors.hover}`}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button onClick={onClose} className={`lg:hidden p-1 rounded-md ${colors.text}`} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1" data-tour="sidebar">
          {items.map((n) =>
            navLink(n.href, n.href, n.labelKey ? t("dashboard", n.labelKey) : n.label ?? "", n.icon, n.tour)
          )}
          {/* The admin panel is on its own address once the split is live. */}
          {isAdmin && navLink("admin", hrefFor("admin", "/admin-users"), t("dashboard", "adminPanel"), Shield, undefined, "/admin-users")}
        </nav>

        {/* The legal documents used to sit loose down here. They now live under
            Settings → Legal, which keeps this to what you actually click. */}
        <div className={`mt-auto flex flex-col gap-2 text-xs pt-6 ${whenCollapsed("lg:hidden")}`}>
          {/* Plan state lives here rather than in the top bar: it is reference
              information you check occasionally, not a control you reach for. */}
          <div className="mb-1">
            <PlanChip isDark={isDark} />
            {/* Only rendered for unverified accounts; silent otherwise. */}
            <VerifyEmailChip isDark={isDark} />
            {/* Also self-hiding: gone once a number is on file. */}
            <PhoneChip isDark={isDark} />
          </div>
          {accountId && <p className={`mt-4 ${colors.subtext}`}>{t("dashboard", "finquantaId")}: {accountId}</p>}
          <p className={colors.subtext}>{t("dashboard", "version")} {DASHBOARD_VERSION}</p>
          <a href={FEEDBACK_FORM} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-1 font-medium text-green-600 hover:text-green-700 hover:underline">
            <MessageSquare className="h-3.5 w-3.5" />
            {t("dashboard", "sendFeedback")}
          </a>
          <button
            onClick={logout.onClick}
            className="flex items-center gap-1.5 text-left font-medium text-red-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {logout.label}
          </button>
        </div>

        {/* The icon rail's footer: the chips, account ID and version need words,
            so they wait for the expanded sidebar; the avatar opens it. */}
        {collapsed && (
          <div className="mt-auto hidden lg:flex flex-col items-center gap-2 pt-6">
            <NavTooltip label={t("dashboard", "sendFeedback")} show>
              <a href={FEEDBACK_FORM} target="_blank" rel="noopener noreferrer"
                className="flex h-9 w-10 items-center justify-center rounded-lg text-green-600 hover:bg-green-50">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t("dashboard", "sendFeedback")}</span>
              </a>
            </NavTooltip>
            {showAccount && name && (
              <NavTooltip label={name} show>
                <button type="button" onClick={toggle} aria-label={t("dashboard", "sidebarExpand")}
                  className="flex h-9 w-10 items-center justify-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fq-green text-xs font-semibold text-fq-dark">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </button>
              </NavTooltip>
            )}
            <NavTooltip label={logout.label} show>
              <button type="button" onClick={logout.onClick}
                className="flex h-9 w-10 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{logout.label}</span>
              </button>
            </NavTooltip>
          </div>
        )}
      </div>
    </>
  );
}
