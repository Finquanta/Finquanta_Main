"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { InvoiceItem, createInvoice, money } from "@/lib/demo/api/invoices";
import { Customer, listCustomers, createCustomer } from "@/lib/demo/api/customers";
import { useDemoSession } from "@/lib/demo/DemoSessionProvider";
import { todayLocal, toLocalKey } from "@/lib/demo/dates";
import { useLanguage } from '@/hooks/context/LanguageContext';
import { demoErrorText } from '@/lib/demo/errors';

const blankItem = (): InvoiceItem => ({ name: "", description: "", quantity: 1, unitPrice: 0, amount: 0 });

const in14Days = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return toLocalKey(d);
};

export default function DemoNewInvoicePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { recordInteraction } = useDemoSession();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [issueDate, setIssueDate] = useState(todayLocal());
  const [dueDate, setDueDate] = useState(in14Days());
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<InvoiceItem[]>([blankItem()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, []);

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
      setError(demoErrorText(e, t, t("dashboard","errAddCustomer")));
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
      recordInteraction();
      router.push(`/demo/invoices/${inv.id}`);
    } catch (e) {
      setError(demoErrorText(e, t, t("dashboard","errCreateInvoice")));
      setSaving(false);
    }
  };

  const field = "w-full text-sm rounded-lg px-3 py-2 border outline-none bg-gray-50 border-gray-300 text-gray-900";

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-gray-900">{t("dashboard","invNew")}</h1>
          <Link href="/demo/invoices" className="text-sm text-blue-500 hover:underline">← Invoices</Link>
        </div>
        <p className="text-sm mb-6 text-gray-500">{t("dashboard","invDraftNote")}</p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
          <label className="block text-xs mb-1 text-gray-500">{t("dashboard","invBillTo")}</label>
          {addingCustomer ? (
            <div className="flex gap-2">
              <input autoFocus value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomerInline(); } }}
                placeholder={t("dashboard","invCustomerName")} className={field} />
              <button onClick={addCustomerInline} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg">Add</button>
              <button onClick={() => setAddingCustomer(false)} className="text-sm px-3 text-gray-500">{t("demo","cancel")}</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field}>
                <option value="">{t("dashboard","invSelectCustomer")}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setAddingCustomer(true)}
                className="text-sm font-semibold px-3 rounded-lg border whitespace-nowrap border-gray-300 text-gray-700">
                + New
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1 text-gray-500">{t("dashboard","invIssueDate")}</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-500">{t("dashboard","invDueDate")}</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs mb-1 text-gray-500">{t("dashboard","invMsgToCustomer")}</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("dashboard","invThanks")} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 text-gray-500">{t("dashboard","invDetails")}</label>
              <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("dashboard","invJobDesc")} className={field} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-500">{t("dashboard","invPaymentTerms")}</label>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder={t("dashboard","invNetHint")} className={field} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">{t("dashboard","invItems")}</h2>
            <button onClick={() => setItems([...items, blankItem()])}
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
              <Plus className="h-4 w-4" />{t("dashboard","invAddItem")}</button>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-3">
                <div className="flex gap-2 mb-2">
                  <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })}
                    placeholder={t("dashboard","invItemName")} className={field} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                      className="px-2 text-gray-500 hover:text-red-500" title={t("dashboard","invRemove")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input value={it.description ?? ""} onChange={(e) => setItem(i, { description: e.target.value })}
                  placeholder={t("dashboard","invItemDesc")} className={`${field} mb-2`} />
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div>
                    <label className="block text-[11px] mb-1 text-gray-500">Qty</label>
                    <input type="number" min="0" step="0.01" value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} className={field} />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 text-gray-500">{t("dashboard","invPrice")}</label>
                    <input type="number" min="0" step="0.01" value={it.unitPrice}
                      onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className={field} />
                  </div>
                  <div className="text-right">
                    <label className="block text-[11px] mb-1 text-gray-500">{t("demo","amount")}</label>
                    <p className="text-sm font-semibold py-2 text-gray-900">
                      {money(round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{t("dashboard","invSubtotal")}</span>
            <span className="text-sm text-gray-900">{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className="text-sm text-gray-500">{t("dashboard","invTaxRate")}</span>
            <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
              className="w-24 text-sm rounded-lg px-3 py-1.5 border outline-none text-right bg-gray-50 border-gray-300 text-gray-900" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Tax</span>
            <span className="text-sm text-gray-900">{money(tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="font-bold text-gray-900">{t("dashboard","invTotalDue")}</span>
            <span className="font-bold text-lg text-gray-900">{money(total)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
          <label className="block text-xs mb-1 text-gray-500">{t("dashboard","custNotes")}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t("dashboard","invNotesHint")} className={`${field} min-h-[70px]`} />
        </div>

        <div className="flex gap-2">
          <Link href="/demo/invoices"
            className="flex-1 text-center py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700">{t("demo","cancel")}</Link>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
            {saving ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
