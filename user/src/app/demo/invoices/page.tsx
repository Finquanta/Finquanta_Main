"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Invoice, STATUS_COLORS, listInvoices, deleteInvoice, money } from "@/lib/demo/api/invoices";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useAsk } from "@/components/user_dashboard/ConfirmProvider";
import { demoColors } from "@/lib/demo/theme";
import { useLanguage } from '@/hooks/context/LanguageContext';
import { demoErrorText } from '@/lib/demo/errors';

export default function DemoInvoicesPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { ask } = useAsk();
  const c = demoColors(isDark);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listInvoices()
      .then(setInvoices)
      .catch((e) => setError(demoErrorText(e, t, t("dashboard","errLoadInvoices"))))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const remove = (inv: Invoice) => ask({
    title: t('demo','eConfirmDelete').replace('{name}', inv.number),
    body: t('dashboard', 'confirmCannotUndo'),
    tone: 'danger',
    confirmLabel: t('dashboard', 'inboxDelete'),
    onConfirm: async () => {
      setBusyId(inv.id);
      try { await deleteInvoice(inv.id); load(); }
      catch (e) { setError(demoErrorText(e, t, t('demo','eGeneric'))); }
      finally { setBusyId(""); }
    },
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className={`text-xl font-bold mb-1 ${c.heading}`}>{t("dashboard","invoices")}</h1>
        <p className={`text-sm mb-6 ${c.subtext}`}>{t("demo","dInvDesc")}</p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Link href="/demo/invoices/new"
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" />{t("dashboard","invNew")}</Link>
          <Link href="/demo/customers" className={`text-sm px-3 py-2 hover:underline ${c.subtext}`}>{t("dashboard","navToCustomers")} →</Link>
        </div>

        {loading ? (
          <p className={`text-sm ${c.subtext}`}>{t("dashboard","invLoading")}</p>
        ) : invoices.length === 0 ? (
          <div className={`rounded-xl p-8 text-center ${c.card}`}>
            <p className={`text-sm ${c.subtext}`}>{t("dashboard","invNoneYet")}</p>
          </div>
        ) : (
          <div className={`rounded-xl overflow-hidden ${c.card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${isDark ? "text-gray-400 bg-gray-900/40" : "text-gray-500 bg-gray-50"}`}>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","invInvoice")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","invCustomer")}</th>
                    <th className="px-4 py-3 font-semibold">{t("demo","dIssued")}</th>
                    <th className="px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","invStatus")}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t("dashboard","invTotal")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className={`border-t ${c.divider}`}>
                      <td className="px-4 py-3">
                        <Link href={`/demo/invoices/${inv.id}`} className="font-medium text-blue-500 hover:underline">{inv.number}</Link>
                      </td>
                      <td className={`px-4 py-3 ${c.heading}`}>{inv.customerName || "—"}</td>
                      <td className={`px-4 py-3 ${c.subtext}`}>{inv.issueDate || "—"}</td>
                      <td className={`px-4 py-3 ${c.subtext}`}>{inv.dueDate || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white capitalize"
                          style={{ backgroundColor: STATUS_COLORS[inv.status] }}>
                          {inv.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${c.heading}`}>{money(inv.total, inv.currency)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {/* Drafts only, same rule as the real app. */}
                        {inv.status === "draft" && (
                          <Link href={`/demo/invoices/${inv.id}/edit`} className={`mr-3 hover:text-blue-500 ${c.subtext}`} title={t("dashboard","invEdit")}>{t("dashboard","invEdit")}</Link>
                        )}
                        <button onClick={() => remove(inv)} disabled={busyId === inv.id}
                          className={`hover:text-red-500 disabled:opacity-50 ${c.subtext}`} title={t("demo","deleteTitle")}>
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
    </div>
  );
}
