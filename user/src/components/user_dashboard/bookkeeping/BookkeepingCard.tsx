"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Paperclip, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  AccountingBasis, LedgerTransaction, listLedgerTransactions,
} from "@/lib/api/accounting";
import { formatMoney } from "@/lib/api/fx";
import { getGroups, createGroup } from "@/lib/api/groups";

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

/**
 * Human label for where a row came from. Takes `t` because these render in the
 * table beside translated headers — returning English here left half the row in
 * the user's language and half in ours.
 */
function typeLabel(tx: LedgerTransaction, t: (ns: string, key: string) => string): string {
  const d = (key: string) => t("dashboard", key);
  switch (tx.sourceType) {
    case "bookkeeping":
      return tx.direction === "in" ? d("cashflow") : d("expense");
    case "invoice":
      return d("invoiceOwed");
    case "invoice_payment":
      return d("invoicePaid");
    case "invoice_cancelled":
      return d("invoiceCancelled");
    case "credit_revenue":
      return d("receivable");
    case "receive_ar_payment":
      return d("customerPaid");
    case "credit_expense":
      return d("payable");
    case "pay_ap":
      return d("billPaid");
    case "loan_received":
      return d("loanReceived");
    case "loan_issued":
      return d("loanIssued");
    case "loan_payment":
      return d("loanPaymentRow");
    case "loan_repayment_received":
      return d("loanRepaid");
    case "cash_revenue":
      return d("cashflow");
    case "cash_expense":
      return d("expense");
    default:
      return d("entryRow");
  }
}

const isInvoiceRow = (tx: LedgerTransaction) => tx.sourceType.startsWith("invoice");
const isLoanRow = (tx: LedgerTransaction) => tx.sourceType.startsWith("loan");
const isLoanPaymentRow = (tx: LedgerTransaction) =>
  tx.sourceType === "loan_payment" || tx.sourceType === "loan_repayment_received";
/** Accrual / manual entries: posted straight to the ledger, no source record. */
const isDirectRow = (tx: LedgerTransaction) =>
  !tx.transactionId && !isInvoiceRow(tx) && !isLoanRow(tx);
/** Rows we can assign a group to, edit and delete right here. */
const isManageableRow = (tx: LedgerTransaction) => isLoanRow(tx) || isDirectRow(tx);

export default function BookkeepingCard({
  isDark, refreshKey, colors, t, onEdit, onDelete, onDeleteInvoice, onAssignGroup, onDeleteLedger, onEditLedger, onViewReceipt,
}: {
  isDark: boolean;
  refreshKey?: number;
  colors: { tableHead: string; tableRow: string; text: string; subtext: string };
  t: (ns: string, key: string) => string;
  onEdit: (tx: LedgerTransaction) => void;
  onDelete: (tx: LedgerTransaction) => void;
  /** Erases the invoice from the books entirely and bins the document. */
  onDeleteInvoice: (tx: LedgerTransaction) => void;
  /** Assign/clear the group on a loan or accrual row (no source doc to edit). */
  onAssignGroup: (tx: LedgerTransaction, groupId: string | null) => void;
  /** Delete a loan (whole) or an accrual/manual entry. */
  onDeleteLedger: (tx: LedgerTransaction) => void;
  /** Edit a loan or accrual row (opens the modal pre-filled; re-posts on save). */
  onEditLedger: (tx: LedgerTransaction) => void;
  onViewReceipt: (transactionId: string) => void;
}) {
  const [basis, setBasis] = useState<AccountingBasis>("cash");
  const [accountantView, setAccountantView] = useState(false);
  /**
   * Stops the rotation below once the reader picks a basis themselves. Goals and
   * Reminders rotate forever because swapping them is free; swapping the basis
   * refetches the ledger, and yanking someone off the view they just chose —
   * mid-read, with a network round trip — is worse than simply stopping.
   */
  const [basisPinned, setBasisPinned] = useState(false);

  /** Auto-rotate Cash Basis / Accrual every 10s, matching the Goals/Reminders card. */
  useEffect(() => {
    if (basisPinned) return;
    const id = setInterval(() => {
      setBasis((b) => (b === "cash" ? "accrual" : "cash"));
    }, 10000);
    return () => clearInterval(id);
  }, [basisPinned]);

  const chooseBasis = (next: AccountingBasis) => {
    setBasisPinned(true);
    setBasis(next);
  };
  const [rows, setRows] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // id → {name,color} so a row's groupId can render as a readable chip.
  const [groupMap, setGroupMap] = useState<Record<string, { name: string; color: string }>>({});
  // Selected group ids to filter by (plus 'none' for Unassigned). Empty = all.
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listLedgerTransactions(basis, 50)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : t("dashboard","errLoadTransactions")))
      .finally(() => setLoading(false));
  }, [basis]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const loadGroups = useCallback(() => {
    getGroups()
      .then((gs) => setGroupMap(Object.fromEntries(gs.map((g) => [g.id, { name: g.name, color: g.color }]))))
      .catch(() => setGroupMap({}));
  }, []);
  useEffect(() => { loadGroups(); }, [loadGroups, refreshKey]);

  const toggleGroupFilter = (key: string) =>
    setGroupFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const createGroupInline = async () => {
    const nm = newGroupName.trim();
    if (!nm) return;
    try {
      const g = await createGroup({ name: nm });
      setGroupMap((m) => ({ ...m, [g.id]: { name: g.name, color: g.color } }));
      setNewGroupName("");
      setCreatingGroup(false);
    } catch { /* surfaced elsewhere; keep the panel usable */ }
  };

  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
      on ? "bg-blue-500 text-white" : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  // Filter the visible rows by the chosen groups (any of them). Empty = all.
  const groupEntries = Object.entries(groupMap);
  const visibleRows = groupFilter.length === 0
    ? rows
    : rows.filter((r) =>
        (r.groupId && groupFilter.includes(r.groupId)) || (!r.groupId && groupFilter.includes("none")));
  const filterLabel = groupFilter.length === 0
    ? t("dashboard", "allGroups")
    : `${groupFilter.length} ${t("dashboard", "selectedCount")}`;

  return (
    <div>
      {/* Cash vs accrual, and the optional accountant detail */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => chooseBasis("cash")} className={chip(basis === "cash")}>{t("dashboard","cashBasis")}</button>
          <button onClick={() => chooseBasis("accrual")} className={chip(basis === "accrual")}>{t("dashboard","accrualBasis")}</button>
        </div>
        <div className="flex items-center gap-3">
          {/* Group filter — a multi-select popover, with inline group creation. */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`text-xs rounded-lg px-2.5 py-1 border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600" : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"}`}
              title="Filter by group"
            >
              {filterLabel} ▾
            </button>
            {filterOpen && (
              <>
                {/* click-away backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => { setFilterOpen(false); setCreatingGroup(false); }} />
                <div className={`absolute right-0 mt-1 z-20 w-52 rounded-lg border shadow-lg p-1.5 ${isDark ? "bg-[#1e1e2e] border-gray-700" : "bg-white border-gray-200"}`}>
                  {groupFilter.length > 0 && (
                    <button onClick={() => setGroupFilter([])} className="w-full text-left text-[11px] text-blue-500 hover:underline px-2 py-1">{t("demo","dClearFilter")}</button>
                  )}
                  <div className="max-h-56 overflow-y-auto">
                    {groupEntries.map(([id, g]) => (
                      <label key={id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${isDark ? "hover:bg-gray-700 text-gray-200" : "hover:bg-gray-100 text-gray-700"}`}>
                        <input type="checkbox" checked={groupFilter.includes(id)} onChange={() => toggleGroupFilter(id)} />
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="truncate">{g.name}</span>
                      </label>
                    ))}
                    <label className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
                      <input type="checkbox" checked={groupFilter.includes("none")} onChange={() => toggleGroupFilter("none")} />
                      <span className="italic">{t("dashboard","unassignedRow")}</span>
                    </label>
                  </div>
                  {/* Inline create */}
                  <div className={`mt-1 pt-1.5 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                    {creatingGroup ? (
                      <div className="flex gap-1 px-1">
                        <input autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") createGroupInline(); if (e.key === "Escape") setCreatingGroup(false); }}
                          placeholder="Group name"
                          className={`flex-1 text-xs rounded px-2 py-1 border outline-none ${isDark ? "bg-gray-800 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-300 text-gray-800"}`} />
                        <button onClick={createGroupInline} disabled={!newGroupName.trim()} className="text-xs font-semibold text-blue-500 px-1 disabled:opacity-40">Add</button>
                      </div>
                    ) : (
                      <button onClick={() => setCreatingGroup(true)} className="w-full text-left text-[11px] font-medium text-blue-500 hover:underline px-2 py-1">+ New group</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${sub}`}>
            <input type="checkbox" checked={accountantView} onChange={(e) => setAccountantView(e.target.checked)} />
            {t("dashboard","accountantView")}
          </label>
        </div>
      </div>
      <p className={`text-xs mb-3 ${sub}`}>
        {basis === "cash"
          ? t("dashboard", "cashBasisHint")
          : t("dashboard", "accrualHint")}
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
            <tr><td colSpan={5} className={`py-6 text-center ${colors.text}`}>{t("dashboard","loading")}</td></tr>
          ) : visibleRows.length === 0 ? (
            <tr><td colSpan={5} className={`py-6 text-center ${colors.text}`}>
              {rows.length === 0 ? t("dashboard", "noTransactions") : t("dashboard","errNoGroupMatch")}
            </td></tr>
          ) : (
            visibleRows.map((tx) => {
              const editable = !!tx.transactionId;
              const owedOnly = !tx.cashMoved;
              return (
                <Fragment key={tx.id}>
                  <tr className="group">
                    <td className="py-3">{tx.date}</td>
                    <td className="py-3">
                      {/* Cashflow and Expense get the same pills the entry
                          modal uses, so a row reads the same way here as it did
                          when it was created. Everything else stays plain — the
                          colour is what distinguishes money in from money out,
                          and pilling every label would drown that out. */}
                      {tx.direction === "in" || tx.direction === "out" ? (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            tx.direction === "in" ? "bg-green-500 text-white" : "bg-orange-400 text-white"
                          }`}
                        >
                          {typeLabel(tx, t)}
                        </span>
                      ) : (
                        <span>{typeLabel(tx, t)}</span>
                      )}
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
                      {/* The note the user typed, if any — distinct from the name. */}
                      {tx.note && <span className={`block text-[11px] ${sub}`}>{tx.note}</span>}
                      {/* Business Group chip, if assigned. */}
                      {tx.groupId && groupMap[tx.groupId] && (
                        <span
                          className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ color: groupMap[tx.groupId].color, backgroundColor: `${groupMap[tx.groupId].color}1a` }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: groupMap[tx.groupId].color }} />
                          {groupMap[tx.groupId].name}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {tx.signedAmount < 0 ? "-" : "+"}${Math.abs(tx.signedAmount).toFixed(2)}
                      {/* Entered in a foreign currency — show what actually moved. */}
                      {tx.currency && tx.originalAmount != null && (
                        <span className={`block text-[10px] ${sub}`} title="Original amount, converted to USD for your books">
                          {formatMoney(tx.originalAmount, tx.currency)}
                        </span>
                      )}
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
                            <button onClick={() => onEdit(tx)} className="text-blue-500 hover:text-blue-700" title={t("dashboard","invEdit")}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => onDelete(tx)} className="text-red-500 hover:text-red-700" title={t("demo","deleteTitle")}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : isInvoiceRow(tx) ? (
                          <button onClick={() => onDeleteInvoice(tx)} className="text-red-500 hover:text-red-700" title="Cancel and delete this invoice">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : isManageableRow(tx) ? (
                          <>
                            <select
                              value={tx.groupId ?? ""}
                              onChange={(e) => onAssignGroup(tx, e.target.value || null)}
                              className={`rounded px-1.5 py-0.5 text-[11px] max-w-[120px] border outline-none ${isDark ? "bg-[#2a2a3e] border-gray-600 text-gray-100" : "bg-white border-gray-300 text-gray-700"}`}
                              title={t("demo","dAssignGroup")}
                            >
                              <option value="">{t("dashboard","invNoGroup")}</option>
                              {Object.entries(groupMap).map(([id, g]) => (
                                <option key={id} value={id}>{g.name}</option>
                              ))}
                            </select>
                            <button onClick={() => onEditLedger(tx)} className="text-blue-500 hover:text-blue-700" title={isLoanPaymentRow(tx) ? "Edit this payment" : isLoanRow(tx) ? "Edit this loan" : "Edit this entry"}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => onDeleteLedger(tx)} className="text-red-500 hover:text-red-700" title={isLoanPaymentRow(tx) ? "Reverse this payment" : isLoanRow(tx) ? "Delete this loan and its payments" : "Delete this entry"}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <span className={`text-[10px] ${sub}`} title="Part of a loan — manage it from the loan's principal row">auto</span>
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
