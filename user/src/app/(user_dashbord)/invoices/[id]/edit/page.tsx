"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { Invoice, InvoiceItem, getInvoice, updateInvoice, money } from "@/lib/api/invoices";
import { Customer, listCustomers, createCustomer } from "@/lib/api/customers";
import DashboardShell from "@/components/user_dashboard/DashboardShell";

const blankItem = (): InvoiceItem => ({ name: "", description: "", quantity: 1, unitPrice: 0, amount: 0 });

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<InvoiceItem[]>([blankItem()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getInvoice(id), listCustomers()])
      .then(([inv, cs]) => {
        setInvoice(inv);
        setCustomers(cs);
        setCustomerId(inv.customerId ?? "");
        setIssueDate(inv.issueDate ?? "");
        setDueDate(inv.dueDate ?? "");
        setMessage(inv.message ?? "");
        setDetails(inv.details ?? "");
        setPaymentTerms(inv.paymentTerms ?? "");
        setNotes(inv.notes ?? "");
        setTaxRate(String(inv.taxRate ?? 0));
        setItems(inv.items.length ? inv.items : [blankItem()]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load invoice."))
      .finally(() => setLoading(false));
  }, [id]);

  const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const subtotal = round(items.reduce((s, it) => s + round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0));
  const tax = round(subtotal * ((Number(taxRate) || 0) / 100));
  const total = round(subtotal + tax);

  const setItem = (i: number, patch: Partial<InvoiceItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addCustomerInline = async () => {
    if (!newCustomer.trim()) return;
    try {
      const c = await createCustomer({ name: newCustomer.trim() });
      setCustomers([...customers, c]);
      setCustomerId(c.id);
      setNewCustomer("");
      setAddingCustomer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add customer.");
    }
  };

  const save = async () => {
    setError(null);
    const clean = items.filter((it) => it.name.trim() && (Number(it.quantity) || 0) > 0);
    if (clean.length === 0) { setError("Add at least one item with a name and quantity."); return; }

    setSaving(true);
    try {
      await updateInvoice(id, {
        customerId: customerId || null,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        message: message.trim() || null,
        details: details.trim() || null,
        paymentTerms: paymentTerms.trim() || null,
        notes: notes.trim() || null,
        taxRate: Number(taxRate) || 0,
        items: clean.map((it) => ({
          ...it,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          amount: round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
        })),
      });
      router.push(`/invoices/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save invoice.");
      setSaving(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;

  if (loading) return <DashboardShell><div className="p-6"><p className={sub}>Loading…</p></div></DashboardShell>;

  // A paid invoice is already settled in the books — editing it would put the
  // ledger out of step with the document.
  if (invoice?.status === "paid") return (
    <DashboardShell><div className="p-6">
      <p className={`text-sm mb-2 ${text}`}>This invoice is paid and can no longer be edited.</p>
      <Link href={`/invoices/${id}`} className="text-blue-500 text-sm hover:underline">← Back to invoice</Link>
    </div></DashboardShell>
  );

  return (
    <DashboardShell><div className="p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${text}`}>Edit {invoice?.number}</h1>
          <Link href={`/invoices/${id}`} className="text-sm text-blue-500 hover:underline">← Back To Invoice</Link>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>
          {invoice?.arEntryId
            ? "This invoice is already in your books. Changing the total will not re-post the receivable — cancel and re-issue if the amount is wrong."
            : "Nothing has hit your books yet, so you can change anything."}
        </p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Customer */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <label className={`block text-xs mb-1 ${sub}`}>Bill To</label>
          {addingCustomer ? (
            <div className="flex gap-2">
              <input autoFocus value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomerInline(); } }}
                placeholder="Customer name" className={field} />
              <button onClick={addCustomerInline} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg">Add</button>
              <button onClick={() => setAddingCustomer(false)} className={`text-sm px-3 ${sub}`}>Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field}>
                <option value="">Select a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setAddingCustomer(true)}
                className={`text-sm font-semibold px-3 rounded-lg border whitespace-nowrap ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}>
                + New
              </button>
            </div>
          )}
        </div>

        {/* Dates + details */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>Issue Date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
            </div>
          </div>
          <div className="mb-3">
            <label className={`block text-xs mb-1 ${sub}`}>Message To Customer</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>Details</label>
              <input value={details} onChange={(e) => setDetails(e.target.value)} className={field} />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>Payment Terms</label>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={field} />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-sm font-semibold ${text}`}>Items</h2>
            <button onClick={() => setItems([...items, blankItem()])}
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className={`rounded-lg border p-3 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                <div className="flex gap-2 mb-2">
                  <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })}
                    placeholder="Item name" className={field} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      className={`px-2 ${sub} hover:text-red-500`} title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input value={it.description ?? ""} onChange={(e) => setItem(i, { description: e.target.value })}
                  placeholder="Describe your item (optional)" className={`${field} mb-2`} />
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div>
                    <label className={`block text-[11px] mb-1 ${sub}`}>Qty</label>
                    <input type="number" min="0" step="0.01" value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} className={field} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1 ${sub}`}>Price</label>
                    <input type="number" min="0" step="0.01" value={it.unitPrice}
                      onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className={field} />
                  </div>
                  <div className="text-right">
                    <label className={`block text-[11px] mb-1 ${sub}`}>Amount</label>
                    <p className={`text-sm font-semibold py-2 ${text}`}>
                      {money(round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm ${sub}`}>Subtotal</span>
            <span className={`text-sm ${text}`}>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className={`text-sm ${sub}`}>Tax Rate (%)</span>
            <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
              className={`w-24 text-sm rounded-lg px-3 py-1.5 border outline-none text-right ${input}`} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm ${sub}`}>Tax</span>
            <span className={`text-sm ${text}`}>{money(tax)}</span>
          </div>
          <div className={`flex items-center justify-between pt-3 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <span className={`font-bold ${text}`}>Total Due</span>
            <span className={`font-bold text-lg ${text}`}>{money(total)}</span>
          </div>
        </div>

        <div className={`rounded-xl border p-4 mb-6 ${card}`}>
          <label className={`block text-xs mb-1 ${sub}`}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} min-h-[70px]`} />
        </div>

        <div className="flex gap-2">
          <Link href={`/invoices/${id}`}
            className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}>
            Cancel
          </Link>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div></DashboardShell>
  );
}
