"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { InvoiceItem, createInvoice, money } from "@/lib/api/invoices";
import { Customer, listCustomers, createCustomer } from "@/lib/api/customers";
import { Group, getGroups } from "@/lib/api/groups";
import DashboardShell from "@/components/user_dashboard/DashboardShell";

const blankItem = (): InvoiceItem => ({ name: "", description: "", quantity: 1, unitPrice: 0, amount: 0 });

/** Default due date: 14 days out — a sane payment term the user can change. */
const in14Days = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(in14Days());
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<InvoiceItem[]>([blankItem()]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch(() => setCustomers([]));
    getGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  // Totals mirror the server's arithmetic exactly.
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
      setError(e instanceof Error ? e.message : t("dashboard","errAddCustomer"));
    }
  };

  const save = async () => {
    setError(null);
    const clean = items.filter((it) => it.name.trim() && (Number(it.quantity) || 0) > 0);
    if (clean.length === 0) { setError(t("dashboard","errNeedItem")); return; }

    setSaving(true);
    try {
      const inv = await createInvoice({
        customerId: customerId || null,
        groupId: groupId || null,
        issueDate, dueDate,
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
      router.push(`/invoices/${inv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard","errCreateInvoice"));
      setSaving(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;

  return (
    <DashboardShell><div className="p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${text}`}>{t("dashboard","invNew")}</h1>
          <Link href="/invoices" className="text-sm text-blue-500 hover:underline">← Invoices</Link>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>{t("dashboard","invDraftNote")}</p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {/* Customer */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invBillTo")}</label>
          {addingCustomer ? (
            <div className="flex gap-2">
              <input autoFocus value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomerInline(); } }}
                placeholder={t("dashboard","invCustomerName")} className={field} />
              <button onClick={addCustomerInline} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg">Add</button>
              <button onClick={() => setAddingCustomer(false)} className={`text-sm px-3 ${sub}`}>{t("dashboard","invCancel")}</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field}>
                <option value="">{t("dashboard","invSelectCustomer")}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setAddingCustomer(true)}
                className={`text-sm font-semibold px-3 rounded-lg border whitespace-nowrap ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}>
                + New
              </button>
            </div>
          )}
          {/* Business Group (cost/profit center) — optional. */}
          {groups.length > 0 && (
            <div className="mt-3">
              <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invGroupOptional")}</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field}>
                <option value="">{t("dashboard","invNoGroup")}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Dates + details */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invIssueDate")}</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invDueDate")}</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
            </div>
          </div>
          <div className="mb-3">
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invMsgToCustomer")}</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("dashboard","invThanks")} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invDetails")}</label>
              <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("dashboard","invJobDesc")} className={field} />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invPaymentTerms")}</label>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder={t("dashboard","invNetHint")} className={field} />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className={`rounded-xl border p-4 mb-4 ${card}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-sm font-semibold ${text}`}>{t("dashboard","invItems")}</h2>
            <button onClick={() => setItems([...items, blankItem()])}
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
              <Plus className="h-4 w-4" />{t("dashboard","invAddItem")}</button>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className={`rounded-lg border p-3 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                <div className="flex gap-2 mb-2">
                  <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })}
                    placeholder={t("dashboard","invItemName")} className={field} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      className={`px-2 ${sub} hover:text-red-500`} title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input value={it.description ?? ""} onChange={(e) => setItem(i, { description: e.target.value })}
                  placeholder={t("dashboard","invItemDesc")} className={`${field} mb-2`} />
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div>
                    <label className={`block text-[11px] mb-1 ${sub}`}>Qty</label>
                    <input type="number" min="0" step="0.01" value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} className={field} />
                  </div>
                  <div>
                    <label className={`block text-[11px] mb-1 ${sub}`}>{t("dashboard","invPrice")}</label>
                    <input type="number" min="0" step="0.01" value={it.unitPrice}
                      onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className={field} />
                  </div>
                  <div className="text-right">
                    <label className={`block text-[11px] mb-1 ${sub}`}>{t("dashboard","invAmount")}</label>
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
            <span className={`text-sm ${sub}`}>{t("dashboard","invSubtotal")}</span>
            <span className={`text-sm ${text}`}>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className={`text-sm ${sub}`}>{t("dashboard","invTaxRate")}</span>
            <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
              className={`w-24 text-sm rounded-lg px-3 py-1.5 border outline-none text-right ${input}`} />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm ${sub}`}>Tax</span>
            <span className={`text-sm ${text}`}>{money(tax)}</span>
          </div>
          <div className={`flex items-center justify-between pt-3 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <span className={`font-bold ${text}`}>{t("dashboard","invTotalDue")}</span>
            <span className={`font-bold text-lg ${text}`}>{money(total)}</span>
          </div>
        </div>

        <div className={`rounded-xl border p-4 mb-6 ${card}`}>
          <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","custNotes")}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t("dashboard","invNotesHint")} className={`${field} min-h-[70px]`} />
        </div>

        <div className="flex gap-2">
          <Link href="/invoices"
            className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}>{t("dashboard","invCancel")}</Link>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
            {saving ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div></DashboardShell>
  );
}
