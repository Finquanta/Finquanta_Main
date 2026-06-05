"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, ChevronDown, Bell, LogOut, X } from 'lucide-react';
import BookkeepingModal from '@/components/user_dashboard/bookkeeping/BookkeepingModal';
import GoalModal from '@/components/user_dashboard/dashboard/GoalModal';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import { DashboardOverviewResponse, getDashboardOverview } from '@/lib/api/dashboard';
 
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
];

const NOTIFICATION_DEFS = [
  { id: 1, titleKey: 'welcomeTitle', bodyKey: 'welcomeBody', timestamp: Date.now(), read: false },
  { id: 3, titleKey: 'betaTitle', bodyKey: 'betaBody', timestamp: Date.now(), read: true },
];

export default function DashboardPage() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [bookkeepingModalOpen, setBookkeepingModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardOverviewResponse | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATION_DEFS);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDashboardOverview()
      .then(setDashboardData)
      .catch(() => setDashboardData(null));
  }, []);

  useEffect(() => {
    if (clickCount >= 10 && !feedbackDismissed) setShowFeedback(true);
  }, [clickCount, feedbackDismissed]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Direct theme check without mounted state
  const isDark = theme === 'dark';

  // Color variables - simplified and clear
  const colors = {
    bg: isDark ? 'bg-gray-900' : 'bg-white',
    sidebar: isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200',
    card: isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900 border border-gray-200',
    topbar: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDark ? 'text-gray-300' : 'text-gray-700',
    subtext: isDark ? 'text-gray-400' : 'text-gray-500',
    input: isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400',
    tableRow: isDark ? 'divide-gray-700 text-gray-300' : 'divide-gray-100 text-gray-700',
    tableHead: isDark ? 'text-gray-500 border-gray-700' : 'text-gray-600 border-gray-200',
    notifBg: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    notifItem: isDark ? 'hover:bg-gray-700 border-gray-700' : 'hover:bg-gray-50 border-gray-100',
    buttonBg: isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 text-gray-900 border-gray-300',
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <div className={`flex h-screen ${colors.bg}`} onClick={() => setClickCount(c => c + 1)}>
      {/* SIDEBAR */}
      <div className={`w-48 ${colors.sidebar} border-r flex flex-col py-6 px-4`}>
        <div className="mb-8">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
        </div>

        <nav className="flex flex-col gap-2">
          <Link href="/dashboard" className="text-sm font-semibold text-orange-500 bg-orange-50 px-3 py-2 rounded-lg">
            {t('dashboard', 'title')}
          </Link>
        </nav>

        <div className="mt-auto flex flex-col gap-2 text-xs">
          <Link href="/profile-settings" className={`hover:underline ${colors.text}`}>
            {t('dashboard', 'profileSettings')}
          </Link>
          <Link href="/terms" className={`hover:underline ${colors.text}`}>
            {t('dashboard', 'termsOfService')}
          </Link>
          <Link href="/privacy" className={`hover:underline ${colors.text}`}>
            {t('dashboard', 'privacyPolicy')}
          </Link>
          <Link href="/ai-risk-disclosure" className={`hover:underline ${colors.text}`}>
            {t('dashboard', 'aiRiskDisclosure')}
          </Link>
          <button onClick={handleLogout} className="text-left text-red-400 hover:text-red-500 hover:underline transition-colors">
            {t('settings', 'logOut')}
          </button>
          <p className={`mt-4 ${colors.subtext}`}>{t('dashboard', 'version')} 1.0.0.0</p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`${colors.topbar} border-b px-6 py-3 flex items-center justify-between`}>
          {/* Left */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>User</span>
            </div>
            <span className={`text-sm ${colors.text}`}>{t('dashboard', 'bankAccount')}</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setNotifOpen(prev => !prev); }}
                className={`relative p-2 rounded-lg border transition-colors ${colors.buttonBg}`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-xl border z-50 overflow-hidden ${colors.notifBg}`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {t('notifications', 'title')}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-500 hover:underline">
                        {t('notifications', 'markAllRead')}
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className={`text-xs text-center py-6 ${colors.text}`}>
                        {t('notifications', 'noNotifications')}
                      </p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b transition-colors ${colors.notifItem} ${
                            !n.read ? (isDark ? 'bg-gray-700/50' : 'bg-blue-50') : ''
                          }`}
                        >
                          <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {t('notifications', n.titleKey)}
                            </p>
                            <p className={`text-xs mt-0.5 ${colors.text}`}>
                              {t('notifications', n.bodyKey)}
                            </p>
                            <p className={`text-[10px] mt-1 ${colors.subtext}`}>
                              {new Date(n.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissNotification(n.id)}
                            className={`flex-shrink-0 ${colors.text} hover:text-red-400 transition-colors`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder={t('dashboard', 'search')}
              className={`border rounded-lg px-3 py-1 text-sm w-48 ${colors.input}`}
            />

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border ${colors.buttonBg}`}
              >
                <Globe className="h-4 w-4" />
                <span>{currentLang.label}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {langOpen && (
                <div className={`absolute right-0 mt-2 w-40 rounded-lg shadow-lg z-50 ${colors.notifBg}`}>
                  {LANGUAGES.map(lang => (
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

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${colors.buttonBg}`}
            >
              {isDark ? t('dashboard', 'dark') : t('dashboard', 'light')}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('settings', 'logOut')}
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: t('dashboard', 'balance'), value: '$0.00' },
              { label: t('dashboard', 'cashflow'), value: '$0.00' },
              { label: t('dashboard', 'expense'), value: '$0.00' },
            ].map((fallback, i) => {
              const item = dashboardData?.summaryCards[i]
                ? { label: dashboardData.summaryCards[i].title, value: dashboardData.summaryCards[i].amount }
                : fallback;
              return (
              <div key={i} className={`${colors.card} rounded-xl p-4 shadow-sm`}>
                <p className={`text-xs mb-1 ${colors.text}`}>{item.label}</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
              </div>
              );
            })}
          </div>

          {/* Bookkeeping Table */}
          <div className={`${colors.card} rounded-xl p-4 shadow-sm mb-6`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard', 'bookkeeping')}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${colors.text}`}>{t('dashboard', 'last30Days')}</span>
                <button onClick={() => setBookkeepingModalOpen(true)} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-600">
                  {t('dashboard', 'addData')}
                </button>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className={`${colors.tableHead} border-b`}>
                  <th className="text-left pb-2">{t('dashboard', 'date')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'type')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'detail')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'price')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'amount')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${colors.tableRow}`}>
                {dashboardData?.latestTransactions?.length ? (
                  dashboardData.latestTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="py-3">{transaction.date}</td>
                      <td className="py-3">{transaction.type}</td>
                      <td className="py-3">{transaction.detail}</td>
                      <td className="py-3">${transaction.price.toFixed(2)}</td>
                      <td className="py-3">{transaction.amount < 0 ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={`py-6 text-center ${colors.text}`}>{t('dashboard', 'noTransactions')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Revenue */}
            <div className={`${colors.card} rounded-xl p-4 shadow-sm`}>
              <h2 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard', 'totalRevenue')}</h2>
              <p className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.totalFinancesData.highlightValue ?? '$0.00'}</p>
              <p className={`text-xs mb-4 ${colors.text}`}>{dashboardData?.totalFinancesData?.year ?? t('dashboard', 'noDataYet')}</p>
              <div className="h-24 flex items-end gap-1">
                {[0, 0, 0, 0, 0, 0, 0].map((h, i) => (
                  <div key={i} className={`flex-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-t`} style={{ height: '10%' }}></div>
                ))}
              </div>
            </div>

            <div className={`${colors.card} rounded-xl p-4 shadow-sm`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard', 'goals')}</h2>
                <button onClick={() => setGoalModalOpen(true)} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-600">
                  {t('dashboard', 'addGoal')}
                </button>
              </div>
              {dashboardData?.goalsData?.goals?.length ? (
                <div className="space-y-3">
                  {dashboardData.goalsData.goals.map((goal) => (
                    <div key={goal.id} className={`text-xs ${colors.text}`}>
                      <div className="flex justify-between">
                        <span>{goal.name}</span>
                        <span>${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs text-center py-6 ${colors.text}`}>{t('dashboard', 'noGoalsAdded')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {<BookkeepingModal isOpen={bookkeepingModalOpen} onClose={() => setBookkeepingModalOpen(false)} />}
      {<GoalModal isOpen={goalModalOpen} onClose={() => setGoalModalOpen(false)} />}

      {/* Feedback Popup */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className={`rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center relative ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <button
              onClick={() => { setShowFeedback(false); setFeedbackDismissed(true); }}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              x
            </button>
            <h2 className="text-xl font-bold mb-2">{t('settings', 'feedbackPopupTitle')}</h2>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('settings', 'feedbackPopupDesc')}
            </p>
            <a
              href="https://airtable.com/appvpi5gHRidiIhw8/pagLtSSYVhxqHrWFk/form"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { setShowFeedback(false); setFeedbackDismissed(true); }}
              className="inline-block bg-green-500 hover:bg-green-600 text-white font-medium px-6 py-3 rounded-lg text-sm"
            >
              {t('settings', 'feedbackPopupButton')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
 
