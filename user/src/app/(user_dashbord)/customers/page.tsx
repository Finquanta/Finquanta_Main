"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  Customer, CustomerInput, listCustomers, createCustomer, updateCustomer, deleteCustomer,
} from "@/lib/api/customers";
import DashboardShell from "@/components/user_dashboard/DashboardShell";
import AddToBrainButton from "@/components/user_dashboard/brain/AddToBrainButton";

const EMPTY: CustomerInput = {
  name: "", email: "", phone: "",
  addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", country: "", notes: "",
};

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CustomersPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

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
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard","errLoadCustomers")))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard","errSaveCustomer"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Customer) => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try { await deleteCustomer(c.id); load(); }
    catch (err) { setError(err instanceof Error ? err.message : t("dashboard","errDeleteCustomer")); }
  };

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.email, c.phone, c.city, c.country].some((f) => (f || "").toLowerCase().includes(q));
  });

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;

  return (
    <DashboardShell><div className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${text}`}>{t("dashboard","custTitle")}</h1>
          <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">← Dashboard</Link>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>{t("dashboard","custDesc")}</p>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("dashboard","dSearchCustomers")}
            className={`flex-1 min-w-[200px] text-sm rounded-lg px-3 py-2 border outline-none ${input}`} />
          <button onClick={startNew}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" />{t("dashboard","custNew")}</button>
        </div>

        {error && !open && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className={`text-sm ${sub}`}>{t("dashboard","custLoading")}</p>
        ) : filtered.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${card}`}>
            <p className={`text-sm ${sub}`}>
              {customers.length === 0 ? t("dashboard","custNoneYet") : t("dashboard","custNoMatch")}
            </p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${sub} ${isDark ? "bg-gray-900/40" : "bg-gray-50"}`}>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custName")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custEmail")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custPhone")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","custOutstanding")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={`border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                      <td className={`px-4 py-3 font-medium ${text}`}>{c.name}</td>
                      <td className={`px-4 py-3 ${sub}`}>{c.email || "—"}</td>
                      <td className={`px-4 py-3 ${sub}`}>{c.phone || "—"}</td>
                      <td className={`px-4 py-3 ${c.outstandingBalance > 0 ? "text-amber-500 font-semibold" : sub}`}>
                        {money(c.outstandingBalance)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <AddToBrainButton
                          isDark={isDark} entityType="customer" entityId={c.id} title={c.name}
                          variant="icon" className="mr-3"
                        />
                        <button onClick={() => startEdit(c)} className={`mr-3 ${sub} hover:text-blue-500`} title="Edit">
                          <Pencil className="h-4 w-4 inline" />
                        </button>
                        <button onClick={() => remove(c)} className={`${sub} hover:text-red-500`} title="Delete">
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
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","custName")}</label>
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","custEmail")}</label>
                  <input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","custPhone")}</label>
                  <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","custBillingAddress")}</label>
                <input placeholder={t("dashboard","invAddrLine1")} value={form.addressLine1 ?? ""} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} className={`${field} mb-2`} />
                <input placeholder={t("dashboard","invAddrLine2")} value={form.addressLine2 ?? ""} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} className={field} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder={t("dashboard","invCity")} value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className={field} />
                <input placeholder={t("dashboard","invRegion")} value={form.region ?? ""} onChange={(e) => setForm({ ...form, region: e.target.value })} className={field} />
                <input placeholder="Postal code" value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={field} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invCountry")}</label>
                <input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} className={field} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","custNotes")}</label>
                <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${field} min-h-[70px]`} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600" : "border-gray-300"}`}>{t("dashboard","invCancel")}</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div></DashboardShell>
  );
}
