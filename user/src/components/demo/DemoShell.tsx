'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, ChevronDown, Bell, Menu, LogOut } from 'lucide-react';
import { useLanguage, LANGUAGE_OPTIONS as LANGUAGES } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import { useAsk } from '@/components/user_dashboard/ConfirmProvider';
import DashboardSidebar, { SidebarNavItem } from '@/components/user_dashboard/DashboardSidebar';
import { useDemoSession } from '@/lib/demo/DemoSessionProvider';
import { clearPendingDemo, stashForSignup } from '@/lib/demo/migrate';
import { reset } from '@/lib/demo/store';
import { demoColors } from '@/lib/demo/theme';
import DemoSignupPrompt from './DemoSignupPrompt';
import DemoFinna from './DemoFinna';

/**
 * The demo's page shell. It renders the REAL DashboardSidebar and mirrors the
 * real dashboard's top bar, so what a visitor sees is the product's actual
 * chrome rather than a lookalike that drifts out of step with it.
 *
 * What differs is only what an anonymous session genuinely can't have: no
 * getMe/checkAdmin (showAccount={false}), no workspace switcher or referral chip.
 */

/**
 * The registered dashboard's nav, item for item and in the same order. Activity,
 * Refer a Business and Settings need an account, so they point at signup rather
 * than at their real routes: those are behind auth, and a visitor clicking one
 * would be bounced to /login and lose the session they'd been building. The
 * `?from=` keeps each href unique (the sidebar keys on it).
 */
const NAV: SidebarNavItem[] = [
  // labelKey mirrors the registered sidebar so the demo nav translates too;
  // `label` is only the English fallback the renderer uses when a key is absent.
  { href: '/demo/dashboard', labelKey: 'title', label: 'Dashboard' },
  { href: '/demo/invoices', labelKey: 'invoices', label: 'Invoices' },
  { href: '/demo/customers', labelKey: 'customers', label: 'Customers' },
  { href: '/signup?from=activity', labelKey: 'activity', label: 'Activity' },
  { href: '/demo/groups', labelKey: 'groups', label: 'Groups' },
  { href: '/signup?from=referrals', labelKey: 'referAB', label: 'Refer a Business' },
  { href: '/signup?from=settings', labelKey: 'settings', label: 'Settings' },
];


export default function DemoShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { ask } = useAsk();
  const { businessName } = useDemoSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const isDark = theme === 'dark';
  const c = demoColors(isDark);
  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const exitDemo = () => ask({
    title: t('demo', 'exitDemoConfirm'),
    body: t('dashboard', 'confirmCannotUndo'),
    tone: 'danger',
    onConfirm: () => {
      reset();
    // The confirmation promises the work is discarded. A visit to /signup earlier
    // in the session leaves a stash behind in localStorage, so clearing only the
    // session would leave that copy to surface in the next account signed in.
      clearPendingDemo();
      router.push('/home');
    },
  });

  return (
    <div className={`flex h-screen ${c.bg}`}>
      <DashboardSidebar
        isDark={isDark}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={NAV}
        showAccount={false}
        footer={
          // Sits in the Log Out slot and looks the same — a visitor has no
          // session to end, so it clears the demo and returns them home.
          <button
            onClick={exitDemo}
            className="flex items-center gap-1.5 text-left font-medium text-red-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('demo', 'exitDemo')}
          </button>
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — same structure as the signed-in dashboard's */}
        <div className={`${c.topbar} border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 -ml-2 rounded-lg border transition-colors ${c.buttonBg}`}
              aria-label={t("demo","dOpenMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full" />
              <span className={`text-sm font-medium ${c.heading}`}>{businessName}</span>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-semibold">
              {t('demo', 'badge')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Present but inert — a demo session has no notifications to serve. */}
            <button
              className={`relative p-2 rounded-lg border transition-colors opacity-60 cursor-not-allowed ${c.buttonBg}`}
              title={t('demo', 'notificationsHint')}
              disabled
            >
              <Bell className="h-4 w-4" />
            </button>

            <input
              type="text"
              placeholder={t('dashboard', 'search')}
              className={`border rounded-lg px-3 py-1 text-sm w-48 hidden md:block ${c.input}`}
            />

            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border ${c.buttonBg}`}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{currentLang.label}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {langOpen && (
                <div className={`absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-50 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        language === lang.code
                          ? (isDark ? 'font-semibold text-blue-400 bg-gray-700' : 'font-semibold text-blue-600 bg-gray-100')
                          : (isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100')
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Same light/dark toggle the signed-in dashboard has. */}
            <button
              onClick={toggleTheme}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${c.buttonBg}`}
            >
              {isDark ? t('dashboard', 'dark') : t('dashboard', 'light')}
            </button>

            <Link
              href="/signup"
              onClick={stashForSignup}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-green-500 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
            >
              {t('demo', 'signUpFree')}
            </Link>
          </div>
        </div>

        {/* The one thing the real dashboard doesn't have: what this is. */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-amber-800">{t('demo', 'banner')}</p>
          <Link
            href="/signup"
            onClick={stashForSignup}
            className="text-xs sm:text-sm font-semibold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg whitespace-nowrap"
          >
            {t('demo', 'signUpToSave')}
          </Link>
        </div>

        <div className={`flex-1 overflow-y-auto ${c.page}`}>{children}</div>
      </div>

      <DemoFinna />
      <DemoSignupPrompt />
    </div>
  );
}
