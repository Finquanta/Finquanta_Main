"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Globe, ChevronDown } from 'lucide-react';
import BookkeepingModal from '@/components/user_dashboard/bookkeeping/BookkeepingModal';
import GoalModal from '@/components/user_dashboard/dashboard/GoalModal';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
 
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
 
export default function DashboardPage() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';
  const [bookkeepingModalOpen, setBookkeepingModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
 
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
 
  const bg = darkMode ? "bg-gray-900" : "bg-gray-50";
  const sidebar = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const card = darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const topbar = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = darkMode ? "text-gray-300" : "text-gray-500";
  const subtext = darkMode ? "text-gray-400" : "text-gray-400";
  const input = darkMode ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-200 text-gray-900";
  const tableRow = darkMode ? "divide-gray-700 text-gray-300" : "divide-gray-50 text-gray-600";
  const tableHead = darkMode ? "text-gray-500 border-gray-700" : "text-gray-400 border-gray-200";
 
  return (
    <div className={`flex h-screen ${bg}`}>
      {/* Sidebar */}
      <div className={`w-48 ${sidebar} border-r flex flex-col py-6 px-4`}>
        <div className="mb-8">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
        </div>
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard" className="text-sm font-semibold text-orange-500 bg-orange-50 px-3 py-2 rounded-lg">
            {t('dashboard', 'title')}
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-xs text-gray-500">
          <Link href="/profile-settings" className={`hover:underline ${text}`}>{t('dashboard', 'profileSettings')}</Link>
          <Link href="/terms" className={`hover:underline ${text}`}>{t('dashboard', 'termsOfService')}</Link>
          <Link href="/privacy" className={`hover:underline ${text}`}>{t('dashboard', 'privacyPolicy')}</Link>
          <p className={`mt-4 ${subtext}`}>{t('dashboard', 'version')} 1.0.0.0</p>
        </div>
      </div>
 
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`${topbar} border-b px-6 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <span className={`text-sm font-medium ${darkMode ? "text-white" : "text-gray-800"}`}>User</span>
            </div>
            <span className={`text-sm ${text}`}>{t('dashboard', 'bankAccount')}</span>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder={t('dashboard', 'search')}
              className={`border rounded-lg px-3 py-1 text-sm w-48 ${input}`}
            />
 
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-gray-100 text-gray-700 border-gray-200"}`}
              >
                <Globe className="h-4 w-4" />
                <span>{currentLang.label}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                        language === lang.code ? 'font-semibold text-blue-600' : 'text-gray-700'
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
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-gray-100 text-gray-700 border-gray-200"}`}
            >
              {darkMode ? `☀️ ${t('dashboard', 'light')}` : `🌙 ${t('dashboard', 'dark')}`}
            </button>
          </div>
        </div>
 
        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: t('dashboard', 'balance'), value: "$0.00" },
              { label: t('dashboard', 'cashflow'), value: "$0.00" },
              { label: t('dashboard', 'expense'), value: "$0.00" },
            ].map((item, i) => (
              <div key={i} className={`${card} rounded-xl p-4 shadow-sm`}>
                <p className={`text-xs mb-1 ${text}`}>{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
 
          {/* Bookkeeping Table */}
          <div className={`${card} rounded-xl p-4 shadow-sm mb-6`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold">{t('dashboard', 'bookkeeping')}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${text}`}>{t('dashboard', 'last30Days')}</span>
                <button onClick={() => setBookkeepingModalOpen(true)} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg">
                  {t('dashboard', 'addData')}
                </button>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className={`${tableHead} border-b`}>
                  <th className="text-left pb-2">{t('dashboard', 'date')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'type')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'detail')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'price')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'amount')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${tableRow}`}>
                <tr>
                  <td colSpan={5} className={`py-6 text-center ${text}`}>{t('dashboard', 'noTransactions')}</td>
                </tr>
              </tbody>
            </table>
          </div>
 
          {/* Bottom Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Revenue */}
            <div className={`${card} rounded-xl p-4 shadow-sm`}>
              <h2 className="text-sm font-semibold mb-1">{t('dashboard', 'totalRevenue')}</h2>
              <p className="text-xl font-bold mb-1">$0.00</p>
              <p className={`text-xs mb-4 ${text}`}>{t('dashboard', 'noDataYet')}</p>
              <div className="h-24 flex items-end gap-1">
                {[0, 0, 0, 0, 0, 0, 0].map((h, i) => (
                  <div key={i} className={`flex-1 ${darkMode ? "bg-gray-700" : "bg-gray-100"} rounded-t`} style={{ height: "10%" }}></div>
                ))}
              </div>
            </div>
 
            {/* Goals */}
            <div className={`${card} rounded-xl p-4 shadow-sm`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold">{t('dashboard', 'goals')}</h2>
                <button onClick={() => setGoalModalOpen(true)} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg">
                  {t('dashboard', 'addGoal')}
                </button>
              </div>
              <p className={`text-xs text-center py-6 ${text}`}>{t('dashboard', 'noGoalsAdded')}</p>
            </div>
          </div>
        </div>
      </div>
 
      <BookkeepingModal isOpen={bookkeepingModalOpen} onClose={() => setBookkeepingModalOpen(false)} />
      <GoalModal isOpen={goalModalOpen} onClose={() => setGoalModalOpen(false)} />
    </div>
  );
}
 