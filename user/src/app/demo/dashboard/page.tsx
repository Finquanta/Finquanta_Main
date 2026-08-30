'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, Trash2, Lock, Pencil } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import { useAsk } from '@/components/user_dashboard/ConfirmProvider';
import { demoColors } from '@/lib/demo/theme';
import { useDemoSession } from '@/lib/demo/DemoSessionProvider';
import { deleteTransaction } from '@/lib/demo/api/transactions';
import { Group, assignToGroup, getGroups } from '@/lib/demo/api/groups';
import {
  AccountingBasis, LedgerTransaction, deleteEntry, listLedgerTransactions,
} from '@/lib/demo/api/accounting';
import { DemoSummaryCardKey, getDemoHealthScore, getDemoRevenue, getDemoSummaryCards } from '@/lib/demo/dashboard';
import { RevenueMetric } from '@/lib/api/dashboard';
import HealthScoreCard from '@/components/user_dashboard/health/HealthScoreCard';
import RevenueChart, { METRICS } from '@/components/user_dashboard/dashboard/RevenueChart';
import DemoBookkeepingModal, { DemoEditableEntry } from '@/components/demo/DemoBookkeepingModal';
import DemoCaptureButton from '@/components/demo/DemoCaptureButton';
import { demoErrorText } from '@/lib/demo/errors';

/**
 * The demo dashboard. Laid out exactly like the signed-in one — health score,
 * quick actions, summary cards, the unified bookkeeping list, then the revenue
 * chart beside a goals card — and it renders the real HealthScoreCard and
 * RevenueChart components, fed from the demo ledger via their `source` prop.
 *
 * Goals and reminders are the one card that's shown locked: they're stored
 * server-side per account, and faking them would misrepresent what the demo is.
 */

const money = (n: number) =>
  `$${Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DIRECTION_KEY: Record<LedgerTransaction['direction'], string> = {
  in: 'cashflow',
  out: 'expense',
  owed_to_you: 'owedToYou',
  you_owe: 'youOwe',
};

const DIRECTION_STYLE: Record<LedgerTransaction['direction'], string> = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-orange-100 text-orange-700',
  owed_to_you: 'bg-blue-100 text-blue-700',
  you_owe: 'bg-purple-100 text-purple-700',
};

export default function DemoDashboardPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { refresh, recordInteraction } = useDemoSession();
  const isDark = theme === 'dark';
  const { ask } = useAsk();
  const [error, setError] = useState<string | null>(null);
  const c = demoColors(isDark);
  const card = c.card;
  const buttonBg = c.buttonBg;

  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [basis, setBasis] = useState<AccountingBasis>('cash');
  const [rows, setRows] = useState<LedgerTransaction[]>([]);
  const [cards, setCards] = useState<{ key: DemoSummaryCardKey; amount: string }[]>([]);
  const [revMetric, setRevMetric] = useState<RevenueMetric>('revenue');
  const [revTotal, setRevTotal] = useState<number | null>(null);
  // id → {name,color} so a row's groupId can render as a readable chip, and
  // 'none' for Unassigned. Empty filter = show everything, same as the real card.
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  // Reveals the double-entry behind each row, same as the registered card.
  const [accountantView, setAccountantView] = useState(false);
  // The entry the modal is editing, or null when it's creating.
  const [editing, setEditing] = useState<DemoEditableEntry | null>(null);

  /**
   * Rebuilt only when the language changes: the card re-fetches whenever this
   * identity changes, so an inline arrow here would loop forever.
   */
  const healthSource = useMemo(
    () => () => getDemoHealthScore(t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  );

  const reload = useCallback(async () => {
    const [txs, summary, gs] = await Promise.all([
      listLedgerTransactions(basis, 100),
      getDemoSummaryCards(),
      getGroups(),
    ]);
    setRows(txs);
    setCards(summary);
    setGroups(gs);
  }, [basis]);

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, { name: g.name, color: g.color }])),
    [groups]
  );

  const toggleGroupFilter = (key: string) =>
    setGroupFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  /** Rows matching any selected group. Nothing selected = everything. */
  const visibleRows = useMemo(() => {
    if (groupFilter.length === 0) return rows;
    return rows.filter((r) => groupFilter.includes(r.groupId ?? 'none'));
  }, [rows, groupFilter]);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  const onSaved = () => { setRefreshKey((n) => n + 1); refresh(); };

  /**
   * Move a row into a group, straight from the list. Mirrors the registered
   * dashboard's assignLedgerGroup; the demo's assignToGroup carries the rule
   * that an invoice's entries move together with the invoice.
   */
  const assignGroup = async (row: LedgerTransaction, gid: string | null) => {
    try {
      await assignToGroup(row.sourceType === 'invoice' ? 'invoice' : 'accrual', row.id, gid);
      onSaved();
    } catch (e) {
      setError(demoErrorText(e, t, t("dashboard","errChangeGroup")));
    }
  };

  const remove = (row: LedgerTransaction) => ask({
    title: t('demo', 'deleteConfirm').replace('{name}', row.category ?? row.description),
    body: t('dashboard', 'confirmCannotUndo'),
    tone: 'danger',
    confirmLabel: t('dashboard', 'inboxDelete'),
    onConfirm: async () => {
      setError(null);
      try {
        if (row.transactionId) await deleteTransaction(row.transactionId);
        else await deleteEntry(row.id);
        onSaved();
      } catch (e) {
        setError(demoErrorText(e, t, t("dashboard","errDeleteEntry")));
      }
    },
  });

  return (
    <div className="p-4 sm:p-6">
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Financial Health Score — the real card, scored off the demo ledger */}
      <div className="mb-4">
        <HealthScoreCard isDark={isDark} refreshKey={refreshKey} source={healthSource} />
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-end gap-2 mb-3 flex-wrap">
        <button
          onClick={() => { setEditing(null); setModalOpen(true); recordInteraction(); }}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="h-4 w-4" /> {t('demo', 'addData')}
        </button>
        <Link
          href="/demo/invoices/new"
          onClick={recordInteraction}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          <FileText className="h-4 w-4" /> {t('demo', 'createInvoice')}
        </Link>
        {/* The demo's one real AI moment. What it reads goes into the SAME entry
            modal a typed entry uses — the demo must not teach a shortcut the
            product does not have. */}
        <DemoCaptureButton
          isDark={isDark}
          onAdd={(fields) => {
            recordInteraction();
            setEditing({
              kind: 'cash',
              // A scanned receipt is money going out. The modal still lets them
              // change it, exactly as the real review popup does.
              type: 'expense',
              category: fields.vendor?.trim() || t('demo', 'dScanReadTitle'),
              description: fields.documentNumber ? `#${fields.documentNumber}` : '',
              amount: fields.total ?? 0,
              date: fields.documentDate || new Date().toISOString().slice(0, 10),
              groupId: null,
            });
            setModalOpen(true);
          }}
        />
      </div>

      {/* Summary Cards. The titles are translated here rather than in
          getDemoSummaryCards, which has no language context — building them
          there shipped three English titles into an otherwise translated page. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(['balance', 'cashflow', 'expense'] as DemoSummaryCardKey[]).map((key, i) => (
          <div key={key} className={`${card} rounded-xl p-4 shadow-sm`}>
            <p className={`text-xs mb-1 ${c.text}`}>{t('dashboard', key)}</p>
            <p className={`text-2xl font-bold ${c.heading}`}>{cards[i]?.amount ?? '$0.00'}</p>
          </div>
        ))}
      </div>

      {/* Bookkeeping Table */}
      <div className={`${card} rounded-xl p-4 shadow-sm mb-6`}>
        <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
          <h2 className={`text-sm font-semibold ${c.heading}`}>{t('dashboard', 'bookkeeping')}</h2>
          <div className="flex items-center gap-2">
            {/* Cash Basis / Accrual — the same switch the real list carries */}
            <div className={`inline-flex gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              {([['cash', 'cashBasis'], ['accrual', 'accrual']] as const).map(([val, key]) => (
                <button key={val} onClick={() => setBasis(val)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    basis === val
                      ? (isDark ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm')
                      : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                  }`}>
                  {t('demo', key)}
                </button>
              ))}
            </div>
            {/* Accountant view — the double-entry behind each row, the same
                optional detail the registered bookkeeping card offers. */}
            <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${c.subtext}`}>
              <input type="checkbox" checked={accountantView} onChange={(e) => setAccountantView(e.target.checked)} />{t("dashboard","accountantView")}</label>
            {/* Group filter — the same multi-select the registered card carries,
                including an Unassigned bucket. Hidden until a group exists, so
                a visitor who hasn't made one isn't shown an empty control. */}
            {groups.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setGroupMenuOpen((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${buttonBg}`}
                >
                  {groupFilter.length === 0 ? 'All groups' : `${groupFilter.length} selected`}
                </button>
                {groupMenuOpen && (
                  <div
                    className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg z-40 border py-1 ${
                      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    {[{ id: 'none', name: 'Unassigned', color: '#9ca3af' }, ...groups].map((g) => (
                      <button
                        key={g.id}
                        onClick={() => toggleGroupFilter(g.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                          isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <input type="checkbox" readOnly checked={groupFilter.includes(g.id)} className="pointer-events-none" />
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="truncate">{g.name}</span>
                      </button>
                    ))}
                    {groupFilter.length > 0 && (
                      <button
                        onClick={() => setGroupFilter([])}
                        className="w-full px-3 py-1.5 text-xs text-left text-blue-500 hover:underline"
                      >{t("demo","dClearFilter")}</button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={() => { setEditing(null); setModalOpen(true); recordInteraction(); }}
              className="bg-blue-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-600">
              {t('dashboard', 'addData')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${c.tableHead}`}>
                <th className="text-left pb-2">{t('demo', 'date')}</th>
                <th className="text-left pb-2">{t('demo', 'type')}</th>
                <th className="text-left pb-2">{t('demo', 'detail')}</th>
                <th className="text-left pb-2">{t("demo","dGroup")}</th>
                <th className="text-left pb-2">{t('demo', 'amount')}</th>
                <th className="text-right pb-2" />
              </tr>
            </thead>
            <tbody className={`divide-y ${c.tableRow}`}>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={6} className={`py-6 text-center ${c.subtext}`}>{t('demo', 'noEntries')}</td></tr>
              ) : (
                visibleRows.map((row) => (
                  <Fragment key={row.id}>
                  <tr>
                    <td className="py-3 whitespace-nowrap">{row.date}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIRECTION_STYLE[row.direction]}`}>
                        {t('demo', DIRECTION_KEY[row.direction])}
                      </span>
                    </td>
                    <td className="py-3">
                      {row.category ?? row.description}
                      {row.note && <span className={`block text-[11px] ${c.subtext}`}>{row.note}</span>}
                      {!row.cashMoved && <span className={`block text-[11px] ${c.subtext}`}>{t('demo', 'noCashMoved')}</span>}
                    </td>
                    <td className="py-3">
                      {/* Assignable in place, like the registered card. The
                          colour dot keeps the chip's at-a-glance read. */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: row.groupId && groupMap[row.groupId] ? groupMap[row.groupId].color : 'transparent' }}
                        />
                        <select
                          value={row.groupId ?? ''}
                          onChange={(e) => assignGroup(row, e.target.value || null)}
                          className={`text-[11px] rounded px-1 py-0.5 border ${buttonBg}`}
                          title={t("demo","dAssignGroup")}
                        >
                          <option value="">{t("demo","groupsUnassigned")}</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 whitespace-nowrap">{row.signedAmount < 0 ? '-' : '+'}{money(row.signedAmount)}</td>
                    <td className="py-3 text-right">
                      {/* Invoice and loan rows are owned by their source document. */}
                      {/* Only entries you typed are editable — invoice and loan
                          rows are owned by their source document. */}
                      {(row.transactionId || row.sourceType === 'manual') && (
                        <button
                          onClick={() => {
                            setEditing(row.transactionId ? {
                              kind: 'cash',
                              transactionId: row.transactionId,
                              type: row.signedAmount >= 0 ? 'income' : 'expense',
                              category: row.category ?? '',
                              description: row.note ?? '',
                              amount: Math.abs(row.signedAmount),
                              date: row.date ?? '',
                              groupId: row.groupId,
                            } : {
                              // Accrual: re-posted on save, so we carry the entry
                              // id and the workflow that built it.
                              kind: 'accrual',
                              entryId: row.id,
                              workflowType: row.workflowType ?? undefined,
                              type: row.signedAmount >= 0 ? 'income' : 'expense',
                              category: row.description,
                              description: '',
                              amount: Math.abs(row.signedAmount),
                              date: row.date ?? '',
                              groupId: row.groupId,
                            });
                            setModalOpen(true);
                            recordInteraction();
                          }}
                          className="text-blue-500 hover:text-blue-700 mr-2"
                          title={t("dashboard","invEdit")}
                        >
                          <Pencil className="h-4 w-4 inline" />
                        </button>
                      )}
                      {(row.transactionId || row.sourceType === 'manual') && (
                        <button onClick={() => remove(row)} className="text-red-500 hover:text-red-700" title={t('demo', 'deleteTitle')}>
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* The double-entry behind the row. Demo ledger entries carry
                      the same balanced lines a real account's do, so this shows
                      the genuine debits and credits, not a mock-up. */}
                  {accountantView && row.lines.length > 0 && (
                    <tr>
                      <td colSpan={6} className="pb-2">
                        <div className={`ml-1 pl-3 border-l ${isDark ? 'border-gray-700' : 'border-gray-200'} space-y-0.5`}>
                          {row.lines.map((l, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <span className={c.subtext}>{l.debit > 0 ? 'Debit' : 'Credit'} · {l.accountName}</span>
                              <span className={l.debit > 0 ? 'text-green-500' : 'text-red-500'}>
                                ${(l.debit > 0 ? l.debit : l.credit).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${card} rounded-xl p-4 shadow-sm`}>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <h2 className={`text-sm font-semibold ${c.heading}`}>
              {revMetric === 'revenue' ? t('dashboard', 'totalRevenue') : revMetric === 'cashflow' ? 'Total Cashflow' : 'Total Expense'}
            </h2>
            <div className="flex items-center gap-1">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setRevMetric(m.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    revMetric === m.key
                      ? 'text-white'
                      : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={revMetric === m.key ? { backgroundColor: m.color } : undefined}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className={`text-xl font-bold mb-3 ${c.heading}`}>
            {revTotal != null
              ? `$${revTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '$0.00'}
          </p>
          <RevenueChart
            isDark={isDark}
            metric={revMetric}
            onTotal={setRevTotal}
            source={getDemoRevenue}
            refreshKey={refreshKey}
          />
        </div>

        {/* Goals & reminders live on the account, so the demo shows the shape
            rather than pretending to store them. */}
        <div className={`${card} rounded-xl p-4 shadow-sm`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-1 text-sm font-semibold">
              <span className={`px-2 py-1 rounded-lg ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}>{t('dashboard', 'goals')}</span>
              {/* `reminders` lives under settings, not dashboard — asking for
                  dashboard.reminders renders the literal key. */}
              <span className={`px-2 py-1 rounded-lg ${c.subtext}`}>{t('settings', 'reminders')}</span>
            </div>
            <span className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg border ${buttonBg}`}>
              <Lock className="h-3 w-3" /> {t('demo', 'freeAccount')}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
            <p className={`text-xs max-w-[16rem] leading-relaxed ${c.subtext}`}>
              {t('demo', 'goalsLockedBody')}
            </p>
            <Link
              href="/signup"
              className="text-xs font-semibold text-white bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg"
            >
              {t('demo', 'createFreeAccount')}
            </Link>
          </div>
        </div>
      </div>

      <DemoBookkeepingModal isOpen={modalOpen} editing={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSaved={onSaved} />
    </div>
  );
}
