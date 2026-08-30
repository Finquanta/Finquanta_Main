"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useAsk } from "@/components/user_dashboard/ConfirmProvider";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  Invoice, STATUS_COLORS, listInvoices, listDeletedInvoices,
  deleteInvoice, restoreInvoice, deleteInvoiceForever, money,
} from "@/lib/api/invoices";
import { BusinessProfile, getBusinessProfile, saveBusinessProfile, uploadBusinessLogo } from "@/lib/api/business";
import DashboardShell from "@/components/user_dashboard/DashboardShell";

export default function InvoicesPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const { ask } = useAsk();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deleted, setDeleted] = useState<Invoice[]>([]);
  const [inBin, setInBin] = useState(false); // showing the recycle bin?
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Business details — these fill the invoice header, so they're editable right here.
  const [biz, setBiz] = useState<BusinessProfile>({});
  const [bizOpen, setBizOpen] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listInvoices(), listDeletedInvoices(), getBusinessProfile()])
      .then(([inv, del, b]) => { setInvoices(inv); setDeleted(del); setBiz(b); })
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard","errLoadInvoices")))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id); setError(null);
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusyId(""); }
  };

  /**
   * Delete removes the invoice from the books completely — its ledger entries
   * are erased, not reversed, so nothing of it is left behind. The document
   * still goes to the recycle bin, and restoring it puts the entries back.
   */
  const remove = (inv: Invoice) => {
    // An invoice already IN the books is a different question from a draft:
    // one erases ledger entries, the other just files a document away. Same
    // button, two very different consequences, so they are worded apart.
    const inBooks = !!inv.arEntryId || inv.status === "paid";
    ask({
      title: t("dashboard", "confirmDeleteTitle").replace("{name}", inv.number),
      body: inBooks
        ? t("dashboard", "invDeleteInBooksBody")
        : t("dashboard", "invDeleteDraftBody"),
      tone: inBooks ? "danger" : "warning",
      confirmLabel: t("dashboard", "inboxDelete"),
      onConfirm: () => act(inv.id, () => deleteInvoice(inv.id)),
    });
  };
  const restore = (inv: Invoice) => act(inv.id, () => restoreInvoice(inv.id));
  const destroy = (inv: Invoice) => ask({
    title: t("dashboard", "confirmDeleteForeverTitle").replace("{name}", inv.number),
    body: t("dashboard", "confirmCannotUndo"),
    tone: "danger",
    confirmLabel: t("dashboard", "inboxDelete"),
    onConfirm: () => act(inv.id, () => deleteInvoiceForever(inv.id)),
  });

  const rows = inBin ? deleted : invoices;

  const onLogoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true); setError(null);
    try {
      const saved = await uploadBusinessLogo(file);
      setBiz((prev) => ({ ...prev, logoUrl: saved.logoUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard","errUploadLogo"));
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const saveBiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBiz(true);
    try {
      const saved = await saveBusinessProfile(biz);
      setBiz(saved);
      setBizOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard","errSaveBizDetails"));
    } finally {
      setSavingBiz(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;
  const set = (k: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBiz({ ...biz, [k]: e.target.value });

  return (
    <DashboardShell><div className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className={`text-xl font-bold ${text}`}>{t("dashboard","invoices")}</h1>
          <Link href="/dashboard" className="text-sm text-blue-500 hover:underline">← {t("dashboard","navBackDashboard")}</Link>
        </div>
        <p className={`text-sm mb-6 ${sub}`}>{t("dashboard","invDesc")}</p>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Link href="/invoices/new"
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" />{t("dashboard","invNew")}</Link>
          <button onClick={() => setBizOpen(true)}
            className={`flex items-center gap-1.5 font-semibold px-4 py-2 rounded-lg text-sm border ${isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"}`}>
            <Building2 className="h-4 w-4" />{t("dashboard","invBusinessDetails")}</button>
          <button onClick={() => setInBin(!inBin)}
            className={`flex items-center gap-1.5 font-semibold px-4 py-2 rounded-lg text-sm border ${
              inBin
                ? "bg-blue-500 border-blue-500 text-white"
                : isDark ? "border-gray-600 text-gray-200" : "border-gray-300 text-gray-700"
            }`}>
            <Trash2 className="h-4 w-4" /> {t("dashboard","navRecycleBin")}{deleted.length > 0 ? ` (${deleted.length})` : ""}
          </button>
          <Link href="/customers" className={`text-sm px-3 py-2 ${sub} hover:underline`}>{t("dashboard","navToCustomers")} →</Link>
        </div>

        {/* Nudge if the header would come out blank on a customer's invoice */}
        {!loading && !biz.businessName && (
          <div className={`rounded-xl border p-4 mb-5 ${isDark ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"}`}>
            <p className={`text-sm ${isDark ? "text-amber-200" : "text-amber-800"}`}>{t("dashboard","invAddYour")}<button onClick={() => setBizOpen(true)} className="underline font-semibold">business details</button> —
              your name, address, email and website appear at the top of every invoice.
            </p>
          </div>
        )}

        {loading ? (
          <p className={`text-sm ${sub}`}>{t("dashboard","invLoading")}</p>
        ) : rows.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${card}`}>
            <p className={`text-sm ${sub}`}>
              {inBin ? t("dashboard","invBinEmpty") : t("dashboard","invNoneYet")}
            </p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${sub} ${isDark ? "bg-gray-900/40" : "bg-gray-50"}`}>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","invInvoice")}</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","invCustomer")}</th>
                    <th className="px-4 py-3 font-semibold">{inBin ? "Deleted" : "Issued"}</th>
                    <th className="px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">{t("dashboard","invStatus")}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t("dashboard","invTotal")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => (
                    <tr key={inv.id} className={`border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-500 hover:underline">{inv.number}</Link>
                      </td>
                      <td className={`px-4 py-3 ${text}`}>{inv.customerName || "—"}</td>
                      <td className={`px-4 py-3 ${sub}`}>{inv.issueDate || "—"}</td>
                      <td className={`px-4 py-3 ${sub}`}>{inv.dueDate || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white capitalize"
                          style={{ backgroundColor: STATUS_COLORS[inv.status] }}>
                          {inv.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${text}`}>{money(inv.total, inv.currency)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {inBin ? (
                          <>
                            <button onClick={() => restore(inv)} disabled={busyId === inv.id}
                              className={`mr-3 ${sub} hover:text-green-500 disabled:opacity-50`} title={t("dashboard","invRestore")}>
                              <RotateCcw className="h-4 w-4 inline" />
                            </button>
                            <button onClick={() => destroy(inv)} disabled={busyId === inv.id}
                              className={`${sub} hover:text-red-500 disabled:opacity-50`} title={t("dashboard","invDeleteForever")}>
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Drafts only — a sent invoice has posted its
                                receivable, so editing it would desync the books
                                from the document. Void it instead. */}
                            {inv.status === "draft" && (
                              <Link href={`/invoices/${inv.id}/edit`} className={`mr-3 ${sub} hover:text-blue-500`} title={t("dashboard","invEdit")}>
                                <Pencil className="h-4 w-4 inline" />
                              </Link>
                            )}
                            <button onClick={() => remove(inv)} disabled={busyId === inv.id}
                              className={`${sub} hover:text-red-500 disabled:opacity-50`} title={t("dashboard","invToBin")}>
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Business Details — what appears at the top of every invoice */}
      {bizOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setBizOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className={`rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}>
            <h2 className="text-lg font-bold mb-1">{t("dashboard","invBusinessDetails")}</h2>
            <p className={`text-xs mb-4 ${sub}`}>{t("dashboard","invHeaderHint")}</p>
            <form onSubmit={saveBiz} className="space-y-3">
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invBusinessName")}</label>
                <input value={biz.businessName ?? ""} onChange={set("businessName")} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invBusinessEmail")}</label>
                  <input type="email" value={biz.businessEmail ?? ""} onChange={set("businessEmail")} className={field} />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invBusinessPhone")}</label>
                  <input value={biz.businessPhone ?? ""} onChange={set("businessPhone")} className={field} />
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invWebsite")}</label>
                <input value={biz.website ?? ""} onChange={set("website")} placeholder="www.yourbusiness.com" className={field} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invBusinessAddress")}</label>
                <input placeholder={t("dashboard","invAddrLine1")} value={biz.addressLine1 ?? ""} onChange={set("addressLine1")} className={`${field} mb-2`} />
                <input placeholder={t("dashboard","invAddrLine2")} value={biz.addressLine2 ?? ""} onChange={set("addressLine2")} className={field} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder={t("dashboard","invCity")} value={biz.city ?? ""} onChange={set("city")} className={field} />
                <input placeholder={t("dashboard","invRegion")} value={biz.region ?? ""} onChange={set("region")} className={field} />
                <input placeholder={t("dashboard","invZip")} value={biz.postalCode ?? ""} onChange={set("postalCode")} className={field} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invCountry")}</label>
                <input value={biz.country ?? ""} onChange={set("country")} className={field} />
              </div>

              {/* Business logo — appears top-left on every invoice */}
              <div>
                <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard","invBusinessLogo")}</label>
                <div className="flex items-center gap-3">
                  {biz.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={biz.logoUrl} alt="Logo" className="rounded-lg object-contain bg-white border" style={{ width: 48, height: 48 }} />
                  ) : (
                    <div className={`rounded-lg flex items-center justify-center text-xs ${isDark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-400"}`} style={{ width: 48, height: 48 }}>{t("dashboard","invNone")}</div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={onLogoPicked}
                      disabled={uploadingLogo}
                      className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer disabled:opacity-60"
                    />
                    <p className={`text-[11px] mt-1 ${sub}`}>
                      {uploadingLogo ? "Uploading…" : "PNG or JPEG, up to 1MB."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setBizOpen(false)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600" : "border-gray-300"}`}>{t("dashboard","invCancel")}</button>
                <button type="submit" disabled={savingBiz}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
                  {savingBiz ? "Saving…" : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div></DashboardShell>
  );
}
