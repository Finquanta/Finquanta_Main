'use client';
import React, { useEffect, useState } from 'react';
import { createTransaction, updateTransaction } from '@/lib/api/transactions';

export interface BookkeepingEditing {
  id: string;
  invoiceName: string;
  invoiceDescription: string;
  invoiceAmount: string;
  invoiceType: 'Cashflow' | 'Expense';
  dateOfInvoice: string;
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
};

export default function BookkeepingModal({ isOpen, onClose, onSaved, editing }: BookkeepingModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setForm(editing ? { ...editing } : emptyForm);
    }
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError(null);

    const amount = Number(form.invoiceAmount);
    if (!form.invoiceName.trim()) return setError('Please enter an invoice name.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Please enter an amount greater than 0.');
    if (!form.dateOfInvoice) return setError('Please choose a date.');

    const payload = {
      type: (form.invoiceType === 'Cashflow' ? 'income' : 'expense') as 'income' | 'expense',
      category: form.invoiceName.trim(),
      description: form.invoiceDescription.trim() || form.invoiceName.trim(),
      amount,
      date: form.dateOfInvoice,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1a2e] text-white rounded-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6">{editing ? 'Edit Bookkeeping Data' : 'Enter Bookkeeping Data'}</h2>

        <label className="block text-sm font-semibold mb-1">Invoice Name</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder="Invoice Here"
          value={form.invoiceName} onChange={(e) => setForm({ ...form, invoiceName: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">Invoice Description</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder="Text Here"
          value={form.invoiceDescription} onChange={(e) => setForm({ ...form, invoiceDescription: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">Invoice Amount</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder="Enter Value" type="number"
          value={form.invoiceAmount} onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })} />

        <label className="block text-sm font-semibold mb-2">Invoice Type</label>
        <div className="flex flex-col gap-2 mb-4">
          {['Cashflow', 'Expense'].map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="invoiceType" value={type} checked={form.invoiceType === type}
                onChange={(e) => setForm({ ...form, invoiceType: e.target.value })} />
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${type === 'Cashflow' ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'}`}>{type}</span>
            </label>
          ))}
        </div>

        <label className="block text-sm font-semibold mb-1">Date of Invoice</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" type="date"
          value={form.dateOfInvoice} onChange={(e) => setForm({ ...form, dateOfInvoice: e.target.value })} />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button disabled={saving}
          className="w-full bg-[#4CAF50] hover:bg-[#45a049] disabled:opacity-60 text-white font-bold py-3 rounded-full"
          onClick={handleSubmit}>
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Enter Data'}
        </button>
      </div>
    </div>
  );
}
