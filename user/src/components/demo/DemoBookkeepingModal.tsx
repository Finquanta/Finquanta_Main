'use client';

import { useEffect, useState } from 'react';
import { createTransaction, updateTransaction } from '@/lib/demo/api/transactions';
import { deleteEntry, runWorkflow, WORKFLOW_META, workflowsInGroup, WorkflowType } from '@/lib/demo/api/accounting';
import { Loan, LoanType, listLoans, createLoan, recordLoanPayment, previewSplit } from '@/lib/demo/api/loans';
import { Group, createGroup, getGroups } from '@/lib/demo/api/groups';
import { demoFormOpenWhile } from '@/lib/demo/formGuard';
import { todayLocal } from '@/lib/demo/dates';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { demoErrorText } from '@/lib/demo/errors';

/**
 * The demo's entry form: Cash, Accrual and Debt, mirroring the real
 * BookkeepingModal. Kept as its own component rather than reusing that one —
 * its imports are hardcoded to the real lib/api/* modules, and it carries
 * receipts, foreign currency and Business Groups, none of which an anonymous
 * session can support.
 */

export interface DemoEditableEntry {
  /**
   * 'cash' updates the transaction in place. 'accrual' has no update path in
   * the ledger — the real dashboard re-posts it (delete + create) and so do we.
   */
  kind: 'cash' | 'accrual';
  /** Set for cash rows: the transaction to update. */
  transactionId?: string;
  /** Set for accrual rows: the ledger entry to replace. */
  entryId?: string;
  /** Set for accrual rows: which workflow built it. */
  workflowType?: WorkflowType;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  date: string;
  groupId: string | null;
}

type Basis = 'cash' | 'accrual' | 'debt';

/** The four debt actions — both directions of a loan. */
type DebtAction = 'loan_received' | 'loan_payment' | 'loan_issued' | 'loan_repayment_received';

const ACCRUAL_TYPES = workflowsInGroup('accrual');

/** Built per render so the labels and hints follow the reader's language;
    a module-level constant cannot reach the translation hook. */
const debtActions = (t: (ns: string, k: string) => string): { value: DebtAction; label: string; hint: string }[] =>
  [];

const isPaymentAction = (a: DebtAction) => a === 'loan_payment' || a === 'loan_repayment_received';
const loanTypeFor = (a: DebtAction): LoanType =>
  a === 'loan_received' || a === 'loan_payment' ? 'payable' : 'receivable';

const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const field = 'w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none';


/**
 * WORKFLOW_META is a module-level table copied from the accounting engine, so
 * its label/description can't reach the translation hook. Map the type to a key
 * at render instead, falling back to the English table for anything unmapped.
 */
const WF_KEY: Partial<Record<WorkflowType, { label: string; desc: string }>> = {
  cash_revenue: { label: 'wfMoneyIn', desc: 'wfMoneyInDesc' },
  cash_expense: { label: 'wfMoneyOut', desc: 'wfMoneyOutDesc' },
};
const workflowLabel = (t: (ns: string, k: string) => string, w: WorkflowType) =>
  WF_KEY[w] ? t('demo', WF_KEY[w]!.label) : WORKFLOW_META[w].label;
const workflowDesc = (t: (ns: string, k: string) => string, w: WorkflowType) =>
  WF_KEY[w] ? t('demo', WF_KEY[w]!.desc) : WORKFLOW_META[w].description;

export default function DemoBookkeepingModal({
  isOpen, onClose, onSaved, editing = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /**
   * An existing cash entry to edit. Absent = create. Only bookkeeping entries
   * are editable: invoice and loan rows are owned by their source document, and
   * accrual entries have no update path in the demo ledger.
   */
  editing?: DemoEditableEntry | null;
}) {
  const { t } = useLanguage();
  const [basis, setBasis] = useState<Basis>('cash');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [accrualType, setAccrualType] = useState<WorkflowType>('credit_revenue');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Debt state
  const [debtAction, setDebtAction] = useState<DebtAction>('loan_received');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState('');
  const [annualRate, setAnnualRate] = useState('');

  // Business Group (cost/profit centre)
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setGroupId('');
    setAddingGroup(false);
    setNewGroupName('');
    getGroups().then(setGroups).catch(() => setGroups([]));
    setBasis('cash');
    setType('income');
    setAccrualType('credit_revenue');
    setCategory('');
    setDescription('');
    setAmount('');
    setDate(todayLocal());
    setError(null);
    setDebtAction('loan_received');
    setLoanId('');
    setAnnualRate('');

    // Editing an existing entry: fill the form from it. Cash only — that's the
    // one basis with an update path, so the tabs are pinned there below.
    if (editing) {
      setBasis(editing.kind);
      if (editing.kind === 'accrual' && editing.workflowType) setAccrualType(editing.workflowType);
      setType(editing.type);
      setCategory(editing.category);
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setDate(editing.date);
      setGroupId(editing.groupId ?? '');
    }
  }, [isOpen, editing]);

  // Hold off the signup prompt while this is open — it's a full-screen modal
  // whose CTA navigates away, and typing in here records no interaction, so the
  // idle trigger would otherwise fire straight over a half-filled form.
  useEffect(() => demoFormOpenWhile(isOpen), [isOpen]);

  // Load the loans you can pay against when a payment action is chosen.
  useEffect(() => {
    if (!isOpen || basis !== 'debt' || !isPaymentAction(debtAction)) return;
    listLoans(loanTypeFor(debtAction))
      .then((ls) => { setLoans(ls); setLoanId(ls[0]?.id ?? ''); })
      .catch(() => setLoans([]));
  }, [isOpen, basis, debtAction]);

  if (!isOpen) return null;

  const selectedLoan = loans.find((l) => l.id === loanId) ?? null;
  const amountNum = Number(amount) || 0;
  // Live principal/interest preview — mirrors the split exactly.
  const split = selectedLoan && amountNum > 0
    ? previewSplit(amountNum, selectedLoan.remainingBalance, selectedLoan.annualRate)
    : null;

  /** Create a group without leaving the modal, and select it. */
  const addGroupInline = async () => {
    const nm = newGroupName.trim();
    if (!nm) return;
    setSavingGroup(true);
    try {
      const g = await createGroup({ name: nm });
      setGroups((prev) => [...prev, g]);
      setGroupId(g.id);
      setAddingGroup(false);
      setNewGroupName('');
    } catch (e) {
      setError(demoErrorText(e, t, t("dashboard","errCreateGroup")));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError(t("demo","vErrAmount"));
    if (!date) return setError(t("demo","vErrDate"));
    if (basis !== 'debt' && !category.trim()) return setError(t("demo","vErrName"));

    setSaving(true);
    try {
      if (basis === 'debt') {
        if (isPaymentAction(debtAction)) {
          if (!loanId) throw new Error(t("demo","vErrPickLoan"));
          await recordLoanPayment(loanId, { amount: amt, date });
        } else {
          if (!category.trim()) throw new Error(t("demo","vErrLoanName"));
          await createLoan({
            name: category.trim(),
            type: loanTypeFor(debtAction),
            amount: amt,
            annualRate: Number(annualRate) || 0,
            date,
            groupId: groupId || null,
          });
        }
      } else if (basis === 'accrual') {
        // Re-post: drop the old entry first so editing replaces it instead of
        // leaving the original on the books beside the correction.
        if (editing?.kind === 'accrual' && editing.entryId) await deleteEntry(editing.entryId);
        await runWorkflow({
          type: accrualType,
          amount: amt,
          description: category.trim() + (description.trim() ? ` — ${description.trim()}` : ''),
          date,
          groupId: groupId || null,
        });
      } else {
        const payload = {
          type,
          category: category.trim(),
          description: description.trim() || undefined,
          amount: amt,
          date,
          groupId: groupId || null,
        };
        // Editing re-posts the entry's ledger lines, so a corrected amount or
        // date moves the books with the row instead of leaving them behind.
        if (editing?.transactionId) await updateTransaction(editing.transactionId, payload);
        else await createTransaction(payload);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(demoErrorText(e, t, t("demo","vErrSaveEntry")));
    } finally {
      setSaving(false);
    }
  };

  const nameLabel = basis === 'debt' && !isPaymentAction(debtAction) ? 'Loan Name' : 'Name';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1a2e] text-white rounded-2xl p-8 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">{t("demo","dAddEntry")}</h2>

        <div className="flex gap-2 mb-1">
          {([['cash', 'Cash basis'], ['accrual', 'Accrual'], ['debt', 'Debt']] as const).map(([val, label]) => (
            <button key={val} type="button" onClick={() => setBasis(val)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-colors ${
                basis === val ? 'bg-blue-500 text-white' : 'bg-[#2a2a3e] text-gray-300 hover:bg-[#33334a]'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mb-5">
          {basis === 'cash' && t("dashboard","bkCashHint")}
          {basis === 'accrual' && 'Money owed to you or money you owe — even if no cash has moved yet.'}
          {basis === 'debt' && 'Loans you took out, and loans you gave out.'}
        </p>

        {/* DEBT — which loan is this payment against? */}
        {basis === 'debt' && isPaymentAction(debtAction) && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dWhichLoan")}</label>
            {loans.length === 0 ? (
              <p className="text-xs text-gray-400 mb-4">
                No {loanTypeFor(debtAction) === 'payable' ? 'borrowed' : 'lent-out'} loans yet — record one first.
              </p>
            ) : (
              <select value={loanId} onChange={(e) => setLoanId(e.target.value)} className={field}>
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {money(l.remainingBalance)} left @ {l.annualRate}%
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        {/* Name — a loan name in debt-create mode, otherwise the entry name */}
        {!(basis === 'debt' && isPaymentAction(debtAction)) && (
          <>
            <label className="block text-sm font-semibold mb-1">{nameLabel}</label>
            <input className={field}
              placeholder={basis === 'debt' ? 'e.g. Bank term loan' : 'e.g. Client payment'}
              value={category} onChange={(e) => setCategory(e.target.value)} />
          </>
        )}

        {basis !== 'debt' && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dDescription")}</label>
            <input className={field} placeholder={t("demo","dOptional")}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </>
        )}

        {/* Business Group. A loan PAYMENT inherits its loan's group automatically. */}
        {!(basis === 'debt' && isPaymentAction(debtAction)) && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dGroup")}<span className="text-gray-400 font-normal">(optional)</span>
            </label>
            {addingGroup ? (
              <div className="flex gap-2 mb-4">
                <input
                  autoFocus
                  className="flex-1 bg-[#2a2a3e] rounded-lg px-4 py-2 text-sm outline-none"
                  placeholder={t("demo","dPhGroup")}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroupInline(); } }}
                />
                <button type="button" onClick={addGroupInline} disabled={savingGroup || !newGroupName.trim()}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 rounded-lg">Add</button>
                <button type="button" onClick={() => { setAddingGroup(false); setNewGroupName(''); }}
                  className="text-sm text-gray-400 px-2">{t("demo","cancel")}</button>
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <select className="flex-1 bg-[#2a2a3e] rounded-lg px-4 py-2 text-sm outline-none"
                  value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">{t("dashboard","invNoGroup")}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button type="button" onClick={() => setAddingGroup(true)}
                  className="text-sm font-semibold px-3 rounded-lg border border-gray-600 text-gray-200 whitespace-nowrap hover:bg-gray-700">+ New</button>
              </div>
            )}
          </>
        )}

        <label className="block text-sm font-semibold mb-1">
          {basis === 'debt' && isPaymentAction(debtAction) ? 'Payment Amount' : 'Amount'}
        </label>
        <input className={field} type="number" placeholder="0.00"
          value={amount} onChange={(e) => setAmount(e.target.value)} />

        {/* Interest rate when creating a loan */}
        {basis === 'debt' && !isPaymentAction(debtAction) && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dAnnualRate")}</label>
            <input className={field} type="number" step="0.01" min="0"
              placeholder="e.g. 7.5" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
          </>
        )}

        {basis === 'debt' && (
          <>
            <label className="block text-sm font-semibold mb-2">{t("demo","dDebtType")}</label>
            <div className="flex flex-col gap-2 mb-2">
              {debtActions(t).map((a) => (
                <label key={a.value} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="debtAction" className="mt-1" checked={debtAction === a.value}
                    onChange={() => setDebtAction(a.value)} />
                  <span className="text-sm">{a.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4">{debtActions(t).find((a) => a.value === debtAction)?.hint}</p>
          </>
        )}

        {/* Live principal vs interest breakdown for a loan payment */}
        {basis === 'debt' && isPaymentAction(debtAction) && split && selectedLoan && (
          <div className="bg-[#2a2a3e] rounded-lg p-3 mb-4 text-xs">
            <p className="font-semibold mb-2">{t("demo","dBreakdown")}</p>
            <div className="flex justify-between mb-1">
              <span className="text-gray-300">Interest ({selectedLoan.annualRate}% ÷ 12 on {money(selectedLoan.remainingBalance)})</span>
              <span className="text-orange-400">{money(split.interest)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-300">{t("demo","dPrincipal")}</span>
              <span className="text-green-400">{money(split.principal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#3a3a4e]">
              <span className="text-gray-300">{t("demo","dBalanceAfter")}</span>
              <span className="font-semibold">{money(split.balanceAfter)}</span>
            </div>
          </div>
        )}

        {basis === 'cash' && (
          <>
            <label className="block text-sm font-semibold mb-2">{t("demo","type")}</label>
            <div className="flex flex-col gap-2 mb-4">
              {(['income', 'expense'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${t === 'income' ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'}`}>
                    {t === 'income' ? 'Cashflow' : 'Expense'}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {basis === 'accrual' && (
          <>
            <label className="block text-sm font-semibold mb-2">{t("demo","type")}</label>
            <div className="flex flex-col gap-2 mb-2">
              {/* `wt`, not `t` — the loop variable used to shadow the translation
                  function, which is why these labels could never be translated. */}
              {ACCRUAL_TYPES.map((wt) => (
                <label key={wt} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="accrualType" className="mt-1" checked={accrualType === wt}
                    onChange={() => setAccrualType(wt)} />
                  <span className="text-sm">{workflowLabel(t, wt)}</span>
                  {!WORKFLOW_META[wt].affectsCash && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2a2a3e] text-gray-300">{t("demo","noCash")}</span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4">{workflowDesc(t, accrualType)}</p>
          </>
        )}

        <label className="block text-sm font-semibold mb-1">{t("demo","date")}</label>
        <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button disabled={saving} onClick={handleSubmit}
          className="w-full bg-[#4CAF50] hover:bg-[#45a049] disabled:opacity-60 text-white font-bold py-3 rounded-full">
          {saving ? 'Saving…' : 'Add entry'}
        </button>
      </div>
    </div>
  );
}
