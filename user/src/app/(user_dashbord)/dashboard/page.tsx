"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, ChevronDown, Bell, LogOut, X, Pencil, Trash2, Check } from 'lucide-react';
import BookkeepingModal, { BookkeepingEditing } from '@/components/user_dashboard/bookkeeping/BookkeepingModal';
import GoalModal, { GoalEditing } from '@/components/user_dashboard/dashboard/GoalModal';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import { DashboardOverviewResponse, getDashboardOverview, deleteGoal } from '@/lib/api/dashboard';
import { deleteTransaction, createTransaction } from '@/lib/api/transactions';
import { getMe, updateName, finquantaAccountId, CurrentUser } from '@/lib/api/me';
import { Reminder, getReminders, createReminder, updateReminder, deleteReminder } from '@/lib/api/reminders';
import RevenueChart from '@/components/user_dashboard/dashboard/RevenueChart';

const RECENTLY_DELETED_KEY = 'recentlyDeletedTx';

type DeletedEntry = DashboardOverviewResponse['latestTransactions'][number] & { deletedAt: number };

const GOAL_PROMPT_DISMISSED_KEY = 'goalPromptDismissedAt';
const GOAL_STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
 
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
  const [bookkeepingEditing, setBookkeepingEditing] = useState<BookkeepingEditing | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalEditing, setGoalEditing] = useState<GoalEditing | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardOverviewResponse | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATION_DEFS);
  const notifRef = useRef<HTMLDivElement>(null);

  const [me, setMe] = useState<CurrentUser | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [goalPromptOpen, setGoalPromptOpen] = useState(false);

  // Bookkeeping recently-deleted + undo
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedEntry[]>([]);
  const [lastUndo, setLastUndo] = useState<DeletedEntry | null>(null);
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_DELETED_KEY);
      if (raw) setRecentlyDeleted(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Auto-hide the undo banner after a few seconds
  useEffect(() => {
    if (!lastUndo) return;
    const id = setTimeout(() => setLastUndo(null), 8000);
    return () => clearTimeout(id);
  }, [lastUndo]);

  // Goals/Reminders rotating card
  const [activeCardTab, setActiveCardTab] = useState<'goals' | 'reminders'>('goals');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');

  const loadReminders = useCallback(() => {
    return getReminders().then(setReminders).catch(() => setReminders([]));
  }, []);
  useEffect(() => { loadReminders(); }, [loadReminders]);

  // Auto-rotate between Goals and Reminders every 10s
  useEffect(() => {
    const id = setInterval(() => {
      setActiveCardTab((tab) => (tab === 'goals' ? 'reminders' : 'goals'));
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const addReminder = async () => {
    const text = reminderText.trim();
    if (!text) return;
    try {
      await createReminder({ text, remindAt: reminderDate ? new Date(reminderDate).toISOString() : null });
      setReminderText('');
      setReminderDate('');
      await loadReminders();
    } catch { /* ignore */ }
  };
  const toggleReminder = async (r: Reminder) => {
    try { await updateReminder(r.id, { done: !r.done }); await loadReminders(); } catch { /* ignore */ }
  };
  const removeReminder = async (id: string) => {
    try { await deleteReminder(id); await loadReminders(); } catch { /* ignore */ }
  };

  const refresh = useCallback(() => {
    return getDashboardOverview()
      .then(setDashboardData)
      .catch(() => setDashboardData(null));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  // Remind the user to check on their goals if they have some but haven't
  // updated any of them recently (and we haven't nagged them lately).
  useEffect(() => {
    const goals = dashboardData?.goalsData?.goals;
    if (!goals || goals.length === 0) return;

    const newestUpdate = goals.reduce((max, g) => {
      const t = new Date(g.updatedAt).getTime();
      return Number.isFinite(t) && t > max ? t : max;
    }, 0);
    if (!newestUpdate) return;

    const dismissedAt = Number(localStorage.getItem(GOAL_PROMPT_DISMISSED_KEY) || '0');
    const now = Date.now();
    const goalsAreStale = now - newestUpdate > GOAL_STALE_DAYS * DAY_MS;
    const naggedRecently = now - dismissedAt < GOAL_STALE_DAYS * DAY_MS;

    if (goalsAreStale && !naggedRecently) {
      setGoalPromptOpen(true);
    }
  }, [dashboardData]);

  const dismissGoalPrompt = () => {
    localStorage.setItem(GOAL_PROMPT_DISMISSED_KEY, String(Date.now()));
    setGoalPromptOpen(false);
  };

  const openNewBookkeeping = () => { setBookkeepingEditing(null); setBookkeepingModalOpen(true); };
  const openEditBookkeeping = (tx: DashboardOverviewResponse['latestTransactions'][number]) => {
    setBookkeepingEditing({
      id: tx.id,
      invoiceName: tx.detail,
      invoiceDescription: tx.detail,
      invoiceAmount: String(Math.abs(tx.price)),
      invoiceType: tx.type === 'Expense' ? 'Expense' : 'Cashflow',
      dateOfInvoice: tx.date,
    });
    setBookkeepingModalOpen(true);
  };
  const handleDeleteTransaction = async (tx: DashboardOverviewResponse['latestTransactions'][number]) => {
    try {
      await deleteTransaction(tx.id);
      const entry: DeletedEntry = { ...tx, deletedAt: Date.now() };
      setRecentlyDeleted((prev) => {
        const next = [entry, ...prev].slice(0, 10);
        localStorage.setItem(RECENTLY_DELETED_KEY, JSON.stringify(next));
        return next;
      });
      setLastUndo(entry);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete this entry.');
    }
  };

  const restoreTransaction = async (entry: DeletedEntry) => {
    try {
      await createTransaction({
        type: entry.type === 'Expense' ? 'expense' : 'income',
        category: entry.detail || 'General',
        description: entry.detail || undefined,
        amount: Math.abs(entry.price),
        date: entry.date,
      });
      setRecentlyDeleted((prev) => {
        const next = prev.filter((e) => e.deletedAt !== entry.deletedAt);
        localStorage.setItem(RECENTLY_DELETED_KEY, JSON.stringify(next));
        return next;
      });
      if (lastUndo?.deletedAt === entry.deletedAt) setLastUndo(null);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not restore this entry.');
    }
  };

  const clearRecentlyDeleted = () => {
    localStorage.removeItem(RECENTLY_DELETED_KEY);
    setRecentlyDeleted([]);
  };

  const openNewGoal = () => { setGoalEditing(null); setGoalModalOpen(true); };
  const openEditGoal = (goal: DashboardOverviewResponse['goalsData']['goals'][number]) => {
    setGoalEditing({
      id: goal.id,
      goalName: goal.name,
      goalAmount: String(goal.target),
      currentAmount: String(goal.current),
    });
    setGoalModalOpen(true);
  };
  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    try { await deleteGoal(id); await refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not delete this goal.'); }
  };

  const startEditName = () => {
    setNameDraft(me ? `${me.firstName} ${me.lastName}`.trim() : '');
    setEditingName(true);
  };
  const saveName = async () => {
    const parts = nameDraft.trim().split(/\s+/);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    if (!firstName) { setEditingName(false); return; }
    try {
      await updateName({ firstName, lastName });
      setMe((prev) => (prev ? { ...prev, firstName, lastName } : prev));
    } catch { /* keep previous name */ }
    setEditingName(false);
  };

  const displayName = me ? `${me.firstName} ${me.lastName}`.trim() || 'User' : 'User';
  const accountId = me ? finquantaAccountId(me.id) : '—';

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
              {editingName ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className={`text-sm font-medium rounded px-2 py-0.5 w-40 outline-none border ${colors.input}`}
                    placeholder={t('dashboard', 'yourName')}
                  />
                  <button onClick={saveName} className="text-green-500 hover:text-green-600" title={t('dashboard', 'saveChanges')}>
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditName}
                  className={`group flex items-center gap-1 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}
                  title={t('dashboard', 'editNameTitle')}
                >
                  {displayName}
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                </button>
              )}
            </div>
            <span className={`text-sm ${colors.text}`}>{t('dashboard', 'finquantaId')}: {accountId}</span>
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
              const card = dashboardData?.summaryCards?.[i];
              const item = card
                ? { label: card.title, value: card.amount }
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
                <button onClick={openNewBookkeeping} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-600">
                  {t('dashboard', 'addData')}
                </button>
              </div>
            </div>

            {/* Undo banner shown right after a delete */}
            {lastUndo && (
              <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 mb-3 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                <span>{t('dashboard', 'deleted')} “{lastUndo.detail}”.</span>
                <button onClick={() => restoreTransaction(lastUndo)} className="font-semibold text-blue-500 hover:text-blue-700">
                  {t('dashboard', 'undo')}
                </button>
              </div>
            )}

            <table className="w-full text-xs">
              <thead>
                <tr className={`${colors.tableHead} border-b`}>
                  <th className="text-left pb-2">{t('dashboard', 'date')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'type')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'detail')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'price')}</th>
                  <th className="text-left pb-2">{t('dashboard', 'amount')}</th>
                  <th className="text-right pb-2"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${colors.tableRow}`}>
                {dashboardData?.latestTransactions?.length ? (
                  dashboardData.latestTransactions.map((transaction) => (
                    <tr key={transaction.id} className="group">
                      <td className="py-3">{transaction.date}</td>
                      <td className="py-3">{transaction.type}</td>
                      <td className="py-3">{transaction.detail}</td>
                      <td className="py-3">${transaction.price.toFixed(2)}</td>
                      <td className="py-3">{transaction.amount < 0 ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEditBookkeeping(transaction)} className="text-blue-500 hover:text-blue-700" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteTransaction(transaction)} className="text-red-500 hover:text-red-700" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={`py-6 text-center ${colors.text}`}>{t('dashboard', 'noTransactions')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Recently deleted */}
            {recentlyDeleted.length > 0 && (
              <div className={`mt-4 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowRecentlyDeleted((v) => !v)}
                    className={`text-xs font-medium ${colors.text} hover:underline`}
                  >
                    {t('dashboard', 'recentlyDeleted')} ({recentlyDeleted.length}) {showRecentlyDeleted ? '▲' : '▼'}
                  </button>
                  {showRecentlyDeleted && (
                    <button onClick={clearRecentlyDeleted} className={`text-xs ${colors.subtext} hover:underline`}>
                      {t('dashboard', 'clear')}
                    </button>
                  )}
                </div>
                {showRecentlyDeleted && (
                  <div className="mt-2 space-y-2">
                    {recentlyDeleted.map((entry) => (
                      <div key={entry.deletedAt} className={`flex items-center justify-between text-xs ${colors.text}`}>
                        <span className="flex-1 truncate">
                          {entry.date} · {entry.type} · {entry.detail} · ${Math.abs(entry.price).toFixed(2)}
                        </span>
                        <button onClick={() => restoreTransaction(entry)} className="font-semibold text-blue-500 hover:text-blue-700 ml-3">
                          {t('dashboard', 'restore')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Revenue */}
            <div className={`${colors.card} rounded-xl p-4 shadow-sm`}>
              <h2 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard', 'totalRevenue')}</h2>
              <p className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{dashboardData?.totalFinancesData?.highlightValue ?? '$0.00'}</p>
              <RevenueChart isDark={isDark} />
            </div>

            <div className={`${colors.card} rounded-xl p-4 shadow-sm`}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <button
                    onClick={() => setActiveCardTab('goals')}
                    className={`px-2 py-1 rounded-lg transition-colors ${activeCardTab === 'goals' ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900') : colors.subtext}`}
                  >
                    {t('dashboard', 'goals')}
                  </button>
                  <button
                    onClick={() => setActiveCardTab('reminders')}
                    className={`px-2 py-1 rounded-lg transition-colors ${activeCardTab === 'reminders' ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900') : colors.subtext}`}
                  >
                    {t('dashboard', 'reminders')}
                  </button>
                </div>
                {activeCardTab === 'goals' ? (
                  <button onClick={openNewGoal} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-600">
                    {t('dashboard', 'addGoal')}
                  </button>
                ) : null}
              </div>

              {activeCardTab === 'goals' ? (
                dashboardData?.goalsData?.goals?.length ? (
                  <div className="space-y-4">
                    {dashboardData.goalsData.goals.map((goal) => {
                      const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
                      return (
                        <div key={goal.id} className={`text-xs ${colors.text} group`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{goal.name}</span>
                            <div className="flex items-center gap-2">
                              <span>{goal.current.toLocaleString()} / {goal.target.toLocaleString()}</span>
                              <button onClick={() => openEditGoal(goal)} className="text-blue-500 hover:text-blue-700" title="Edit goal">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteGoal(goal.id)} className="text-red-500 hover:text-red-700" title="Delete goal">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs text-center py-6 ${colors.text}`}>{t('dashboard', 'noGoalsAdded')}</p>
                )
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={reminderText}
                      onChange={(e) => setReminderText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addReminder(); }}
                      placeholder={t('dashboard', 'addReminderPlaceholder')}
                      className={`flex-1 text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`}
                    />
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className={`text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`}
                    />
                    <button onClick={addReminder} className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600">{t('dashboard', 'add')}</button>
                  </div>
                  {reminders.length ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {reminders.map((r) => (
                        <div key={r.id} className={`flex items-center gap-2 text-xs ${colors.text} group`}>
                          <input type="checkbox" checked={r.done} onChange={() => toggleReminder(r)} className="cursor-pointer" />
                          <span className={`flex-1 ${r.done ? 'line-through opacity-60' : ''}`}>{r.text}</span>
                          {r.remindAt && <span className={`${colors.subtext}`}>{new Date(r.remindAt).toLocaleDateString()}</span>}
                          <button onClick={() => removeReminder(r.id)} className="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete reminder">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs text-center py-6 ${colors.text}`}>{t('dashboard', 'noReminders')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BookkeepingModal
        isOpen={bookkeepingModalOpen}
        editing={bookkeepingEditing}
        onClose={() => setBookkeepingModalOpen(false)}
        onSaved={refresh}
      />
      <GoalModal
        isOpen={goalModalOpen}
        editing={goalEditing}
        onClose={() => setGoalModalOpen(false)}
        onSaved={refresh}
      />

      {/* Goals check-in reminder */}
      {goalPromptOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className={`rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center relative ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <button
              onClick={dismissGoalPrompt}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              x
            </button>
            <h2 className="text-xl font-bold mb-2">{t('dashboard', 'goalPromptTitle')}</h2>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('dashboard', 'goalPromptBody')}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { dismissGoalPrompt(); const first = dashboardData?.goalsData?.goals?.[0]; if (first) openEditGoal(first); }}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2.5 rounded-lg text-sm"
              >
                {t('dashboard', 'updateGoals')}
              </button>
              <button
                onClick={dismissGoalPrompt}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium border ${colors.buttonBg}`}
              >
                {t('dashboard', 'later')}
              </button>
            </div>
          </div>
        </div>
      )}

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
 
