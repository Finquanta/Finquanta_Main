"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Paperclip, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  AccountingBasis, LedgerTransaction, listLedgerTransactions,
} from "@/lib/api/accounting";

/**
 * The Bookkeeping table — the familiar layout, now backed by the ledger so it
 * shows everything, not just the entries you typed.
 *
 *  Cash Basis — money that actually moved: your entries PLUS invoice payments
 *               and loan payments.
 *  Accrual    — the above, plus what's owed: invoices raised, bills to pay.
 *
 * No debits/credits on the surface — bookkeeping has to stay usable without an
 * accounting background. "Accountant view" reveals the double-entry per row.
 */

/** Human label for where a row came from. */
function typeLabel(tx: LedgerTransaction): string {
  switch (tx.sourceType) {
    case "bookkeeping":
      return tx.direction === "in" ? "Cashflow" : "Expense";
    case "invoice":
      return "Invoice (owed)";
    case "invoice_payment":
      return "Invoice paid";
    case "invoice_cancelled":
      return "Invoice cancelled";
    case "credit_revenue":
      return "Receivable";
    case "receive_ar_payment":
      return "Customer paid";
    case "credit_expense":
      return "Payable";
    case "pay_ap":
      return "Bill paid";
    case "loan_received":
      return "Loan received";
    case "loan_issued":
      return "Loan issued";
    case "loan_payment":
      return "Loan payment";
    case "loan_repayment_received":
      return "Loan repaid";
    case "cash_revenue":
      return "Cashflow";
    case "cash_expense":
      return "Expense";
    default:
      return "Entry";
  }
}

const isInvoiceRow = (tx: LedgerTransaction) => tx.sourceType.startsWith("invoice");

export default function BookkeepingCard({
  isDark, refreshKey, colors, t, onEdit, onDelete, onDeleteInvoice, onViewReceipt,
}: {
  isDark: boolean;
  refreshKey?: number;
  colors: { tableHead: string; tableRow: string; text: string; subtext: string };
  t: (ns: string, key: string) => string;
  onEdit: (tx: LedgerTransaction) => void;
  onDelete: (tx: LedgerTransaction) => void;
  /** Erases the invoice from the books entirely and bins the document. */
  onDeleteInvoice: (tx: LedgerTransaction) => void;
  onViewReceipt: (transactionId: string) => void;
}) {
  const [basis, setBasis] = useState<AccountingBasis>("cash");
  const [accountantView, setAccountantView] = useState(false);
  const [rows, setRows] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listLedgerTransactions(basis, 50)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load transactions."))
      .finally(() => setLoading(false));
  }, [basis]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
      on ? "bg-blue-500 text-white" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div>
      {/* Cash vs accrual, and the optional accountant detail */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setBasis("cash")} className={chip(basis === "cash")}>Cash Basis</button>
          <button onClick={() => setBasis("accrual")} className={chip(basis === "accrual")}>Accrual</button>
        </div>
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${sub}`}>
          <input type="checkbox" checked={accountantView} onChange={(e) => setAccountantView(e.target.checked)} />
          Accountant view
        </label>
      </div>
      <p className={`text-xs mb-3 ${sub}`}>
        {basis === "cash"
          ? "Money that actually moved — including invoice and loan payments."
          : "Everything, including money owed to you and bills you owe."}
      </p>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      <table className="w-full text-xs">
        <thead>
          <tr className={`${colors.tableHead} border-b`}>
            <th className="text-left pb-2">{t("dashboard", "date")}</th>
            <th className="text-left pb-2">{t("dashboard", "type")}</th>
            <th className="text-left pb-2">{t("dashboard", "detail")}</th>
            <th className="text-left pb-2">{t("dashboard", "amount")}</th>
            <th className="text-right pb-2" />
          </tr>
        </thead>
        <tbody className={`divide-y ${colors.tableRow}`}>
          {loading ? (
            <tr><td colSpan={5} className={`py-6 text-center ${colors.text}`}>Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} className={`py-6 text-center ${colors.text}`}>{t("dashboard", "noTransactions")}</td></tr>
          ) : (
            rows.map((tx) => {
              const editable = !!tx.transactionId;
              const owedOnly = !tx.cashMoved;
              return (
                <Fragment key={tx.id}>
                  <tr className="group">
                    <td className="py-3">{tx.date}</td>
                    <td className="py-3">
                      <span>{typeLabel(tx)}</span>
                      {tx.recurrence && tx.recurrence !== "once" && (
                        <span className={`ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isDark ? "bg-gray-700 text-gray-200" : "bg-blue-50 text-blue-600"}`}>
                          <RefreshCw className="h-2.5 w-2.5" />
                          {t("dashboard", tx.recurrence === "monthly" ? "recurrenceMonthly" : "recurrenceYearly")}
                        </span>
                      )}
                      {owedOnly && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isDark ? "bg-gray-700 text-gray-300" : "bg-amber-50 text-amber-700"}`}>
                          no cash yet
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span>{tx.description}</span>
                      {isInvoiceRow(tx) && tx.sourceId && (
                        <Link href={`/invoices/${tx.sourceId}`} className="ml-1.5 inline-flex items-center text-blue-500 hover:underline">
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </td>
                    <td className="py-3">
                      {tx.signedAmount < 0 ? "-" : "+"}${Math.abs(tx.signedAmount).toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {tx.hasReceipt && tx.transactionId && (
                          <button onClick={() => onViewReceipt(tx.transactionId!)} className="text-gray-500 hover:text-gray-700" title={t("dashboard", "viewReceipt")}>
                            <Paperclip className="h-4 w-4" />
                          </button>
                        )}
                        {editable ? (
                          <>
                            <button onClick={() => onEdit(tx)} className="text-blue-500 hover:text-blue-700" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => onDelete(tx)} className="text-red-500 hover:text-red-700" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : isInvoiceRow(tx) ? (
                          <button onClick={() => onDeleteInvoice(tx)} className="text-red-500 hover:text-red-700" title="Cancel and delete this invoice">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className={`text-[10px] ${sub}`} title="Comes from a loan — change it at the source">auto</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* The double-entry behind the row */}
                  {accountantView && tx.lines.length > 0 && (
                    <tr>
                      <td colSpan={5} className="pb-2">
                        <div className={`ml-1 pl-3 border-l ${isDark ? "border-gray-700" : "border-gray-200"} space-y-0.5`}>
                          {tx.lines.map((l, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <span className={sub}>{l.debit > 0 ? "Debit" : "Credit"} · {l.accountName}</span>
                              <span className={l.debit > 0 ? "text-green-500" : "text-red-500"}>
                                ${(l.debit > 0 ? l.debit : l.credit).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
