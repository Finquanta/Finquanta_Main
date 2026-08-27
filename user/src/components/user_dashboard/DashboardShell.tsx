"use client";

import { useEffect, useState } from "react";
import { Menu, Globe, ChevronDown, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import InboundArrivalToast from "./InboundArrivalToast";
import { useLanguage, LANGUAGE_OPTIONS as LANGUAGES } from "@/hooks/context/LanguageContext";
import { logoutAndRedirect } from "@/lib/auth";
import { isFinnaHidden, setFinnaHidden } from "@/lib/finnaVisibility";
import AccountNameChip from "./AccountNameChip";
import DashboardSidebar from "./DashboardSidebar";
import NotificationBell from "./NotificationBell";
import ReferralIdChip from "./ReferralIdChip";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

/**
 * Page shell for the dashboard section: keeps the sidebar on screen so it never
 * disappears when you move into Invoices or Customers. Wrap a page's content in
 * this and it gets the sidebar plus the top bar.
 *
 * The bar carries the same controls the Dashboard page's own bar does. It used
 * to hold only a hamburger and the referral chip, and since every tab EXCEPT
 * Dashboard renders through here, switching workspace, language or theme meant
 * navigating back to Dashboard first. The Dashboard page still builds its bar
 * inline, so the two must be kept in step until it moves over to this shell.
 */


export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isDark = theme === "dark";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  /** Read after mount — localStorage doesn't exist during the server render. */
  const [finnaHidden, setFinnaHiddenState] = useState(false);
  useEffect(() => { setFinnaHiddenState(isFinnaHidden()); }, []);

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const buttonBg = isDark
    ? "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";

  return (
    <div
      className={`flex ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
      // Was `h-screen`. With a fixed banner above it, a full 100vh starting
      // under the banner runs the bottom of the app off the screen — so the
      // shell is shortened by exactly the banner height and pushed below it.
      style={{
        marginTop: "var(--maintenance-h, 0px)",
        height: "calc(100vh - var(--maintenance-h, 0px))",
      }}
    >
      {/* Email lands while nobody is looking — this is how you find out. */}
      <InboundArrivalToast />

      <DashboardSidebar isDark={isDark} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          {/* Same order and spacing as the Dashboard page's own bar:
              hamburger, avatar + editable name, workspace switcher. */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 -ml-2 rounded-lg border ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}
              aria-label={t("demo","dOpenMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <AccountNameChip isDark={isDark} />
            <WorkspaceSwitcher isDark={isDark} />
          </div>

          <div className="flex items-center gap-3">
            <ReferralIdChip isDark={isDark} />

            {/* Bell and search were only ever on the Dashboard page's own bar,
                so they disappeared on every other tab. Both live here now. */}
            <NotificationBell isDark={isDark} />

            <input
              type="text"
              placeholder={t("dashboard", "search")}
              className={`hidden md:block border rounded-lg px-3 py-1 text-sm w-48 ${
                isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              }`}
            />

            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border ${buttonBg}`}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{currentLang.label}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {langOpen && (
                <div className={`absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-50 border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        language === lang.code
                          ? isDark ? "font-semibold text-blue-400 bg-gray-700" : "font-semibold text-blue-600 bg-gray-100"
                          : isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Show or hide the floating Finna widget. Sits between language
                and theme because it's the same kind of thing: a per-person
                display preference, not a feature switch. */}
            <button
              onClick={() => { const next = !finnaHidden; setFinnaHidden(next); setFinnaHiddenState(next); }}
              title={t("dashboard", finnaHidden ? "finnaOff" : "finnaOn")}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${buttonBg} ${
                finnaHidden ? "opacity-50" : ""
              }`}
            >
              {t("dashboard", finnaHidden ? "finnaOff" : "finnaOn")}
            </button>

            <button onClick={toggleTheme} className={`px-3 py-1 rounded-lg text-xs font-medium border ${buttonBg}`}>
              {isDark ? t("dashboard", "dark") : t("dashboard", "light")}
            </button>

            <button
              onClick={() => logoutAndRedirect("/login")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("settings", "logOut")}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
