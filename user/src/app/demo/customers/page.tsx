"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  Customer, CustomerInput, listCustomers, createCustomer, updateCustomer, deleteCustomer,
} from "@/lib/demo/api/customers";
import { useDemoSession } from "@/lib/demo/DemoSessionProvider";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useAsk } from "@/components/user_dashboard/ConfirmProvider";
import { demoColors } from "@/lib/demo/theme";
import { demoFormOpenWhile } from "@/lib/demo/formGuard";
import { useLanguage } from '@/hooks/context/LanguageContext';
import { demoErrorText } from '@/lib/demo/errors';

const EMPTY: CustomerInput = {
  name: "", email: "", phone: "",
  addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", country: "", notes: "",
};

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DemoCustomersPage() {
  const { t } = useLanguage();
  const { recordInteraction } = useDemoSession();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { ask } = useAsk();
  // Named `col`, not `c` — the customer rows below already bind `c`.
  const col = demoColors(isDark);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listCustomers()
      .then(setCustomers)
      .catch((e) => setError(demoErrorText(e, t, t("dashboard","errLoadCustomers"))))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Hold off the signup prompt while the customer form is open — it covers the
  // form and its CTA navigates away, taking whatever was typed with it.
  useEffect(() => demoFormOpenWhile(open), [open]);

  const startNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); setError(null); };
  const startEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name, email: c.email ?? "", phone: c.phone ?? "",
      addressLine1: c.addressLine1 ?? "", addressLine2: c.addressLine2 ?? "",
      city: c.city ?? "", region: c.region ?? "", postalCode: c.postalCode ?? "",
      country: c.country ?? "", notes: c.notes ?? "",
    });
    setOpen(true);
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { setError("A customer name is required."); return; }
    setSaving(true); setError(null);
    try {
      if (editing) await updateCustomer(editing.id, form);
      else await createCustomer(form);
      setOpen(false);
      recordInteraction();
      load();
    } catch (err) {
      setError(demoErrorText(err, t, t("dashboard","errSaveCustomer")));
    } finally {
      setSaving(false);
    }
  };

  const remove = (c: Customer) => ask({
    title: t('demo','eConfirmDelete').replace('{name}', c.name),
    body: t('dashboard', 'confirmCannotUndo'),
    tone: 'danger',
    confirmLabel: t('dashboard', 'inboxDelete'),
    onConfirm: async () => {
      try { await deleteCustomer(c.id); load(); }
      catch (err) { setError(demoErrorText(err, t, t("dashboard","errDeleteCustomer"))); }
    },
  });

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.email, c.phone, c.city, c.country].some((f) => (f || "").toLowerCase().includes(q));
  });

  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${col.input}`;
  const labelClass = `block text-xs mb-1 ${col.subtext}`;

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className={`text-xl font-bold mb-1 ${col.heading}`}>{t("dashboard","custTitle")}</h1>
        <p className={`text-sm mb-6 ${col.subtext}`}>{t("dashboard","custDesc")}</p>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("demo","dSearchCustomers")}
            className={`flex-1 min-w-[200px] text-sm rounded-lg px-3 py-2 border outline-none ${col.input}`} />
          <button onClick={startNew}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" />{t("dashboard","custNew")}</button>
        </div>

        {error && !open && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className={`text-sm ${col.subtext}`}>{t("dashboard","custLoading")}</p>
        ) : filtered.length === 0 ? (
          <div className={`rounded-xl p-8 text-center ${col.card}`}>
            <p className={`text-sm ${col.subtext}`}>
              {customers.length === 0 ? t("dashboard","custNoneYet") : t("dashboard","custNoMatch")}
            </p>
          </div>
        ) : (
          <div className={`rounded-xl overflow-hidden ${col.card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${isDark ? "text-gray-400 bg-gray-900/40" : "text-gray-500 bg-gray-50"}`}>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custName")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custEmail")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custPhone")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custOutstanding")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={`border-t ${col.divider}`}>
                      <td className={`px-4 py-3 font-medium ${col.heading}`}>{c.name}</td>
                      <td className={`px-4 py-3 ${col.subtext}`}>{c.email || "—"}</td>
                      <td className={`px-4 py-3 ${col.subtext}`}>{c.phone || "—"}</td>
                      <td className={`px-4 py-3 ${c.outstandingBalance > 0 ? "text-amber-500 font-semibold" : col.subtext}`}>
                        {money(c.outstandingBalance)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(c)} className={`mr-3 hover:text-blue-500 ${col.subtext}`} title={t("dashboard","invEdit")}>
                          <Pencil className="h-4 w-4 inline" />
                        </button>
                        <button onClick={() => remove(c)} className={`hover:text-red-500 ${col.subtext}`} title={t("demo","deleteTitle")}>
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className={`rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}>
            <h2 className="text-lg font-bold mb-4">{editing ? "Edit customer" : "New customer"}</h2>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className={labelClass}>{t("demo","dNameRequired")}</label>
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("dashboard","custEmail")}</label>
                  <input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
                </div>
                <div>
                  <label className={labelClass}>{t("dashboard","custPhone")}</label>
                  <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("dashboard","custBillingAddress")}</label>
                <input placeholder={t("dashboard","invAddrLine1")} value={form.addressLine1 ?? ""} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} className={`${field} mb-2`} />
                <input placeholder={t("dashboard","invAddrLine2")} value={form.addressLine2 ?? ""} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} className={field} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder={t("dashboard","invCity")} value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className={field} />
                <input placeholder={t("dashboard","invRegion")} value={form.region ?? ""} onChange={(e) => setForm({ ...form, region: e.target.value })} className={field} />
                <input placeholder={t("demo","dPostalCode")} value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={field} />
              </div>
              <div>
                <label className={labelClass}>{t("dashboard","invCountry")}</label>
                <input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} className={field} />
              </div>
              <div>
                <label className={labelClass}>{t("dashboard","custNotes")}</label>
                <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${field} min-h-[70px]`} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300"}`}>{t("demo","cancel")}</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
