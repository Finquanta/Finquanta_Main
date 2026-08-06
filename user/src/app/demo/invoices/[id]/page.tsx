"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Printer, Check, Send, Trash2, Pencil } from "lucide-react";
import {
  Invoice, STATUS_COLORS, getInvoice, deleteInvoice,
} from "@/lib/demo/api/invoices";
import { BusinessProfile, getBusinessProfile } from "@/lib/demo/api/business";
import { Customer, getCustomer } from "@/lib/demo/api/customers";
import InvoiceTemplate from "@/components/user_dashboard/invoices/InvoiceTemplate";
import { useRouter } from "next/navigation";
import { markInvoicePreviewed } from "@/lib/demo/store";
import { stashForSignup } from "@/lib/demo/migrate";
// InvoiceTemplate's props are typed against the real lib/api/* interfaces. Our
// demo types cover every field it actually reads (verified against the
// component source) but aren't the same declared type, so we cast at this one
// boundary rather than loosen the real, shipping component's prop types.
import type { Invoice as RealInvoice } from "@/lib/api/invoices";
import type { BusinessProfile as RealBusinessProfile } from "@/lib/api/business";
import type { Customer as RealCustomer } from "@/lib/api/customers";
import { useLanguage } from '@/hooks/context/LanguageContext';
import { demoErrorText } from '@/lib/demo/errors';

/**
 * Long enough that the visitor has read the invoice rather than glanced at it —
 * prompting the instant the page paints reads as an ambush and gets dismissed.
 */
const PREVIEW_DWELL_MS = 5_000;

export default function DemoInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLanguage();
  const { id } = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<BusinessProfile>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, biz] = await Promise.all([getInvoice(id), getBusinessProfile()]);
      setInvoice(inv);
      setBusiness(biz);
      setCustomer(inv.customerId ? await getCustomer(inv.customerId).catch(() => null) : null);
    } catch (e) {
      setError(demoErrorText(e, t, t("dashboard","errLoadInvoice")));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  /**
   * The conversion gate. A visitor can build an invoice and see it rendered —
   * that's the whole payoff — but sending it or recording payment against it is
   * where a demo stops being able to tell the truth, so both go to signup with
   * the session stashed. Nothing is ever posted to the demo ledger from here.
   */
  const goSignup = () => {
    stashForSignup();
    router.push("/signup");
  };

  // Arm the signup prompt once they've actually had a moment with the finished
  // document, not the instant the route resolves — the point is that they've
  // seen it. Cleared on unmount so a quick bounce off the page doesn't count.
  useEffect(() => {
    if (loading || !invoice) return;
    const id = window.setTimeout(markInvoicePreviewed, PREVIEW_DWELL_MS);
    return () => window.clearTimeout(id);
  }, [loading, invoice]);

  const remove = async () => {
    if (!invoice) return;
    if (!window.confirm(t('demo','eConfirmDelete').replace('{name}', invoice.number))) return;
    try { await deleteInvoice(invoice.id); router.push("/demo/invoices"); }
    catch (e) { setError(demoErrorText(e, t, t("dashboard","errDeleteInvoice"))); }
  };

  const btn = "flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50";

  if (loading) return <div className="p-6"><p className="text-gray-500">{t("demo","loading")}</p></div>;
  if (!invoice) return (
    <div className="p-6">
      <p className="text-red-500 text-sm">{error || t("dashboard","errInvoiceNotFound")}</p>
      <Link href="/demo/invoices" className="text-blue-500 text-sm hover:underline">← Invoices</Link>
    </div>
  );

  // Every demo invoice is a draft — Sent and Paid are behind signup — so these
  // are always available, and Edit is available for the same reason.
  const canSend = invoice.status === "draft";
  const canPay = invoice.status === "draft";

  return (
    <div className="p-4 sm:p-6">
      <div className="no-print max-w-4xl mx-auto mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{invoice.number}</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white capitalize"
              style={{ backgroundColor: STATUS_COLORS[invoice.status] }}>
              {invoice.status}
            </span>
          </div>
          <Link href="/demo/invoices" className="text-sm text-blue-500 hover:underline">← Invoices</Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status === "draft" && (
            <Link href={`/demo/invoices/${invoice.id}/edit`} className={btn}>
              <Pencil className="h-4 w-4" />{t("dashboard","invEdit")}</Link>
          )}
          <button onClick={() => window.print()} className={btn}>
            <Printer className="h-4 w-4" />{t("dashboard","invPrintPdf")}</button>

          {canSend && (
            <button onClick={goSignup}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold px-3 py-2 rounded-lg">
              <Send className="h-4 w-4" />{t("dashboard","invMarkSent")}</button>
          )}
          {canPay && (
            <button onClick={goSignup}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold px-3 py-2 rounded-lg">
              <Check className="h-4 w-4" />{t("dashboard","invMarkPaid")}</button>
          )}
          <button onClick={remove} className={`${btn} hover:!text-red-500`}>
            <Trash2 className="h-4 w-4" />{t("demo","deleteTitle")}</button>
        </div>

        <p className="text-xs mt-3 text-gray-500">{t("demo","dPreviewNote")}</p>
      </div>

      <div className="max-w-4xl mx-auto shadow-sm">
        <InvoiceTemplate
          invoice={invoice as unknown as RealInvoice}
          business={business as unknown as RealBusinessProfile}
          customer={customer as unknown as RealCustomer | null}
        />
      </div>
    </div>
  );
}
