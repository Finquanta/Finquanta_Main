'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createTransaction, updateTransaction, uploadReceipt, Recurrence } from '@/lib/api/transactions';
import { WorkflowType, WORKFLOW_META, workflowsInGroup, runWorkflow } from '@/lib/api/accounting';
import { Loan, LoanType, listLoans, createLoan, recordLoanPayment, previewSplit } from '@/lib/api/loans';
import { useLanguage } from '@/hooks/context/LanguageContext';

export interface BookkeepingEditing {
  id: string;
  invoiceName: string;
  invoiceDescription: string;
  invoiceAmount: string;
  invoiceType: 'Cashflow' | 'Expense';
  dateOfInvoice: string;
  recurrence: Recurrence;
  hasReceipt: boolean;
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

/** The four debt actions — both directions of a loan. */
type DebtAction = 'loan_received' | 'loan_payment' | 'loan_issued' | 'loan_repayment_received';
const DEBT_ACTIONS: { value: DebtAction; label: string; hint: string }[] = [
  {
    value: 'loan_received',
    label: 'Loan Payable Increase (Business Cash Increase)',
    hint: 'You borrowed money. The loan you owe goes up, and your business cash goes up by the same amount.',
  },
  {
    value: 'loan_payment',
    label: 'Loan Payable Decrease (Business Cash Decrease)',
    hint: 'You made a payment on a loan you owe. Cash goes down by the full payment; the loan balance drops by the principal portion, and the interest portion is recorded as Interest Expense.',
  },
  {
    value: 'loan_issued',
    label: 'Loan Receivable Increase (Business Cash Decrease)',
    hint: 'You lent money out. Your cash goes down, and what the borrower owes you goes up by the same amount.',
  },
  {
    value: 'loan_repayment_received',
    label: 'Loan Receivable Decrease (Business Cash Increase)',
    hint: 'Someone repaid a loan you gave them. Cash goes up by the full payment; what they owe you drops by the principal portion, and the interest portion is recorded as Interest Income.',
  },
];
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
    setForm(editing
      ? {
          invoiceName: editing.invoiceName,
          invoiceDescription: editing.invoiceDescription,
          invoiceAmount: editing.invoiceAmount,
          invoiceType: editing.invoiceType,
          dateOfInvoice: editing.dateOfInvoice,
          recurrence: editing.recurrence ?? 'once',
        }
      : { ...emptyForm, dateOfInvoice: new Date().toISOString().slice(0, 10) });
  }, [isOpen, editing]);

  // Load the loans you can pay against when a payment action is chosen.
  useEffect(() => {
    if (!isOpen || basis !== 'debt' || !isPaymentAction(debtAction)) return;
    listLoans(loanTypeFor(debtAction))
      .then((ls) => { setLoans(ls); setLoanId(ls[0]?.id ?? ''); })
      .catch(() => setLoans([]));
  }, [isOpen, basis, debtAction]);

  if (!isOpen) return null;

  const selectedLoan = loans.find((l) => l.id === loanId) ?? null;
  const amountNum = Number(form.invoiceAmount) || 0;
  // Live principal/interest preview — mirrors the server's split exactly.
  const split = selectedLoan && amountNum > 0
    ? previewSplit(amountNum, selectedLoan.remainingBalance, selectedLoan.annualRate)
    : null;

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
          await recordLoanPayment(loanId, { amount, date: form.dateOfInvoice });
        } else {
          if (!form.invoiceName.trim()) throw new Error('Give the loan a name.');
          await createLoan({
            name: form.invoiceName.trim(),
            type: loanTypeFor(debtAction),
            amount,
            annualRate: Number(annualRate) || 0,
            date: form.dateOfInvoice,
          });
        }
      } else if (basis === 'accrual') {
        await runWorkflow({
          type: accrualType,
          amount,
          description: form.invoiceName.trim() + (form.invoiceDescription.trim() ? ` — ${form.invoiceDescription.trim()}` : ''),
          date: form.dateOfInvoice,
        });
      } else {
        const payload = {
          type: (form.invoiceType === 'Cashflow' ? 'income' : 'expense') as 'income' | 'expense',
          category: form.invoiceName.trim(),
          description: form.invoiceDescription.trim() || undefined,
          amount,
          date: form.dateOfInvoice,
          recurrence: form.recurrence,
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

        {/* Basis switch. Editing an existing cash entry pins it to Cash. */}
        {!editing && (
          <>
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
              {basis === 'cash' && 'Money that actually moved — cash in or cash out.'}
              {basis === 'accrual' && "Money owed to you or money you owe — even if no cash has moved yet."}
              {basis === 'debt' && 'Loans you took out, and loans you gave out.'}
            </p>
          </>
        )}

        {/* DEBT — which loan is this payment against? */}
        {basis === 'debt' && isPaymentAction(debtAction) && (
          <>
            <label className="block text-sm font-semibold mb-1">Which Loan?</label>
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

        <label className="block text-sm font-semibold mb-1">
          {basis === 'debt' && isPaymentAction(debtAction) ? 'Payment Amount' : t('dashboard', 'invoiceAmountLabel')}
        </label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder={t('dashboard', 'enterValue')} type="number"
          value={form.invoiceAmount} onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })} />

        {/* Interest rate when creating a loan */}
        {basis === 'debt' && !isPaymentAction(debtAction) && (
          <>
            <label className="block text-sm font-semibold mb-1">Annual Interest Rate (%)</label>
            <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" type="number" step="0.01" min="0"
              placeholder="e.g. 7.5" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
          </>
        )}

        {/* Debt Type — sits below the interest rate */}
        {basis === 'debt' && (
          <>
            <label className="block text-sm font-semibold mb-2">Debt Type</label>
            <div className="flex flex-col gap-2 mb-2">
              {DEBT_ACTIONS.map((a) => (
                <label key={a.value} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="debtAction" className="mt-1" checked={debtAction === a.value}
                    onChange={() => setDebtAction(a.value)} />
                  <span className="text-sm">{a.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4">{DEBT_ACTIONS.find((a) => a.value === debtAction)?.hint}</p>
          </>
        )}

        {/* Live principal vs interest breakdown for a loan payment */}
        {basis === 'debt' && isPaymentAction(debtAction) && split && selectedLoan && (
          <div className="bg-[#2a2a3e] rounded-lg p-3 mb-4 text-xs">
            <p className="font-semibold mb-2">This Payment Breaks Down As:</p>
            <div className="flex justify-between mb-1">
              <span className="text-gray-300">Interest ({selectedLoan.annualRate}% ÷ 12 on {money(selectedLoan.remainingBalance)})</span>
              <span className="text-orange-400">{money(split.interest)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-300">Principal</span>
              <span className="text-green-400">{money(split.principal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#3a3a4e]">
              <span className="text-gray-300">Balance After</span>
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
