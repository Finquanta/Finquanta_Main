"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/hooks/context/ThemeContext";
import {
  AccountBalance, AccountingBasis, JournalEntry, WorkflowType, WORKFLOW_META, workflowsFor,
  getAccounts, getEntries, runWorkflow,
} from "@/lib/api/accounting";

// The balances worth surfacing as headline cards.
const HEADLINE = ["CASH", "AR", "AP", "LOAN_PAYABLE"] as const;

// Accounting is the ACCRUAL module — receivables, payables, loans. The plain
// cash events (money in / money out) live in the simple Bookkeeping module.
const ACCRUAL_WORKFLOWS = workflowsFor("accounting");

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
  const [type, setType] = useState<WorkflowType>("credit_revenue");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [basis, setBasis] = useState<AccountingBasis>("accrual");

  const load = (b: AccountingBasis = basis) => {
    setLoading(true);
    Promise.all([getAccounts(), getEntries(50, b)])
      .then(([a, e]) => { setAccounts(a); setEntries(e); })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load accounting data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(basis); }, [basis]); // eslint-disable-line react-hooks/exhaustive-deps

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
          The <strong>accrual</strong> layer: money you&apos;re owed, money you owe, and loans — recorded whether or not cash has
          moved yet. Plain cash in / cash out stays in <Link href="/bookkeeping" className="text-blue-500 hover:underline">Bookkeeping</Link>.
          Every event below becomes a balanced double-entry record automatically.
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
                  {ACCRUAL_WORKFLOWS.map((k) => (
                    <option key={k} value={k}>{WORKFLOW_META[k].label}</option>
                  ))}
                </select>
                {!WORKFLOW_META[type].affectsCash && (
                  <p className={`text-[11px] mt-1 ${sub}`}>No cash moves for this one — it only records the obligation.</p>
                )}
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
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h2 className={`text-sm font-semibold ${text}`}>Ledger</h2>
              <div className="flex items-center gap-1">
                {([["cash", "Cash basis"], ["accrual", "Accrual"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setBasis(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      basis === val ? "bg-blue-500 text-white" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <p className={`text-xs mb-3 ${sub}`}>
              {basis === "cash"
                ? "Only entries where money actually moved."
                : "Every entry, including amounts owed that haven't been paid yet."}
            </p>
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
