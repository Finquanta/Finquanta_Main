'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createTransaction, updateTransaction, uploadReceipt, Recurrence } from '@/lib/api/transactions';
import { CURRENCIES, Currency, FxRate, getFxRate } from '@/lib/api/fx';
import { Group, getGroups, createGroup } from '@/lib/api/groups';
import { WorkflowType, WORKFLOW_META, workflowsInGroup, runWorkflow, deleteEntry } from '@/lib/api/accounting';
import { Loan, LoanType, listLoans, createLoan, recordLoanPayment, previewSplit, deleteLoan, deleteLoanPayment } from '@/lib/api/loans';
import { useLanguage } from '@/hooks/context/LanguageContext';

/** The four debt actions — both directions of a loan. */
export type DebtAction = 'loan_received' | 'loan_payment' | 'loan_issued' | 'loan_repayment_received';

export interface BookkeepingEditing {
  id: string;
  invoiceName: string;
  invoiceDescription: string;
  invoiceAmount: string;
  invoiceType: 'Cashflow' | 'Expense';
  dateOfInvoice: string;
  recurrence: Recurrence;
  hasReceipt: boolean;
  /** If the entry was made in a foreign currency, so an edit can preserve it. */
  currency?: string;
  originalAmount?: number | null;
  /** Business Group this entry is assigned to, so an edit can preserve it. */
  groupId?: string | null;
  /**
   * Set when editing a LEDGER entry (accrual or loan) rather than a cash entry.
   * These have no source document, so an edit re-posts them: delete the old,
   * create the new. Absent for ordinary cash-entry edits.
   */
  ledger?:
    | { kind: 'accrual'; entryId: string; accrualType: WorkflowType }
    | { kind: 'loan'; loanId: string; debtAction: DebtAction; annualRate: number; hasPayments: boolean }
    | { kind: 'loanPayment'; paymentEntryId: string; loanId: string; debtAction: DebtAction };
}

interface BookkeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editing?: BookkeepingEditing | null;
  /** Receipts belong to bookkeeping entries; the quick "Add data" can hide them. */
  allowReceipt?: boolean;
}

type Basis = 'cash' | 'accrual' | 'debt';

/** Accrual options: receivables and payables (loans live under Debt). */
const ACCRUAL_TYPES = workflowsInGroup('accrual');

/** Built per render so the labels and hints follow the reader's language;
    a module-level constant cannot reach the translation hook. */
const debtActions = (t: (ns: string, k: string) => string): { value: DebtAction; label: string; hint: string }[] =>
  [];
const isPaymentAction = (a: DebtAction) => a === 'loan_payment' || a === 'loan_repayment_received';
const loanTypeFor = (a: DebtAction): LoanType =>
  (a === 'loan_received' || a === 'loan_payment') ? 'payable' : 'receivable';

const emptyForm = {
  invoiceName: '',
  invoiceDescription: '',
  invoiceAmount: '',
  invoiceType: 'Cashflow',
  dateOfInvoice: '',
  recurrence: 'once' as Recurrence,
};

const RECURRENCES: { value: Recurrence; key: string }[] = [
  { value: 'once', key: 'recurrenceOnce' },
  { value: 'monthly', key: 'recurrenceMonthly' },
  { value: 'yearly', key: 'recurrenceYearly' },
];

const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BookkeepingModal({ isOpen, onClose, onSaved, editing, allowReceipt = true }: BookkeepingModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [basis, setBasis] = useState<Basis>('cash');
  const [accrualType, setAccrualType] = useState<WorkflowType>('credit_revenue');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debt state
  const [debtAction, setDebtAction] = useState<DebtAction>('loan_received');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState('');
  const [annualRate, setAnnualRate] = useState('');

  // Currency (cash entries only in v1). The amount field holds the currency the
  // user is entering in; when it's not USD we fetch the rate and derive the USD
  // that actually hits the books.
  const [currency, setCurrency] = useState<Currency>('USD');
  const [usdAmount, setUsdAmount] = useState('');   // the USD that gets stored; editable
  const [usdEdited, setUsdEdited] = useState(false); // user overrode the auto value
  const [rate, setRate] = useState<FxRate | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // Business Group (cost/profit center) — cash entries only in v1.
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setReceiptFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setBasis('cash');
    setAccrualType('credit_revenue');
    setDebtAction('loan_received');
    setLoanId('');
    setAnnualRate('');

    const editingCurrency = (editing?.currency as Currency) ?? 'USD';
    setCurrency(editingCurrency);
    setRate(null);
    setRateError(null);
    setUsdEdited(false);
    setGroupId(editing?.groupId ?? '');
    setAddingGroup(false);
    setNewGroupName('');
    // Editing a ledger entry pins the basis and its type (the switch is hidden).
    if (editing?.ledger?.kind === 'accrual') {
      setBasis('accrual');
      setAccrualType(editing.ledger.accrualType);
    } else if (editing?.ledger?.kind === 'loan') {
      setBasis('debt');
      setDebtAction(editing.ledger.debtAction);
      setAnnualRate(String(editing.ledger.annualRate ?? ''));
    } else if (editing?.ledger?.kind === 'loanPayment') {
      setBasis('debt');
      setDebtAction(editing.ledger.debtAction);
    }
    getGroups().then(setGroups).catch(() => setGroups([]));
    // On edit, the stored USD amount is editing.invoiceAmount; when foreign, the
    // amount field should show the ORIGINAL (e.g. €100), not the USD.
    setUsdAmount(editingCurrency !== 'USD' ? editing?.invoiceAmount ?? '' : '');

    setForm(editing
      ? {
          invoiceName: editing.invoiceName,
          invoiceDescription: editing.invoiceDescription,
          invoiceAmount:
            editingCurrency !== 'USD' && editing.originalAmount != null
              ? String(editing.originalAmount)
              : editing.invoiceAmount,
          invoiceType: editing.invoiceType,
          dateOfInvoice: editing.dateOfInvoice,
          recurrence: editing.recurrence ?? 'once',
        }
      : { ...emptyForm, dateOfInvoice: new Date().toISOString().slice(0, 10) });
  }, [isOpen, editing]);

  // Fetch the exchange rate whenever a foreign amount/date is in play, and fill
  // the USD unless the user has typed their own. Cash entries only.
  useEffect(() => {
    if (!isOpen || basis !== 'cash' || currency === 'USD') {
      setRate(null); setRateError(null);
      return;
    }
    const amt = Number(form.invoiceAmount);
    if (!form.dateOfInvoice || !(amt > 0)) return;

    let alive = true;
    setRateLoading(true); setRateError(null);
    getFxRate(currency, 'USD', form.dateOfInvoice)
      .then((r) => {
        if (!alive) return;
        setRate(r);
        if (!usdEdited) setUsdAmount((amt * r.rate).toFixed(2));
      })
      .catch((e) => { if (alive) setRateError(e instanceof Error ? e.message : 'Could not get the rate.'); })
      .finally(() => { if (alive) setRateLoading(false); });
    return () => { alive = false; };
  }, [isOpen, basis, currency, form.invoiceAmount, form.dateOfInvoice, usdEdited]);

  // Load the loans you can pay against when a payment action is chosen.
  useEffect(() => {
    if (!isOpen || basis !== 'debt' || !isPaymentAction(debtAction)) return;
    // When editing a payment, keep it pointed at its own loan; otherwise default
    // to the first loan of that type.
    const editingLoanId = editing?.ledger?.kind === 'loanPayment' ? editing.ledger.loanId : null;
    listLoans(loanTypeFor(debtAction))
      .then((ls) => { setLoans(ls); setLoanId(editingLoanId ?? ls[0]?.id ?? ''); })
      .catch(() => setLoans([]));
  }, [isOpen, basis, debtAction, editing]);

  if (!isOpen) return null;

  const selectedLoan = loans.find((l) => l.id === loanId) ?? null;
  const amountNum = Number(form.invoiceAmount) || 0;
  // Live principal/interest preview — mirrors the server's split exactly.
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
      setError(e instanceof Error ? e.message : t("dashboard","errCreateGroup"));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const amount = Number(form.invoiceAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setError(t('dashboard', 'errAmount'));
    if (!form.dateOfInvoice) return setError(t('dashboard', 'errDate'));
    if (basis !== 'debt' && !form.invoiceName.trim()) return setError(t('dashboard', 'errInvoiceName'));

    setSaving(true);
    try {
      if (basis === 'debt') {
        if (isPaymentAction(debtAction)) {
          if (!loanId) throw new Error('Pick which loan this payment is for.');
          // Editing a payment = re-post it: reverse the old one first (which
          // restores the loan balance), then record the new payment.
          if (editing?.ledger?.kind === 'loanPayment') {
            await deleteLoanPayment(editing.ledger.paymentEntryId);
          }
          await recordLoanPayment(loanId, { amount, date: form.dateOfInvoice });
        } else {
          if (!form.invoiceName.trim()) throw new Error('Give the loan a name.');
          // Editing a loan = re-post it: drop the old loan (and its payments) first.
          if (editing?.ledger?.kind === 'loan') {
            if (editing.ledger.hasPayments && !window.confirm(
              'This loan has recorded payments. Saving replaces the loan, which deletes those payments. Continue?'
            )) { setSaving(false); return; }
            await deleteLoan(editing.ledger.loanId);
          }
          await createLoan({
            name: form.invoiceName.trim(),
            type: loanTypeFor(debtAction),
            amount,
            annualRate: Number(annualRate) || 0,
            date: form.dateOfInvoice,
            groupId: groupId || null,
          });
        }
      } else if (basis === 'accrual') {
        // Editing an accrual entry = re-post it: delete the old entry first.
        if (editing?.ledger?.kind === 'accrual') {
          await deleteEntry(editing.ledger.entryId);
        }
        await runWorkflow({
          type: accrualType,
          amount,
          description: form.invoiceName.trim() + (form.invoiceDescription.trim() ? ` — ${form.invoiceDescription.trim()}` : ''),
          date: form.dateOfInvoice,
          groupId: groupId || null,
        });
      } else {
        // The books are kept in USD. For a foreign entry, `amount` is the USD
        // value (auto-converted or overridden), and we keep the original so the
        // row can show what actually moved.
        const foreign = currency !== 'USD';
        const usd = foreign ? Number(usdAmount) : amount;
        if (foreign && !(usd > 0)) {
          setSaving(false);
          return setError('Enter the USD amount, or wait for the exchange rate.');
        }

        const payload = {
          type: (form.invoiceType === 'Cashflow' ? 'income' : 'expense') as 'income' | 'expense',
          category: form.invoiceName.trim(),
          description: form.invoiceDescription.trim() || undefined,
          amount: usd,
          date: form.dateOfInvoice,
          recurrence: form.recurrence,
          // Always send groupId (null when none) so clearing it on an edit sticks.
          groupId: groupId || null,
          ...(foreign
            ? { currency, originalAmount: amount, exchangeRate: rate?.rate }
            : {}),
        };
        if (editing) {
          await Promise.all([
            updateTransaction(editing.id, payload),
            ...(receiptFile ? [uploadReceipt(editing.id, receiptFile)] : []),
          ]);
        } else {
          const saved = await createTransaction(payload);
          if (receiptFile) {
            if (!saved?.id) throw new Error('Entry saved, but no id was returned — receipt not attached.');
            await uploadReceipt(saved.id, receiptFile);
          }
        }
      }

      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard', 'genericError'));
    } finally {
      setSaving(false);
    }
  };

  const nameLabel = basis === 'debt' && !isPaymentAction(debtAction) ? 'Loan Name' : t('dashboard', 'invoiceNameLabel');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1a2e] text-white rounded-2xl p-8 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">{editing ? t('dashboard', 'editBookkeeping') : t('dashboard', 'enterBookkeeping')}</h2>

        {/*
          * Invoice type. Editing an existing cash entry pins it to Cash.
          *
          * A LABELLED DROPDOWN, not three pills. Cash basis, accrual and debt
          * are not three views of one thing — the choice decides which ledger
          * the entry lands in, and it is the most consequential field on the
          * form. A row of equal-weight buttons with no label gives that
          * decision no name at all. It now matches the type selector in the
          * document review popup, which asks the same question.
          */}
        {!editing && (
          <>
            <label className="block text-sm font-semibold mb-1">
              {t("dashboard", "bkBasisLabel")}
            </label>
            <select
              className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-1 text-sm outline-none"
              value={basis}
              onChange={(e) => setBasis(e.target.value as Basis)}
            >
              <option value="cash">{t("dashboard", "bkBasisCash")}</option>
              <option value="accrual">{t("dashboard", "bkBasisAccrual")}</option>
              <option value="debt">{t("dashboard", "bkBasisDebt")}</option>
            </select>
            <p className="text-[11px] text-gray-400 mb-5">
              {basis === 'cash' && t("dashboard", "bkCashHint")}
              {basis === 'accrual' && t("dashboard", "bkAccrualHint")}
              {basis === 'debt' && t("dashboard", "bkDebtHint")}
            </p>
          </>
        )}

        {/* DEBT — which loan is this payment against? */}
        {basis === 'debt' && isPaymentAction(debtAction) && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dWhichLoan")}</label>
            {loans.length === 0 ? (
              <p className="text-xs text-gray-400 mb-4">
                No {loanTypeFor(debtAction) === 'payable' ? 'borrowed' : 'lent-out'} loans yet — record one first.
              </p>
            ) : (
              <select value={loanId} onChange={(e) => setLoanId(e.target.value)}
                className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none">
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
            <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none"
              placeholder={basis === 'debt' ? 'e.g. Bank term loan' : t('dashboard', 'invoiceNamePlaceholder')}
              value={form.invoiceName} onChange={(e) => setForm({ ...form, invoiceName: e.target.value })} />
          </>
        )}

        {basis !== 'debt' && (
          <>
            <label className="block text-sm font-semibold mb-1">{t('dashboard', 'invoiceDescriptionLabel')}</label>
            <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder={t('dashboard', 'invoiceDescriptionPlaceholder')}
              value={form.invoiceDescription} onChange={(e) => setForm({ ...form, invoiceDescription: e.target.value })} />
          </>
        )}

        {/* Business Group (cost/profit center). Shown for cash, accrual and
            new loans; a loan PAYMENT inherits the loan's group automatically. */}
        {!(basis === 'debt' && isPaymentAction(debtAction)) && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dGroup")}<span className="text-gray-400 font-normal">(optional)</span></label>
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
                  className="text-sm text-gray-400 px-2">{t("dashboard","invCancel")}</button>
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
          {basis === 'debt' && isPaymentAction(debtAction) ? 'Payment Amount' : t('dashboard', 'invoiceAmountLabel')}
        </label>
        <div className="flex gap-2 mb-1">
          <input className="flex-1 bg-[#2a2a3e] rounded-lg px-4 py-2 text-sm outline-none" placeholder={t('dashboard', 'enterValue')} type="number"
            value={form.invoiceAmount} onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })} />
          {/* Currency picker — cash entries only in v1. Books stay in USD. */}
          {basis === 'cash' && (
            <select
              className="bg-[#2a2a3e] rounded-lg px-3 py-2 text-sm outline-none"
              value={currency}
              onChange={(e) => { setCurrency(e.target.value as Currency); setUsdEdited(false); }}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Foreign entry: show the USD that will actually be recorded, editable. */}
        {basis === 'cash' && currency !== 'USD' && (
          <div className="mb-4 rounded-lg bg-[#22223a] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-gray-300">{t("dashboard","bmRecordedUsd")}</label>
              {rateLoading
                ? <span className="text-[11px] text-gray-500">fetching rate…</span>
                : rate && <span className="text-[11px] text-gray-500">rate {rate.rate.toFixed(4)} · {rate.effectiveDate}</span>}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-sm text-gray-400">$</span>
              <input
                className="flex-1 bg-[#2a2a3e] rounded-lg px-3 py-1.5 text-sm outline-none"
                type="number" placeholder="0.00"
                value={usdAmount}
                onChange={(e) => { setUsdAmount(e.target.value); setUsdEdited(true); }}
              />
              {usdEdited && rate && (
                <button type="button" onClick={() => { setUsdEdited(false); }}
                  className="text-[11px] text-blue-400 hover:underline px-1">reset</button>
              )}
            </div>
            {rateError
              ? <p className="text-[11px] text-amber-400 mt-1">{rateError} You can type the USD amount manually.</p>
              : <p className="text-[11px] text-gray-500 mt-1">Auto-converted at the rate on {form.dateOfInvoice || 'the entry date'}. Edit if your bank used a different rate.</p>}
          </div>
        )}

        {/* Interest rate when creating a loan */}
        {basis === 'debt' && !isPaymentAction(debtAction) && (
          <>
            <label className="block text-sm font-semibold mb-1">{t("demo","dAnnualRate")}</label>
            <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" type="number" step="0.01" min="0"
              placeholder="e.g. 7.5" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
          </>
        )}

        {/* Debt Type — sits below the interest rate. Hidden when editing a loan,
            which is pinned to its existing direction. */}
        {basis === 'debt' && !editing?.ledger && (
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

        {/* Type tick boxes — cash vs accrual */}
        {basis === 'cash' && (
          <>
            <label className="block text-sm font-semibold mb-2">{t('dashboard', 'invoiceTypeLabel')}</label>
            <div className="flex flex-col gap-2 mb-4">
              {(['Cashflow', 'Expense'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="invoiceType" value={type} checked={form.invoiceType === type}
                    onChange={(e) => setForm({ ...form, invoiceType: e.target.value })} />
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${type === 'Cashflow' ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'}`}>{t('dashboard', type === 'Cashflow' ? 'cashflow' : 'expense')}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {basis === 'accrual' && (
          <>
            <label className="block text-sm font-semibold mb-2">{t('dashboard', 'invoiceTypeLabel')}</label>
            <div className="flex flex-col gap-2 mb-2">
              {ACCRUAL_TYPES.map((type) => (
                <label key={type} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="accrualType" className="mt-1" checked={accrualType === type}
                    onChange={() => setAccrualType(type)} />
                  <span className="text-sm">{WORKFLOW_META[type].label}</span>
                  {!WORKFLOW_META[type].affectsCash && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2a2a3e] text-gray-300">no cash</span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4">{WORKFLOW_META[accrualType].description}</p>
          </>
        )}

        {/* Recurrence only makes sense for repeating cash entries. */}
        {basis === 'cash' && (
          <>
            <label className="block text-sm font-semibold mb-1">{t('dashboard', 'recurrenceLabel')}</label>
            <div className="flex gap-2 mb-4">
              {RECURRENCES.map((r) => (
                <button key={r.value} type="button" onClick={() => setForm({ ...form, recurrence: r.value })}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold ${form.recurrence === r.value ? 'bg-blue-500 text-white' : 'bg-[#2a2a3e] text-gray-300'}`}>
                  {t('dashboard', r.key)}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'dateOfInvoiceLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" type="date"
          value={form.dateOfInvoice} onChange={(e) => setForm({ ...form, dateOfInvoice: e.target.value })} />

        {/* Receipts attach to cash bookkeeping entries — cashflow AND expense. */}
        {allowReceipt && basis === 'cash' && (
          <>
            <label className="block text-sm font-semibold mb-1">{t('dashboard', 'receiptLabel')}</label>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs mb-2 text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer" />
            {editing?.hasReceipt && !receiptFile && (
              <p className="text-xs text-gray-400 mb-4">{t('dashboard', 'receiptAttached')}</p>
            )}
            {!editing?.hasReceipt && <div className="mb-2" />}
          </>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button disabled={saving}
          className="w-full bg-[#4CAF50] hover:bg-[#45a049] disabled:opacity-60 text-white font-bold py-3 rounded-full"
          onClick={handleSubmit}>
          {saving ? t('dashboard', 'saving') : editing ? t('dashboard', 'saveChanges') : t('dashboard', 'enterData')}
        </button>
      </div>
    </div>
  );
}
