"use client";

import { Invoice, money } from "@/lib/api/invoices";
import { BusinessProfile, formatBusinessAddress } from "@/lib/api/business";
import { Customer, formatAddress } from "@/lib/api/customers";
import { useLanguage } from '@/hooks/context/LanguageContext';

/** The "Powered by" mark in the invoice footer. Swap the file, not the code. */
const FINQUANTA_LOGO = "/images/finquanta_ai_logo.svg";

/**
 * The printable invoice. Deliberately light/white regardless of app theme —
 * it's a document, not a screen. `@media print` rules (in globals.css) hide the
 * app chrome so "Print → Save as PDF" produces a clean page, with the
 * "Powered by Finquanta.ai" footer repeating on every page.
 */
export default function InvoiceTemplate({
  invoice, business, customer,
}: {
  invoice: Invoice;
  business: BusinessProfile;
  customer: Customer | null;
}) {
  const { t } = useLanguage();
  const businessAddress = formatBusinessAddress(business);
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" }) : "—");

  return (
    <div id="invoice-print-area" className="bg-white text-slate-900 mx-auto" style={{ maxWidth: 820, padding: "48px 56px" }}>
      {/* Header: logo + business, invoice number + issue date */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt="" className="rounded-xl object-contain" style={{ width: 60, height: 60 }} />
          ) : (
            <div className="rounded-xl bg-slate-600 flex items-center justify-center text-white text-xl font-bold" style={{ width: 60, height: 60 }}>
              {(business.businessName || "F").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-[13px] leading-5">
            <p className="font-bold">{business.businessName || "Business Name"}</p>
            {businessAddress.map((line, i) => <p key={i} className="text-slate-600">{line}</p>)}
            {business.businessEmail && <p className="text-slate-600">{business.businessEmail}</p>}
            {business.businessPhone && <p className="text-slate-600">{business.businessPhone}</p>}
            {business.website && <p className="text-slate-600">{business.website}</p>}
          </div>
        </div>
        <div className="text-right text-[13px] leading-5">
          <p className="font-bold">Invoice# {invoice.number}</p>
          <p className="font-bold mt-2">{t("dashboard","invIssueDate")}</p>
          <p className="text-slate-600">{fmtDate(invoice.issueDate)}</p>
        </div>
      </div>

      {/* Rule */}
      <div className="bg-slate-600 mt-8" style={{ height: 6 }} />

      {/* Business name + customer message */}
      <h1 className="text-4xl font-semibold mt-10">{business.businessName || "Business Name"}</h1>
      {invoice.message && <p className="text-slate-700 mt-3">{invoice.message}</p>}

      {/* Bill To / Details / Payment */}
      <div className="grid grid-cols-3 gap-8 mt-16">
        {[
          {
            title: "Bill To",
            body: (
              <>
                <p>{customer?.name || invoice.customerName || "—"}</p>
                {customer?.email && <p>{customer.email}</p>}
                {customer?.phone && <p>{customer.phone}</p>}
                {customer && formatAddress(customer).split("\n").map((l, i) => <p key={i}>{l}</p>)}
              </>
            ),
          },
          { title: "Details", body: <p>{invoice.details || "—"}</p> },
          {
            title: "Payment",
            body: (
              <>
                <p>Due Date {fmtDate(invoice.dueDate)}</p>
                <p>{money(invoice.total, invoice.currency)}</p>
                {invoice.paymentTerms && <p className="text-slate-500">{invoice.paymentTerms}</p>}
              </>
            ),
          },
        ].map((col) => (
          <div key={col.title} className="border-t border-slate-300 pt-4">
            <p className="text-[11px] font-bold tracking-widest uppercase mb-3">{col.title}</p>
            <div className="text-[13px] leading-6 text-slate-800">{col.body}</div>
          </div>
        ))}
      </div>

      {/* Line items */}
      <table className="w-full mt-14 text-[13px]">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left font-bold tracking-widest uppercase text-[11px] pb-3">{t("dashboard","itItem")}</th>
            <th className="text-right font-bold tracking-widest uppercase text-[11px] pb-3 w-20">Qty</th>
            <th className="text-right font-bold tracking-widest uppercase text-[11px] pb-3 w-28">{t("dashboard","invPrice")}</th>
            <th className="text-right font-bold tracking-widest uppercase text-[11px] pb-3 w-32">{t("dashboard","amount")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.length === 0 ? (
            <tr><td colSpan={4} className="py-6 text-slate-400">{t("dashboard","itNoItems")}</td></tr>
          ) : invoice.items.map((it, i) => (
            <tr key={it.id ?? i} className="border-b border-slate-200">
              <td className="py-4 pr-4 align-top">
                <p className="font-medium">{it.name}</p>
                {it.description && <p className="text-slate-400 mt-0.5">{it.description}</p>}
              </td>
              <td className="py-4 text-right align-top">{it.quantity}</td>
              <td className="py-4 text-right align-top">{money(it.unitPrice, invoice.currency)}</td>
              <td className="py-4 text-right align-top">{money(it.amount, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-8 text-[13px]">
        <div className="flex justify-between py-1">
          <span>{t("dashboard","invSubtotal")}</span>
          <span>{money(invoice.subtotal, invoice.currency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Tax{invoice.taxRate ? ` (${invoice.taxRate}%)` : ""}</span>
          <span>{money(invoice.tax, invoice.currency)}</span>
        </div>
        <div className="flex justify-between py-3 mt-2 border-t border-b border-slate-300 font-bold text-[15px]">
          <span>{t("dashboard","invTotalDue")}</span>
          <span>{money(invoice.total, invoice.currency)}</span>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-10 text-[12px] text-slate-600">
          <p className="font-bold text-slate-800 mb-1">{t("dashboard","custNotes")}</p>
          <p className="whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Footer — repeats on every printed page */}
      <div className="invoice-footer mt-20 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          Powered by
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FINQUANTA_LOGO}
            alt="Finquanta.ai"
            className="h-3 w-auto opacity-80"
            // If the logo file isn't present, fall back to the wordmark rather
            // than showing a broken image on a customer's invoice.
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = 'none';
              el.insertAdjacentHTML('afterend', '<span style="font-weight:700;color:#334155">Finquanta<span style="color:#16a34a">.ai</span></span>');
            }}
          />
        </span>
        <span>{invoice.number}</span>
      </div>
    </div>
  );
}
