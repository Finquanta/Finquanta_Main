'use client';
import React, { useEffect, useState } from 'react';
import { createGoal, updateGoal } from '@/lib/api/dashboard';
import { useLanguage } from '@/hooks/context/LanguageContext';

export interface GoalEditing {
  id: string;
  goalName: string;
  goalAmount: string;
  currentAmount: string;
}

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editing?: GoalEditing | null;
}

const emptyForm = { goalName: '', goalAmount: '', currentAmount: '' };

export default function GoalModal({ isOpen, onClose, onSaved, editing }: GoalModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setForm(editing ? { goalName: editing.goalName, goalAmount: editing.goalAmount, currentAmount: editing.currentAmount } : emptyForm);
    }
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError(null);

    const target = Number(form.goalAmount);
    const current = form.currentAmount === '' ? 0 : Number(form.currentAmount);
    if (!form.goalName.trim()) return setError(t('dashboard', 'errGoalName'));
    if (!Number.isFinite(target) || target <= 0) return setError(t('dashboard', 'errTarget'));
    if (!Number.isFinite(current) || current < 0) return setError(t('dashboard', 'errProgress'));

    setSaving(true);
    try {
      if (editing) {
        await updateGoal(editing.id, { name: form.goalName.trim(), target, current });
      } else {
        await createGoal({ name: form.goalName.trim(), target, current });
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
      <div className="bg-[#1a1a2e] text-white rounded-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6">{editing ? t('dashboard', 'editGoalTitle') : t('dashboard', 'enterGoalTitle')}</h2>

        <label className="block text-sm font-semibold mb-1">{t('dashboard', 'goalLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-1 text-sm outline-none" placeholder={t('dashboard', 'goalPlaceholder')}
          value={form.goalName} onChange={(e) => setForm({ ...form, goalName: e.target.value })} />

        <label className="block text-sm font-semibold mb-1 mt-3">{t('dashboard', 'targetLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-1 text-sm outline-none" placeholder={t('dashboard', 'targetPlaceholder')} type="number"
          value={form.goalAmount} onChange={(e) => setForm({ ...form, goalAmount: e.target.value })} />

        <label className="block text-sm font-semibold mb-1 mt-3">{t('dashboard', 'progressLabel')}</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-6 text-sm outline-none" placeholder="0" type="number"
          value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} />

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
