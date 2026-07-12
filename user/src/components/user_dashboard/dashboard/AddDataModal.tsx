"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  WorkflowType, WORKFLOW_META, workflowsFor, runWorkflow,
} from "@/lib/api/accounting";

/**
 * One place to record any financial event.
 *
 * Cash basis (simple) = money in / money out — no accounting knowledge needed.
 * Accrual (advanced)  = money owed to you, money you owe, loans.
 *
 * The engine turns whichever the user picks into a balanced double-entry record
 * behind the scenes. There is deliberately no separate "Accounting" section —
 * cash vs accrual is just how the books are *reported*, not a different app.
 */
const CASH = workflowsFor("bookkeeping");
const ACCRUAL = workflowsFor("accounting");

export default function AddDataModal({
  isDark, onClose, onSaved,
}: {
  isDark: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<WorkflowType>("cash_revenue");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter an amount greater than zero."); return; }
    setSaving(true); setError(null);
    try {
      await runWorkflow({
        type,
        amount: amt,
        interest: type === "loan_payment" && interest ? Number(interest) : undefined,
        description: description.trim() || undefined,
        date: date || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  const card = isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto ${card}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Add data</h2>
          <button onClick={onClose} className={`${sub} hover:text-gray-700`}><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>What happened?</label>
            <select value={type} onChange={(e) => setType(e.target.value as WorkflowType)} className={field}>
              <optgroup label="Money moved">
                {CASH.map((k) => <option key={k} value={k}>{WORKFLOW_META[k].label}</option>)}
              </optgroup>
              <optgroup label="Owed / owing (no cash yet)">
                {ACCRUAL.map((k) => <option key={k} value={k}>{WORKFLOW_META[k].label}</option>)}
              </optgroup>
            </select>
            {!WORKFLOW_META[type].affectsCash && (
              <p className={`text-[11px] mt-1 ${sub}`}>No cash moves for this — it only records what&apos;s owed.</p>
            )}
          </div>

          <div>
            <label className={`block text-xs mb-1 ${sub}`}>Amount</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" className={field} />
          </div>

          {type === "loan_payment" && (
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>Interest portion (optional)</label>
              <input type="number" step="0.01" min="0" value={interest} onChange={(e) => setInterest(e.target.value)}
                placeholder="0.00" className={field} />
            </div>
          )}

          <div>
            <label className={`block text-xs mb-1 ${sub}`}>Date (optional)</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </div>

          <div>
            <label className={`block text-xs mb-1 ${sub}`}>Note (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Payment from Acme Co." className={field} />
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
