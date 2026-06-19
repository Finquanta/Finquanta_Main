'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createTransaction, updateTransaction, uploadReceipt, Recurrence } from '@/lib/api/transactions';
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
}

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

export default function BookkeepingModal({ isOpen, onClose, onSaved, editing }: BookkeepingModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setForm(editing
        ? {
            invoiceName: editing.invoiceName,
            invoiceDescription: editing.invoiceDescription,
            invoiceAmount: editing.invoiceAmount,
            invoiceType: editing.invoiceType,
            dateOfInvoice: editing.dateOfInvoice,
            recurrence: editing.recurrence ?? 'once',
          }
        : emptyForm);
    }
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError(null);

    const amount = Number(form.invoiceAmount);
    if (!form.invoiceName.trim()) return setError(t('dashboard', 'errInvoiceName'));
    if (!Number.isFinite(amount) || amount <= 0) return setError(t('dashboard', 'errAmount'));
    if (!form.dateOfInvoice) return setError(t('dashboard', 'errDate'));

    const payload = {
      type: (form.invoiceType === 'Cashflow' ? 'income' : 'expense') as 'income' | 'expense',
      category: form.invoiceName.trim(),
      description: form.invoiceDescription.trim() || form.invoiceName.trim(),
      amount,
      date: form.dateOfInvoice,
      recurrence: form.recurrence,
    };

    setSaving(true);
    try {
      const saved = editing
        ? await updateTransaction(editing.id, payload)
        : await createTransaction(payload);

      if (receiptFile) {
        await uploadReceipt(saved.id, receiptFile);
      }

      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard', 'genericError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1a2e] text-white rounded-2xl p-8 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6">{editing ? t('dashboard', 'editBookkeeping') : t('dashboard', 'enterBookkeeping')}</h2>

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'invoiceNameLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder={t('dashboard', 'invoiceNamePlaceholder')}
          value={form.invoiceName} onChange={(e) => setForm({ ...form, invoiceName: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'invoiceDescriptionLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder={t('dashboard', 'invoiceDescriptionPlaceholder')}
          value={form.invoiceDescription} onChange={(e) => setForm({ ...form, invoiceDescription: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'invoiceAmountLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder={t('dashboard', 'enterValue')} type="number"
          value={form.invoiceAmount} onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })} />

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

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'recurrenceLabel')}</label>
        <div className="flex gap-2 mb-4">
          {RECURRENCES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setForm({ ...form, recurrence: r.value })}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold ${form.recurrence === r.value ? 'bg-blue-500 text-white' : 'bg-[#2a2a3e] text-gray-300'}`}
            >
              {t('dashboard', r.key)}
            </button>
          ))}
        </div>

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'dateOfInvoiceLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" type="date"
          value={form.dateOfInvoice} onChange={(e) => setForm({ ...form, dateOfInvoice: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'receiptLabel')}</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs mb-2 text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer"
        />
        {editing?.hasReceipt && !receiptFile && (
          <p className="text-xs text-gray-400 mb-4">{t('dashboard', 'receiptAttached')}</p>
        )}
        {!editing?.hasReceipt && <div className="mb-2" />}

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
