'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useDemoSession } from '@/lib/demo/DemoSessionProvider';
import { deleteTransaction } from '@/lib/demo/api/transactions';
import {
  AccountBalance, AccountingBasis, LedgerTransaction,
  deleteEntry, getAccounts, listLedgerTransactions,
} from '@/lib/demo/api/accounting';
import DemoBookkeepingModal from '@/components/demo/DemoBookkeepingModal';
import { useTheme } from '@/hooks/context/ThemeContext';
import { useAsk } from '@/components/user_dashboard/ConfirmProvider';
import { demoColors } from '@/lib/demo/theme';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { demoErrorText } from '@/lib/demo/errors';

const money = (n: number) => `$${Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DIRECTION_LABEL: Record<LedgerTransaction['direction'], string> = {
  in: 'Cashflow',
  out: 'Expense',
  owed_to_you: 'Owed to you',
  you_owe: 'You owe',
};

const DIRECTION_STYLE: Record<LedgerTransaction['direction'], string> = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-orange-100 text-orange-700',
  owed_to_you: 'bg-blue-100 text-blue-700',
  you_owe: 'bg-purple-100 text-purple-700',
};

export default function DemoBookkeepingPage() {
  const { t } = useLanguage();
  const { refresh, recordInteraction } = useDemoSession();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { ask } = useAsk();
  const col = demoColors(isDark);
  const [modalOpen, setModalOpen] = useState(false);
  const [basis, setBasis] = useState<AccountingBasis>('cash');
  const [rows, setRows] = useState<LedgerTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [txs, accs] = await Promise.all([listLedgerTransactions(basis, 200), getAccounts()]);
    setRows(txs);
    setAccounts(accs);
  }, [basis]);

  useEffect(() => { reload(); }, [reload]);

  const onSaved = () => { reload(); refresh(); };

  /**
   * A row is deleted through whatever owns it: a bookkeeping entry through the
   * transaction it came from, a manual accrual entry through the ledger. Rows
   * owned by an invoice or a loan aren't deletable here.
   */
  const remove = (row: LedgerTransaction) => ask({
    title: t("dashboard","errDeleteThisEntry"),
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

  const cash = accounts.find((a) => a.code === 'CASH')?.balance ?? 0;
  const revenue = accounts.find((a) => a.code === 'REVENUE')?.balance ?? 0;
  const expenses = (accounts.find((a) => a.code === 'EXPENSE')?.balance ?? 0)
    + (accounts.find((a) => a.code === 'INTEREST_EXPENSE')?.balance ?? 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className={`text-xl font-bold ${col.heading}`}>{t("dashboard","bkTitle")}</h1>
        <button
          onClick={() => { setModalOpen(true); recordInteraction(); }}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="h-4 w-4" />{t("demo","dAddEntry")}</button>
      </div>
      <p className={`text-sm mb-5 ${col.subtext}`}>
        {basis === 'cash'
          ? t("dashboard","bkCashHint")
          : t("dashboard","bkAccrualHint")}
      </p>

      {/* Basis toggle — the same two views the real Bookkeeping page offers. */}
      <div className={`inline-flex gap-1 mb-5 p-1 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
        {([['cash', 'Cash'], ['accrual', 'Accrual']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setBasis(val)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
              basis === val ? (isDark ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Business cash', value: cash },
          { label: 'Revenue', value: revenue },
          { label: 'Expenses', value: expenses },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl p-4 ${col.card}`}>
            <p className={`text-xs mb-1 ${col.subtext}`}>{c.label}</p>
            <p className={`text-2xl font-bold ${col.heading}`}>{money(c.value)}</p>
          </div>
        ))}
      </div>

      {/* What's owed — only meaningful once accrual entries exist. */}
      {basis === 'accrual' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {(['AR', 'AP', 'LOAN_PAYABLE', 'LOAN_RECEIVABLE'] as const).map((code) => {
            const acct = accounts.find((a) => a.code === code);
            if (!acct) return null;
            return (
              <div key={code} className={`rounded-xl p-4 ${col.card}`}>
                <p className={`text-xs mb-1 ${col.subtext}`}>{acct.name}</p>
                <p className={`text-xl font-bold ${col.heading}`}>{money(acct.balance)}</p>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className={`rounded-xl overflow-hidden ${col.card}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? "text-left text-gray-400 bg-gray-900/40" : "text-left text-gray-500 bg-gray-50"}>
                <th className="px-4 py-3 font-semibold">{t("demo","date")}</th>
                <th className="px-4 py-3 font-semibold">{t("demo","type")}</th>
                <th className="px-4 py-3 font-semibold">{t("demo","detail")}</th>
                <th className="px-4 py-3 font-semibold">{t("demo","amount")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className={`px-4 py-8 text-center ${col.subtext}`}>{t("demo","dNoEntries")}</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={`border-t ${col.divider}`}>
                    <td className={`px-4 py-3 whitespace-nowrap ${col.text}`}>{row.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIRECTION_STYLE[row.direction]}`}>
                        {DIRECTION_LABEL[row.direction]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${col.heading}`}>
                      {row.category ?? row.description}
                      {row.note && <span className={`block text-xs ${col.subtext}`}>{row.note}</span>}
                      {!row.cashMoved && <span className={`block text-[11px] ${col.subtext}`}>no cash moved</span>}
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${col.heading}`}>
                      {row.signedAmount < 0 ? '-' : '+'}{money(row.signedAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* Invoice and loan rows are owned by their source document. */}
                      {(row.transactionId || row.sourceType === 'manual') && (
                        <button onClick={() => remove(row)} className={`hover:text-red-500 ${col.subtext}`} title={t("demo","deleteTitle")}>
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DemoBookkeepingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSaved={onSaved} />
    </div>
  );
}
