"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, MessageSquare } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { getMe, finquantaAccountId } from "@/lib/api/me";
import { checkAdmin } from "@/lib/api/admin";
import { logoutAndRedirect } from "@/lib/auth";

const FEEDBACK_FORM = "https://airtable.com/appvpi5gHRidiIhw8/pagLtSSYVhxqHrWFk/form";

const NAV = [
  { href: "/dashboard", labelKey: "title", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
];

/**
 * The dashboard's left sidebar, shared by every page under (user_dashbord) so
 * navigation never disappears when you move between Dashboard, Invoices and
 * Customers. Static on desktop; an off-canvas drawer on tablet/mobile.
 */
export default function DashboardSidebar({
  isDark, isOpen, onClose,
}: {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    checkAdmin().then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
    getMe().then((me) => setAccountId(finquantaAccountId(me.id))).catch(() => setAccountId(""));
  }, []);

  const colors = {
    sidebar: isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200",
    text: isDark ? "text-gray-300" : "text-gray-600",
    subtext: isDark ? "text-gray-500" : "text-gray-400",
  };

  const linkClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    if (active) return "text-sm font-semibold text-orange-500 bg-orange-50 px-3 py-2 rounded-lg";
    return `text-sm font-medium px-3 py-2 rounded-lg ${isDark ? "text-gray-200 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`;
  };

  return (
    <>
      {/* Mobile/tablet overlay behind the drawer */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <div className={`fixed lg:static inset-y-0 left-0 z-40 w-56 sm:w-48 flex-shrink-0 ${colors.sidebar} border-r flex flex-col py-6 px-4 overflow-y-auto transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="mb-8 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
          <button onClick={onClose} className={`lg:hidden p-1 rounded-md ${colors.text}`} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass(n.href)} onClick={onClose}>
              {n.labelKey ? t("dashboard", n.labelKey) : n.label}
            </Link>
          ))}
          <a href={FEEDBACK_FORM} target="_blank" rel="noopener noreferrer"
            className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? "text-gray-200 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`}>
            Give Feedback
          </a>
          {isAdmin && (
            <Link href="/admin-users" className={linkClass("/admin-users")} onClick={onClose}>
              {t("dashboard", "adminPanel")}
            </Link>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-2 text-xs pt-6">
          <Link href="/profile-settings" className={`hover:underline ${colors.text}`}>{t("dashboard", "profileSettings")}</Link>
          <Link href="/terms" className={`hover:underline ${colors.text}`}>{t("dashboard", "termsOfService")}</Link>
          <Link href="/privacy" className={`hover:underline ${colors.text}`}>{t("dashboard", "privacyPolicy")}</Link>
          <Link href="/ai-risk-disclosure" className={`hover:underline ${colors.text}`}>{t("dashboard", "aiRiskDisclosure")}</Link>
          <button onClick={() => logoutAndRedirect("/login")} className="text-left text-red-400 hover:text-red-500 hover:underline transition-colors">
            {t("settings", "logOut")}
          </button>
          {accountId && <p className={`mt-4 ${colors.subtext}`}>{t("dashboard", "finquantaId")}: {accountId}</p>}
          <p className={colors.subtext}>{t("dashboard", "version")} 1.2.0</p>
          <a href={FEEDBACK_FORM} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-1 font-medium text-green-600 hover:text-green-700 hover:underline">
            <MessageSquare className="h-3.5 w-3.5" />
            {t("dashboard", "sendFeedback")}
          </a>
        </div>
      </div>
    </>
  );
}
