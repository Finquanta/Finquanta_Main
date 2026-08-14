"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, ChevronDown, Bell, LogOut, X, Pencil, Trash2, Check, Paperclip, RefreshCw, MessageSquare, Menu, Plus, FileText } from 'lucide-react';
import { logoutAndRedirect } from '@/lib/auth';
import { isFinnaHidden, setFinnaHidden } from '@/lib/finnaVisibility';
import BookkeepingModal, { BookkeepingEditing, DebtAction } from '@/components/user_dashboard/bookkeeping/BookkeepingModal';
import BookkeepingCard from '@/components/user_dashboard/bookkeeping/BookkeepingCard';
import HealthScoreCard from '@/components/user_dashboard/health/HealthScoreCard';
import TourGuide from '@/components/user_dashboard/tour/TourGuide';
import ReferralIdChip from '@/components/user_dashboard/ReferralIdChip';
import { InboxItem, getNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api/notifications';
import { LedgerTransaction, deleteEntry, WorkflowType } from '@/lib/api/accounting';
import { deleteLoan, deleteLoanPayment, listLoans, listLoanPayments } from '@/lib/api/loans';
import { assignToGroup } from '@/lib/api/groups';
import { deleteInvoice } from '@/lib/api/invoices';
import GoalModal, { GoalEditing } from '@/components/user_dashboard/dashboard/GoalModal';
import { useLanguage, LANGUAGE_OPTIONS as LANGUAGES } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import { DashboardOverviewResponse, getDashboardOverview, deleteGoal, RevenueMetric } from '@/lib/api/dashboard';
import { deleteTransaction, createTransaction, getReceiptObjectUrl, Recurrence } from '@/lib/api/transactions';
import { getMe, updateName, finquantaAccountId, CurrentUser } from '@/lib/api/me';
import { resendVerification } from '@/lib/api/verify';
import { getBusinessProfile } from '@/lib/api/business';
import { checkAdmin } from '@/lib/api/admin';
import { Reminder, getReminders, createReminder, updateReminder, deleteReminder } from '@/lib/api/reminders';
import RevenueChart, { METRICS } from '@/components/user_dashboard/dashboard/RevenueChart';
import WorkspaceSwitcher from '@/components/user_dashboard/WorkspaceSwitcher';

const RECENTLY_DELETED_KEY = 'recentlyDeletedTx';

type DeletedEntry = DashboardOverviewResponse['latestTransactions'][number] & { deletedAt: number };

const GOAL_PROMPT_DISMISSED_KEY = 'goalPromptDismissedAt';
const GOAL_STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
 


export default function DashboardPage() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  /** Read after mount — localStorage doesn't exist during the server render. */
  const [finnaHidden, setFinnaHiddenState] = useState(false);
  useEffect(() => { setFinnaHiddenState(isFinnaHidden()); }, []);
  const router = useRouter();

  const [bookkeepingModalOpen, setBookkeepingModalOpen] = useState(false);
  const [bookkeepingEditing, setBookkeepingEditing] = useState<BookkeepingEditing | null>(null);
  const [bookkeepingRefresh, setBookkeepingRefresh] = useState(0);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalEditing, setGoalEditing] = useState<GoalEditing | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile/tablet off-canvas drawer
  const [revMetric, setRevMetric] = useState<RevenueMetric>('revenue'); // revenue card: revenue/cashflow/expense
  const [revTotal, setRevTotal] = useState<number | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardOverviewResponse | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Real notifications, pushed from the admin panel.
  const [notifications, setNotifications] = useState<InboxItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, []);

  const [me, setMe] = useState<CurrentUser | null>(null);
  const [verifyResent, setVerifyResent] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
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

  // Summary-card period (Balance/Cashflow/Expense + revenue context)
  const [cardPeriod, setCardPeriod] = useState<'all' | '30d' | '3m' | 'month'>('all');
  const [periodMonth, setPeriodMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const computeRange = useCallback((): { startDate: string; endDate: string } | undefined => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (cardPeriod === 'all') return { startDate: '1970-01-01', endDate: '2999-12-31' };
    if (cardPeriod === '30d') { const s = new Date(today); s.setDate(s.getDate() - 29); return { startDate: iso(s), endDate: iso(today) }; }
    if (cardPeriod === '3m') { const s = new Date(today); s.setMonth(s.getMonth() - 3); return { startDate: iso(s), endDate: iso(today) }; }
    const [y, m] = periodMonth.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { startDate: iso(start), endDate: iso(end) };
  }, [cardPeriod, periodMonth]);

  const refresh = useCallback(() => {
    return getDashboardOverview(computeRange())
      .then(setDashboardData)
      .catch(() => setDashboardData(null));
  }, [computeRange]);

  /**
   * After saving a bookkeeping entry (new or edited), refresh EVERYTHING that
   * reads the ledger — the summary cards (refresh) AND the Bookkeeping table and
   * Health Score card, which key off bookkeepingRefresh. Without the bump, those
   * two only updated on a full page reload.
   */
  const refreshAfterBookkeeping = useCallback(() => {
    setBookkeepingRefresh((n) => n + 1);
    return refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh when Finna changes data, or when the active business (workspace)
  // switches. Switching workspaces has to refresh the BOOKS too, not just the
  // summary cards — otherwise the Bookkeeping table and Health Score card kept
  // showing the previous workspace until a full page reload.
  useEffect(() => {
    const handler = () => { refreshAfterBookkeeping(); loadReminders(); };
    window.addEventListener('finna:dataChanged', handler);
    window.addEventListener('finna:businessChanged', handler);
    return () => {
      window.removeEventListener('finna:dataChanged', handler);
      window.removeEventListener('finna:businessChanged', handler);
    };
  }, [refreshAfterBookkeeping, loadReminders]);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  // Show the Admin Panel link only to admins / super admins / owners.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    checkAdmin().then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
  }, []);

  // If onboarding wasn't completed, send the user to finish it — unless they
  // chose "Skip for now" earlier this session. This means an unfinished
  // onboarding keeps being asked each time they log back in.
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('onboardingSkipped')) return;
    getBusinessProfile()
      .then((b) => { if (!b?.onboardingCompleted) router.replace('/onboarding'); })
      .catch(() => {});
  }, [router]);

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

  /**
   * The Bookkeeping list is ledger-backed, so a row can come from an invoice or
   * a loan. Only rows you typed yourself carry a `transactionId` — those are the
   * ones we can edit or delete here. Anything else must be changed at its source
   * (the invoice, the loan), or the books would disagree with the document.
   */
  const editLedgerRow = (tx: LedgerTransaction) => {
    if (!tx.transactionId) return;
    setBookkeepingEditing({
      id: tx.transactionId,
      invoiceName: tx.category ?? tx.description,
      invoiceDescription: tx.note ?? '', // was hardcoded '', which wiped the note on edit
      invoiceAmount: String(Math.abs(tx.signedAmount)), // USD stored
      invoiceType: tx.direction === 'in' ? 'Cashflow' : 'Expense',
      dateOfInvoice: tx.date ?? '',
      recurrence: (tx.recurrence as Recurrence) ?? 'once',
      hasReceipt: tx.hasReceipt,
      currency: tx.currency ?? undefined,
      originalAmount: tx.originalAmount ?? undefined,
      groupId: tx.groupId ?? undefined,
    });
    setBookkeepingModalOpen(true);
  };

  const deleteLedgerRow = async (tx: LedgerTransaction) => {
    if (!tx.transactionId) return;
    if (!window.confirm(`Delete “${tx.category ?? tx.description}”?`)) return;
    try {
      await deleteTransaction(tx.transactionId);
      setBookkeepingRefresh((n) => n + 1);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("dashboard","errDeleteEntry"));
    }
  };

  /**
   * Deleting an invoice row from Bookkeeping. The backend erases the invoice's
   * journal entries outright — no reversing entry — so it disappears from the
   * books completely. The document goes to the recycle bin, and restoring it
   * puts the same entries back.
   */
  const deleteInvoiceRow = async (tx: LedgerTransaction) => {
    if (!tx.sourceId) return;
    const ok = window.confirm(
      'This removes the invoice from your books completely, as if it had never been raised.\n\n' +
      'It goes to Invoices → Recycle Bin, where you can restore it. Continue?'
    );
    if (!ok) return;
    try {
      await deleteInvoice(tx.sourceId);
      setBookkeepingRefresh((n) => n + 1);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete that invoice.');
    }
  };

  /**
   * Loan and accrual rows have no source document to edit — they're posted
   * straight to the ledger. So we manage them in place: assign a group, or
   * delete (edit = delete + re-add). A loan is deleted whole (principal +
   * every payment); an accrual entry is deleted on its own.
   */
  const assignLedgerGroup = async (tx: LedgerTransaction, groupId: string | null) => {
    // A loan's PRINCIPAL row groups the whole loan (loans.group_id); a payment
    // or accrual row groups its own ledger entry — a payment then overrides the
    // loan's group for that payment, else it inherits it.
    const isLoanPrincipal = tx.sourceType === 'loan_received' || tx.sourceType === 'loan_issued';
    const id = isLoanPrincipal ? tx.sourceId : tx.id;
    if (!id) return;
    try {
      await assignToGroup(isLoanPrincipal ? 'loan' : 'accrual', id, groupId);
      setBookkeepingRefresh((n) => n + 1);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("dashboard","errChangeGroup"));
    }
  };

  /**
   * Edit a loan or accrual row: open the modal pre-filled in the right basis.
   * Saving re-posts the entry (delete + create) — handled in the modal. Loans
   * need their rate/name/payments, which the ledger row doesn't carry, so we
   * fetch them first.
   */
  const editLedgerEntry = async (tx: LedgerTransaction) => {
    try {
      if (tx.sourceType === 'loan_payment' || tx.sourceType === 'loan_repayment_received') {
        if (!tx.sourceId) return;
        // Edit a payment: open in payment mode, re-post on save (reverse + record).
        setBookkeepingEditing({
          id: tx.id,
          invoiceName: '',
          invoiceDescription: '',
          invoiceAmount: String(Math.abs(tx.signedAmount)),
          invoiceType: 'Cashflow',
          dateOfInvoice: tx.date ?? '',
          recurrence: 'once',
          hasReceipt: false,
          groupId: tx.groupId ?? undefined,
          ledger: { kind: 'loanPayment', paymentEntryId: tx.id, loanId: tx.sourceId, debtAction: tx.sourceType as DebtAction },
        });
        setBookkeepingModalOpen(true);
        return;
      }
      if (tx.sourceType.startsWith('loan')) {
        if (!tx.sourceId) return;
        const [loans, payments] = await Promise.all([listLoans(), listLoanPayments(tx.sourceId)]);
        const loan = loans.find((l) => l.id === tx.sourceId);
        if (!loan) return alert('Could not find that loan to edit.');
        setBookkeepingEditing({
          id: tx.id,
          invoiceName: loan.name,
          invoiceDescription: '',
          invoiceAmount: String(loan.principal),
          invoiceType: 'Cashflow',
          dateOfInvoice: loan.startDate ?? tx.date ?? '',
          recurrence: 'once',
          hasReceipt: false,
          groupId: tx.groupId ?? undefined,
          ledger: {
            kind: 'loan',
            loanId: loan.id,
            debtAction: tx.sourceType as DebtAction,
            annualRate: loan.annualRate,
            hasPayments: payments.length > 0,
          },
        });
      } else {
        setBookkeepingEditing({
          id: tx.id,
          invoiceName: tx.description,
          invoiceDescription: '',
          invoiceAmount: String(Math.abs(tx.signedAmount)),
          invoiceType: 'Cashflow',
          dateOfInvoice: tx.date ?? '',
          recurrence: 'once',
          hasReceipt: false,
          groupId: tx.groupId ?? undefined,
          ledger: { kind: 'accrual', entryId: tx.id, accrualType: tx.sourceType as WorkflowType },
        });
      }
      setBookkeepingModalOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not open that entry for editing.');
    }
  };

  const deleteLedgerEntry = async (tx: LedgerTransaction) => {
    const isLoanPayment = tx.sourceType === 'loan_payment' || tx.sourceType === 'loan_repayment_received';
    const isLoanPrincipal = tx.sourceType === 'loan_received' || tx.sourceType === 'loan_issued';
    const ok = window.confirm(
      isLoanPayment
        ? 'Reverse this payment? The loan balance will be restored.'
        : isLoanPrincipal
          ? 'Delete this loan and every payment recorded against it? This cannot be undone.'
          : `Delete “${tx.description}”? This cannot be undone.`
    );
    if (!ok) return;
    try {
      if (isLoanPayment) {
        await deleteLoanPayment(tx.id);
      } else if (isLoanPrincipal) {
        if (!tx.sourceId) return;
        await deleteLoan(tx.sourceId);
      } else {
        await deleteEntry(tx.id);
      }
      setBookkeepingRefresh((n) => n + 1);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("dashboard","errDeleteEntry"));
    }
  };

  const openNewBookkeeping = () => { setBookkeepingEditing(null); setBookkeepingModalOpen(true); };
  const openEditBookkeeping = (tx: DashboardOverviewResponse['latestTransactions'][number]) => {
    setBookkeepingEditing({
      id: tx.id,
      invoiceName: tx.name,
      invoiceDescription: tx.detail,
      invoiceAmount: String(Math.abs(tx.price)),
      invoiceType: tx.type === 'Expense' ? 'Expense' : 'Cashflow',
      dateOfInvoice: tx.date,
      recurrence: (tx.recurrence as Recurrence) ?? 'once',
      hasReceipt: tx.hasReceipt,
    });
    setBookkeepingModalOpen(true);
  };

  const viewReceipt = async (id: string) => {
    try {
      const url = await getReceiptObjectUrl(id);
      window.open(url, '_blank');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not open receipt.');
    }
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
        category: entry.name || 'General',
        description: entry.detail || undefined,
        amount: Math.abs(entry.price),
        date: entry.date,
        recurrence: (entry.recurrence as Recurrence) ?? 'once',
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
    setNameError(null);
    setEditingName(true);
  };
  const saveName = async () => {
    const parts = nameDraft.trim().split(/\s+/);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    if (!firstName) { setEditingName(false); return; }
    setNameError(null);
    try {
      await updateName({ firstName, lastName });
      setMe((prev) => (prev ? { ...prev, firstName, lastName } : prev));
      setEditingName(false);
    } catch (e) {
      // Stay open and say why. Swallowing this made a rejected save look
      // identical to the feature being broken — the name just snapped back.
      setNameError(e instanceof Error ? e.message : 'Could not save your name.');
    }
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

  // Remind unverified users to confirm their email (non-blocking — they can
  // still use the dashboard). Counts toward the unread badge.
  const showVerify = !!me && !me.emailVerified;
  const unreadCount = notifications.filter(n => !n.read).length + (showVerify ? 1 : 0);

  const handleResendVerification = async () => {
    if (!me) return;
    try { await resendVerification(me.email); } finally { setVerifyResent(true); }
  };
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

  /**
   * Read state lives on the server, so it follows the user across devices.
   * The UI updates immediately and the request goes out behind it — a failed
   * mark-as-read isn't worth blocking on or shouting about.
   */
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  /** Clicking a notification marks it read. It stays in the inbox. */
  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    markNotificationRead(id).catch(() => {});
  };

  const handleLogout = () => {
    logoutAndRedirect('/login');
  };

  return (
    <div className={`flex h-screen ${colors.bg}`} onClick={() => setClickCount(c => c + 1)}>
      {/* Mobile/tablet overlay behind the drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* SIDEBAR — static on desktop, off-canvas drawer on tablet/mobile */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 w-56 sm:w-48 ${colors.sidebar} border-r flex flex-col py-6 px-4 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="mb-8 flex items-center justify-between">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
          <button onClick={() => setSidebarOpen(false)} className={`lg:hidden p-1 rounded-md ${colors.text}`} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-2" data-tour="sidebar">
          {/* Keep this list in step with NAV in DashboardSidebar.tsx — this page
              builds its own sidebar instead of using DashboardShell, so a link
              added there does not appear here. */}
          <Link href="/brain" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'brainTitle')}
          </Link>
          <Link href="/dashboard" className="text-sm font-semibold text-orange-500 bg-orange-50 px-3 py-2 rounded-lg">
            {t('dashboard', 'title')}
          </Link>
          <Link href="/invoices" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'invoices')}
          </Link>
          <Link href="/customers" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'customers')}
          </Link>
          <Link href="/activity" data-tour="activity" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'activity')}
          </Link>
          <Link href="/groups" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'groups')}
          </Link>
          <Link href="/referrals" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'referAB')}
          </Link>
          <Link href="/profile-settings" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            {t('dashboard', 'settings')}
          </Link>
          {isAdmin && (
            <Link href="/admin-users" className={`text-sm font-medium px-3 py-2 rounded-lg ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}>
              {t('dashboard', 'adminPanel')}
            </Link>
          )}
        </nav>

        {/* The legal documents used to sit loose down here. They now live under
            Settings → Legal, which keeps this to what you actually click. */}
        <div className="mt-auto flex flex-col gap-2 text-xs">
          <p className={`mt-4 ${colors.subtext}`}>{t('dashboard', 'finquantaId')}: {accountId}</p>
          {/* Duplicated from DashboardSidebar.tsx — keep the two in step until
              this inline copy is finally removed, or the version a user sees
              depends on which page they happen to be on. */}
          <p className={colors.subtext}>{t('dashboard', 'version')} 2.0.0</p>
          <a
            href="https://airtable.com/appvpi5gHRidiIhw8/pagLtSSYVhxqHrWFk/form"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-1 font-medium text-green-600 hover:text-green-700 hover:underline"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {t('dashboard', 'sendFeedback')}
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-left font-medium text-red-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('settings', 'logOut')}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`${colors.topbar} border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-2`}>
          {/* Left */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 -ml-2 rounded-lg border transition-colors ${colors.buttonBg}`}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              {editingName ? (
                <div className="relative flex items-center gap-1">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className={`text-sm font-medium rounded px-2 py-0.5 w-40 outline-none border ${nameError ? 'border-red-500' : colors.input}`}
                    placeholder={t('dashboard', 'yourName')}
                  />
                  <button onClick={saveName} className="text-green-500 hover:text-green-600" title={t('dashboard', 'saveChanges')}>
                    <Check className="h-4 w-4" />
                  </button>
                  {/* Absolute so a failed save can't push the nav bar around. */}
                  {nameError && (
                    <span className="absolute top-full left-0 mt-1 whitespace-nowrap text-xs text-red-500">{nameError}</span>
                  )}
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
            <WorkspaceSwitcher isDark={isDark} />
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Finquanta ID — click to copy your referral link */}
            <ReferralIdChip isDark={isDark} />

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
                    {showVerify && (
                      <div className={`flex items-start gap-3 px-4 py-3 border-b ${colors.notifItem} ${isDark ? 'bg-gray-700/50' : 'bg-amber-50'}`}>
                        <div className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t("dashboard","dashVerifyTitle")}</p>
                          <p className={`text-xs mt-0.5 ${colors.text}`}>{t("dashboard","dashVerifyBody")}</p>
                          {verifyResent ? (
                            <p className="text-[11px] mt-1 text-green-500">{t("dashboard","dashVerifySent")}</p>
                          ) : (
                            <button onClick={handleResendVerification} className="text-[11px] mt-1 text-blue-500 hover:underline">{t("dashboard","dashResendVerify")}</button>
                          )}
                        </div>
                      </div>
                    )}
                    {notifications.length === 0 && !showVerify ? (
                      <p className={`text-xs text-center py-6 ${colors.text}`}>
                        {t('notifications', 'noNotifications')}
                      </p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => dismissNotification(n.id)}
                          className={`flex items-start gap-3 px-4 py-3 border-b transition-colors cursor-pointer ${colors.notifItem} ${
                            !n.read ? (isDark ? 'bg-gray-700/50' : 'bg-blue-50') : ''
                          }`}
                        >
                          <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {n.title}
                            </p>
                            <p className={`text-xs mt-0.5 whitespace-pre-wrap ${colors.text}`}>
                              {n.body}
                            </p>
                            <p className={`text-[10px] mt-1 ${colors.subtext}`}>
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
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

            {/* Show/hide Finna. Duplicated from DashboardShell.tsx — this page
                still builds its own bar, so the two must be kept in step. */}
            <button
              onClick={() => { const next = !finnaHidden; setFinnaHidden(next); setFinnaHiddenState(next); }}
              title={t('dashboard', finnaHidden ? 'finnaOff' : 'finnaOn')}
              className={`px-3 py-1 rounded-lg text-xs font-medium border ${colors.buttonBg} ${
                finnaHidden ? 'opacity-50' : ''
              }`}
            >
              {t('dashboard', finnaHidden ? 'finnaOff' : 'finnaOn')}
            </button>

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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Summary period selector */}
          <div className="flex items-center flex-wrap gap-2 mb-3">
            {([
              { key: 'all', label: t('dashboard', 'allTime') },
              { key: '30d', label: t('dashboard', 'last30Days') },
              { key: '3m', label: t('dashboard', 'threeMonths') },
              { key: 'month', label: t('dashboard', 'periodMonth') },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setCardPeriod(opt.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  cardPeriod === opt.key ? 'bg-blue-500 text-white' : colors.buttonBg
                }`}
              >
                {opt.label}
              </button>
            ))}
            {cardPeriod === 'month' && (
              <input
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className={`text-xs rounded-lg px-2 py-1 border outline-none ${colors.input}`}
              />
            )}
          </div>

          {/* Financial Health Score — top of the dashboard (Section 11) */}
          <div className="mb-4" data-tour="health">
            <HealthScoreCard isDark={isDark} refreshKey={bookkeepingRefresh} />
          </div>

          {/* Quick actions — sit directly above the Balance / Cashflow / Expense cards */}
          <div className="flex items-center justify-end gap-2 mb-3 flex-wrap" data-tour="actions">
            <button
              onClick={() => { setBookkeepingEditing(null); setBookkeepingModalOpen(true); }}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              <Plus className="h-4 w-4" />{t("dashboard","dashAddData")}</button>
            <Link
              href="/invoices/new"
              data-tour="invoices"
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              <FileText className="h-4 w-4" />{t("dashboard","dashCreateInvoice")}</Link>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" data-tour="summary">
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
                <span>{t('dashboard', 'deleted')} “{lastUndo.name || lastUndo.detail}”.</span>
                <button onClick={() => restoreTransaction(lastUndo)} className="font-semibold text-blue-500 hover:text-blue-700">
                  {t('dashboard', 'undo')}
                </button>
              </div>
            )}

            {/* One list, everything in it: your entries plus invoices and loans.
                Cash Basis / Accrual switches what counts; "Accountant view"
                reveals the double-entry behind each row. */}
            <div data-tour="bookkeeping">
              <BookkeepingCard
                isDark={isDark}
                refreshKey={bookkeepingRefresh}
                colors={colors}
                t={t}
                onEdit={editLedgerRow}
                onDelete={deleteLedgerRow}
                onDeleteInvoice={deleteInvoiceRow}
                onAssignGroup={assignLedgerGroup}
                onDeleteLedger={deleteLedgerEntry}
                onEditLedger={editLedgerEntry}
                onViewReceipt={viewReceipt}
              />
            </div>

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
                          {entry.date} · {entry.type} · {entry.name || entry.detail} · ${Math.abs(entry.price).toFixed(2)}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Total Revenue / Cashflow / Expense */}
            <div className={`${colors.card} rounded-xl p-4 shadow-sm`} data-tour="chart">
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {revMetric === 'revenue' ? t('dashboard', 'totalRevenue') : revMetric === 'cashflow' ? 'Total Cashflow' : 'Total Expense'}
                </h2>
                <div className="flex items-center gap-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setRevMetric(m.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        revMetric === m.key ? 'text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={revMetric === m.key ? { backgroundColor: m.color } : undefined}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {revTotal != null ? `$${revTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (dashboardData?.totalFinancesData?.highlightValue ?? '$0.00')}
              </p>
              <RevenueChart isDark={isDark} metric={revMetric} onTotal={setRevTotal} />
            </div>

            <div className={`${colors.card} rounded-xl p-4 shadow-sm`} data-tour="goals">
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
                    {/* Under settings, not dashboard — dashboard.reminders
                        doesn't exist and renders as the literal key. */}
                    {t('settings', 'reminders')}
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
        onSaved={refreshAfterBookkeeping}
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

      {/* 5-step tour — runs itself for a new user, restartable from Settings */}
      <TourGuide isDark={isDark} />
    </div>
  );
}
 
