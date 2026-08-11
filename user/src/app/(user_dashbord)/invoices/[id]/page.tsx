"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Mail, Check, Send, Ban, Pencil } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  Invoice, STATUS_COLORS, getInvoice, markInvoiceSent, markInvoicePaid, cancelInvoice, money,
} from "@/lib/api/invoices";
import { BusinessProfile, getBusinessProfile } from "@/lib/api/business";
import { Customer, getCustomer } from "@/lib/api/customers";
import InvoiceTemplate from "@/components/user_dashboard/invoices/InvoiceTemplate";
import DashboardShell from "@/components/user_dashboard/DashboardShell";
import AddToBrainButton from "@/components/user_dashboard/brain/AddToBrainButton";

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<BusinessProfile>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, biz] = await Promise.all([getInvoice(id), getBusinessProfile()]);
      setInvoice(inv);
      setBusiness(biz);
      setCustomer(inv.customerId ? await getCustomer(inv.customerId).catch(() => null) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard","errLoadInvoice"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const act = async (fn: () => Promise<Invoice>) => {
    setBusy(true); setError(null);
    try { setInvoice(await fn()); }
    catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(false); }
  };

  /**
   * v1 email: open the user's own mail client with the invoice pre-written.
   * Proper in-app delivery (an email API) can slot in behind this later without
   * changing the rest of the flow.
   */
  const emailInvoice = () => {
    if (!invoice) return;
    const to = customer?.email || invoice.customerEmail || "";
    const subject = `Invoice ${invoice.number} from ${business.businessName || "us"}`;
    const body = [
      `Hi${customer?.name ? ` ${customer.name}` : ""},`,
      ``,
      `Please find invoice ${invoice.number} for ${money(invoice.total, invoice.currency)}.`,
      invoice.dueDate ? `It's due on ${invoice.dueDate}.` : ``,
      ``,
      `You can view it here: ${window.location.href}`,
      ``,
      `Thank you,`,
      business.businessName || "",
    ].filter(Boolean).join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const btn = `flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border ${isDark ? "border-gray-600 text-gray-200 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`;

  if (loading) return <DashboardShell><div className="p-6"><p className={sub}>{t("dashboard","loading")}</p></div></DashboardShell>;
  if (!invoice) return (
    <DashboardShell><div className="p-6">
      <p className="text-red-500 text-sm">{error || t("dashboard","errInvoiceNotFound")}</p>
      <Link href="/invoices" className="text-blue-500 text-sm hover:underline">← Invoices</Link>
    </div></DashboardShell>
  );

  const canSend = invoice.status === "draft";
  const canPay = invoice.status !== "paid" && invoice.status !== "cancelled";
  // A paid invoice CAN be cancelled (voided) — otherwise one paid by mistake
  // could never be undone. Cancelling reverses whatever it actually posted.
  const canCancel = invoice.status !== "cancelled";

  return (
    <DashboardShell><div className="p-4 sm:p-6">
      {/* Toolbar — hidden when printing */}
      <div className="no-print max-w-4xl mx-auto mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold ${text}`}>{invoice.number}</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white capitalize"
              style={{ backgroundColor: STATUS_COLORS[invoice.status] }}>
              {invoice.status}
            </span>
          </div>
          <Link href="/invoices" className="text-sm text-blue-500 hover:underline">← Invoices</Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Only a draft is editable. Once an invoice is sent it has posted the
              receivable and gone out to the customer, and editing it would move
              the document without moving the books — raise it at 100, edit it to
              500, mark it paid, and Accounts Receivable is left at -400. Past
              draft the way back is Void, which reverses what was actually
              posted. */}
          {invoice.status === "draft" && (
            <Link href={`/invoices/${invoice.id}/edit`} className={btn}>
              <Pencil className="h-4 w-4" />{t("dashboard","invEdit")}</Link>
          )}
          <button onClick={() => window.print()} className={btn}>
            <Printer className="h-4 w-4" />{t("dashboard","invPrintPdf")}</button>
          <button onClick={emailInvoice} className={btn}>
            <Mail className="h-4 w-4" />{t("dashboard","invEmail")}</button>
          {/* Files a pointer to this invoice in the Brain and opens it, so the
              reasoning about it gets written while it's still fresh. */}
          <AddToBrainButton
            isDark={isDark} entityType="invoice" entityId={invoice.id}
            title={customer?.name ? `${invoice.number} — ${customer.name}` : invoice.number}
          />

          {canSend && (
            <button onClick={() => act(() => markInvoiceSent(invoice.id))} disabled={busy}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-semibold px-3 py-2 rounded-lg">
              <Send className="h-4 w-4" />{t("dashboard","invMarkSent")}</button>
          )}
          {canPay && (
            <button onClick={() => act(() => markInvoicePaid(invoice.id))} disabled={busy}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold px-3 py-2 rounded-lg">
              <Check className="h-4 w-4" />{t("dashboard","invMarkPaid")}</button>
          )}
          {canCancel && (
            <button
              onClick={() => {
                const msg = invoice.status === "paid"
                  ? "Void this paid invoice? The revenue and the cash it recorded will be reversed out of your books."
                  : "Cancel this invoice? If it's already in your books, a reversing entry is recorded.";
                if (window.confirm(msg)) act(() => cancelInvoice(invoice.id));
              }}
              disabled={busy} className={`${btn} hover:!text-red-500`}>
              <Ban className="h-4 w-4" /> {invoice.status === "paid" ? "Void" : "Cancel"}
            </button>
          )}
        </div>

        <p className={`text-xs mt-3 ${sub}`}>
          {invoice.status === "draft" && "This is a draft — nothing has hit your books yet. Marking it Sent records what you're owed."}
          {(invoice.status === "sent" || invoice.status === "viewed") && "Recorded as money owed to you (Accounts Receivable). Marking it Paid records the cash."}
          {invoice.status === "overdue" && "Past its due date and still unpaid. It's sitting in Accounts Receivable."}
          {invoice.status === "paid" && "Paid — business cash increased and Accounts Receivable decreased."}
          {invoice.status === "cancelled" && "Cancelled. Any receivable that was recorded has been reversed."}
        </p>
      </div>

      {/* The document */}
      <div className="max-w-4xl mx-auto shadow-sm">
        <InvoiceTemplate invoice={invoice} business={business} customer={customer} />
      </div>
    </div></DashboardShell>
  );
}
