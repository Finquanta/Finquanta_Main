"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/hooks/context/ThemeContext";
import {
  AccountBalance, JournalEntry, WorkflowType, WORKFLOW_LABELS,
  getAccounts, getEntries, runWorkflow,
} from "@/lib/api/accounting";

// The balances worth surfacing as headline cards.
const HEADLINE = ["CASH", "AR", "AP", "LOAN_PAYABLE"] as const;

const money = (n: number) =>
  `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountingPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "Record an event" form — the user describes what happened in plain terms;
  // the engine turns it into a balanced double-entry record.
  const [type, setType] = useState<WorkflowType>("cash_revenue");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getAccounts(), getEntries(50)])
      .then(([a, e]) => { setAccounts(a); setEntries(e); })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load accounting data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      });
      setAmount(""); setInterest(""); setDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that.");
    } finally {
      setSaving(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const byCode = (code: string) => accounts.find((a) => a.code === code);

  return (
    <div className={`min-h-screen p-4 sm:p-6 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${text}`}>Accounting</h1>
          <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">← Dashboard</Link>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>
          Advanced records. Every event below is turned into a balanced double-entry record automatically —
          bookkeeping stays simple, the ledger runs underneath.
        </p>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Headline balances */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {HEADLINE.map((code) => {
            const a = byCode(code);
            return (
              <div key={code} className={`rounded-xl border p-4 ${card}`}>
                <p className={`text-xs font-medium ${sub}`}>{a?.name ?? code}</p>
                <p className={`text-xl font-bold mt-1 ${text}`}>{loading ? "…" : money(a?.balance ?? 0)}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Record an event */}
          <div className={`rounded-xl border p-4 ${card}`}>
            <h2 className={`text-sm font-semibold mb-3 ${text}`}>Record an event</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>What happened?</label>
                <select value={type} onChange={(e) => setType(e.target.value as WorkflowType)}
                  className={`w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`}>
                  {(Object.keys(WORKFLOW_LABELS) as WorkflowType[]).map((k) => (
                    <option key={k} value={k}>{WORKFLOW_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>Amount</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className={`w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`} />
              </div>
              {type === "loan_payment" && (
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Interest portion (optional)</label>
                  <input type="number" step="0.01" min="0" value={interest} onChange={(e) => setInterest(e.target.value)}
                    placeholder="0.00" className={`w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`} />
                </div>
              )}
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>Note (optional)</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Invoice #12 from Acme" className={`w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
                {saving ? "Recording…" : "Record"}
              </button>
            </form>
          </div>

          {/* The ledger */}
          <div className={`rounded-xl border p-4 lg:col-span-2 ${card}`}>
            <h2 className={`text-sm font-semibold mb-3 ${text}`}>Ledger</h2>
            {loading ? (
              <p className={`text-sm ${sub}`}>Loading…</p>
            ) : entries.length === 0 ? (
              <p className={`text-sm ${sub}`}>No entries yet. Record an event and it will appear here.</p>
            ) : (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                {entries.map((en) => (
                  <div key={en.id} className={`rounded-lg border p-3 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${text}`}>{en.description}</p>
                      <p className={`text-xs flex-shrink-0 ${sub}`}>{en.date}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {en.lines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className={sub}>
                            {l.debit > 0 ? "Debit" : "Credit"} · {l.accountName}
                          </span>
                          <span className={l.debit > 0 ? "text-green-500" : "text-red-500"}>
                            {money(l.debit > 0 ? l.debit : l.credit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
