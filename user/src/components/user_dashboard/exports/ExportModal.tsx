"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { PaymentRequiredError } from "@/lib/api/client";
import { getGroups, Group } from "@/lib/api/groups";
import {
  ACCRUAL_ONLY_TYPES, downloadExport, ExportContent, ExportFormat, ExportOptions,
  ExportPreview, ExportUsage, getExportUsage, INVOICE_TYPE_ORDER, InvoiceType,
  previewExport, UNASSIGNED_GROUP,
} from "@/lib/api/exports";

/**
 * Books Export — pick what to export, see it, then download it.
 *
 * Two steps on purpose. A file is committed the moment it lands in Downloads,
 * and an export carries a date range, a basis and two filters that are easy to
 * get wrong; showing the header block and the first rows first turns "download
 * and check" into "check and download". The allowance is CHECKED on preview
 * and only SPENT on download, so looking is free.
 *
 * Modelled on BookkeepingModal's chrome rather than DialogShell — that shell is
 * capped at max-w-sm for confirmations and far too narrow for a filter panel
 * and a hundred-row table.
 */

const FORMATS: Array<{ value: ExportFormat; labelKey: string; hintKey: string }> = [
  { value: "xlsx", labelKey: "bxFormatXlsx", hintKey: "bxFormatXlsxHint" },
  { value: "csv", labelKey: "bxFormatCsv", hintKey: "bxFormatCsvHint" },
  { value: "pdf", labelKey: "bxFormatPdf", hintKey: "bxFormatPdfHint" },
  { value: "txt", labelKey: "bxFormatTxt", hintKey: "bxFormatTxtHint" },
];

const TYPE_LABEL_KEYS: Record<InvoiceType, string> = {
  income: "bxTypeIncome",
  expense: "bxTypeExpense",
  accounts_receivable: "bxTypeAr",
  accounts_payable: "bxTypeAp",
  loan_received: "bxTypeLoanReceived",
  loan_issued: "bxTypeLoanIssued",
  loan_payment: "bxTypeLoanPayment",
  loan_repaid: "bxTypeLoanRepaid",
};

type RangeMode = "day" | "month" | "year" | "custom" | "all";

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Turn the chosen range mode into the two dates the API takes. */
function resolveRange(mode: RangeMode, day: string, month: string, year: string,
  from: string, to: string): { startDate?: string; endDate?: string } {
  if (mode === "all") return {};
  if (mode === "day") return { startDate: day, endDate: day };
  if (mode === "month") {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return {};
    // Day 0 of the next month is the last day of this one, so this is correct
    // for February and for leap years without a table of month lengths.
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { startDate: `${month}-01`, endDate: `${month}-${String(last).padStart(2, "0")}` };
  }
  if (mode === "year") return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  return { startDate: from || undefined, endDate: to || undefined };
}

export default function ExportModal({
  isOpen, onClose, isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const { t } = useLanguage();
  const d = useCallback((key: string) => t("dashboard", key), [t]);

  const [step, setStep] = useState<"options" | "preview">("options");
  const [content, setContent] = useState<ExportContent>("ledger");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [basis, setBasis] = useState<"cash" | "accrual">("cash");

  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [day, setDay] = useState(todayIso);
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [invoiceTypes, setInvoiceTypes] = useState<InvoiceType[]>([]);

  const [usage, setUsage] = useState<ExportUsage | null>(null);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywalled, setPaywalled] = useState(false);

  // Reset to a clean sheet each time it opens, so a previous run's filters
  // can't silently apply to a new export.
  useEffect(() => {
    if (!isOpen) return;
    setStep("options");
    setPreview(null);
    setError(null);
    setPaywalled(false);
    setBusy(false);

    getGroups().then(setGroups).catch(() => setGroups([]));
    getExportUsage()
      .then((u) => { setUsage(u); setPaywalled(!u.allowed); })
      .catch(() => setUsage(null));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, busy, onClose]);

  /**
   * Cash basis cannot contain anything unpaid, so AR and AP are disabled
   * there. Any already-ticked are dropped rather than silently ignored by the
   * server — leaving them checked would promise rows that cannot appear.
   */
  useEffect(() => {
    if (basis === "cash" && invoiceTypes.some((t) => ACCRUAL_ONLY_TYPES.includes(t))) {
      setInvoiceTypes((prev) => prev.filter((t) => !ACCRUAL_ONLY_TYPES.includes(t)));
    }
  }, [basis, invoiceTypes]);

  const options: ExportOptions = useMemo(() => ({
    content,
    format,
    basis,
    ...resolveRange(rangeMode, day, month, year, from, to),
    groupIds,
    invoiceTypes,
  }), [content, format, basis, rangeMode, day, month, year, from, to, groupIds, invoiceTypes]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const result = await previewExport(options);
      setPreview(result);
      setUsage(result.usage);
      setStep("preview");
    } catch (e) {
      if (e instanceof PaymentRequiredError) {
        setPaywalled(true);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : d("bxPreviewFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function runDownload() {
    setBusy(true);
    setError(null);
    try {
      await downloadExport(options);
      // Reflect the spend immediately; the meter is otherwise a period behind.
      setUsage((u) => (u && u.limit !== null
        ? { ...u, used: u.used + 1, remaining: Math.max(0, (u.remaining ?? 1) - 1) }
        : u));
      onClose();
    } catch (e) {
      if (e instanceof PaymentRequiredError) {
        setPaywalled(true);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : d("bxDownloadFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  const panel = isDark ? "bg-[#1e1e2e] text-gray-100" : "bg-white text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const field = `w-full text-sm rounded-lg px-2.5 py-1.5 border outline-none ${
    isDark ? "bg-gray-800 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-300 text-gray-800"
  }`;
  const chip = (on: boolean, disabled = false) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
      disabled ? "opacity-40 cursor-not-allowed" : ""
    } ${
      on ? "bg-green-500 text-white"
        : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  const isLedger = content === "ledger";
  const pdfTooLong = format === "pdf" && !!preview
    && preview.totalRows > (preview.pdfRowLimit ?? Infinity);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bx-title"
      >
        <div className={`flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div>
            <h2 id="bx-title" className="text-base font-semibold">{d("bxTitle")}</h2>
            <p className={`text-xs mt-0.5 ${sub}`}>
              {step === "options" ? d("bxSubtitle") : d("bxPreviewSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {usage && (
              <span className={`text-xs ${sub}`}>
                {usage.limit === null
                  ? d("bxUnlimited")
                  : `${usage.used} / ${usage.limit} ${d("bxUsedThisMonth")}`}
              </span>
            )}
            <button onClick={onClose} aria-label={d("dialogCancel")} className={`text-lg leading-none ${sub} hover:opacity-70`}>×</button>
          </div>
        </div>

        {error && (
          <div role="alert" className={`mx-5 mt-3 text-xs rounded-lg px-3 py-2 ${
            isDark ? "bg-red-950 text-red-200 border border-red-900" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {error}
          </div>
        )}

        {step === "options" ? (
          <div className="px-5 py-4 space-y-4">
            {/* What */}
            <Section label={d("bxWhat")} sub={sub}>
              <div className="flex gap-1.5">
                <button onClick={() => setContent("ledger")} className={chip(isLedger)}>{d("bxTransactions")}</button>
                <button onClick={() => setContent("invoices")} className={chip(!isLedger)}>{d("bxInvoices")}</button>
              </div>
            </Section>

            {/* Format */}
            <Section label={d("bxFormat")} sub={sub}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                      format === f.value
                        ? "border-green-500 ring-1 ring-green-500"
                        : isDark ? "border-gray-600 hover:border-gray-500" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xs font-semibold block">{d(f.labelKey)}</span>
                    <span className={`text-[11px] ${sub}`}>{d(f.hintKey)}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Date range */}
            <Section label={d("bxDateRange")} sub={sub}>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {(["day", "month", "year", "custom", "all"] as RangeMode[]).map((m) => (
                  <button key={m} onClick={() => setRangeMode(m)} className={chip(rangeMode === m)}>
                    {d(`bxRange_${m}`)}
                  </button>
                ))}
              </div>
              {rangeMode === "day" && (
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} />
              )}
              {rangeMode === "month" && (
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
              )}
              {rangeMode === "year" && (
                <input type="number" min="2000" max="2100" value={year}
                  onChange={(e) => setYear(e.target.value)} className={field} />
              )}
              {rangeMode === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
                  <span className={`text-xs ${sub}`}>—</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
                </div>
              )}
            </Section>

            {isLedger && (
              <>
                {/* Basis */}
                <Section label={d("bxBasis")} sub={sub} hint={d("bxBasisHint")}>
                  <div className="flex gap-1.5">
                    <button onClick={() => setBasis("cash")} className={chip(basis === "cash")}>{d("cashBasis")}</button>
                    <button onClick={() => setBasis("accrual")} className={chip(basis === "accrual")}>{d("accrualBasis")}</button>
                  </div>
                </Section>

                {/* Groups */}
                <Section label={d("bxGroups")} sub={sub} hint={d("bxEmptyMeansAll")}>
                  <div className="flex gap-1.5 flex-wrap">
                    {groups.map((g) => (
                      <button key={g.id} onClick={() => setGroupIds((p) => toggle(p, g.id))}
                        className={chip(groupIds.includes(g.id))}>
                        <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                          style={{ backgroundColor: g.color }} />
                        {g.name}
                      </button>
                    ))}
                    <button onClick={() => setGroupIds((p) => toggle(p, UNASSIGNED_GROUP))}
                      className={chip(groupIds.includes(UNASSIGNED_GROUP))}>
                      <span className="italic">{d("unassignedRow")}</span>
                    </button>
                  </div>
                </Section>

                {/* Invoice type */}
                <Section label={d("bxInvoiceType")} sub={sub} hint={d("bxEmptyMeansAll")}>
                  <div className="flex gap-1.5 flex-wrap">
                    {INVOICE_TYPE_ORDER.map((type) => {
                      const blocked = basis === "cash" && ACCRUAL_ONLY_TYPES.includes(type);
                      return (
                        <button
                          key={type}
                          disabled={blocked}
                          title={blocked ? d("bxAccrualOnly") : undefined}
                          onClick={() => setInvoiceTypes((p) => toggle(p, type))}
                          className={chip(invoiceTypes.includes(type), blocked)}
                        >
                          {d(TYPE_LABEL_KEYS[type])}
                        </button>
                      );
                    })}
                  </div>
                </Section>
              </>
            )}
          </div>
        ) : (
          <div className="px-5 py-4">
            {/* The header block, exactly as it will appear in the file. */}
            <div className={`rounded-lg border px-3 py-2.5 mb-3 ${isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-start gap-3">
                {preview?.header.logoDataUri && format === "pdf" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.header.logoDataUri} alt="" className="h-10 w-auto object-contain" />
                )}
                <div className="text-xs leading-relaxed">
                  <div className="font-semibold text-sm">{preview?.header.businessName}</div>
                  {preview?.header.businessPhone && <div className={sub}>{preview.header.businessPhone}</div>}
                  {preview?.header.registrationNumber && <div className={sub}>Reg. No. {preview.header.registrationNumber}</div>}
                  {preview?.header.taxNumber && <div className={sub}>Tax No. {preview.header.taxNumber}</div>}
                  <div className={`mt-1 ${sub}`}>{d("bxExportedBy")} {preview?.header.exportedBy} — {preview?.header.exportedAt}</div>
                  <div className={sub}>{preview?.header.rangeLabel} · {preview?.header.basisLabel}</div>
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-between text-xs mb-2 ${sub}`}>
              <span>
                {preview?.totalRows ?? 0} {d("bxRows")}
                {format === "pdf" && preview?.estimatedPages
                  ? ` · ${preview.estimatedPages} ${d("bxPages")}` : ""}
              </span>
              {preview && preview.totalRows > preview.rows.length && (
                <span>{d("bxShowingFirst")} {preview.rows.length}</span>
              )}
            </div>

            {pdfTooLong && (
              <div className={`text-xs rounded-lg px-3 py-2 mb-2 ${
                isDark ? "bg-amber-950 text-amber-200 border border-amber-900" : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}>
                {d("bxPdfTooLong")}
              </div>
            )}

            {preview && preview.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={isDark ? "text-gray-400" : "text-gray-500"}>
                      {preview.columns.map((c) => (
                        <th key={c} className={`text-left font-medium py-1.5 pr-3 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className={isDark ? "border-b border-gray-800" : "border-b border-gray-100"}>
                        {preview.columns.map((c) => (
                          <td key={c} className="py-1.5 pr-3 align-top whitespace-nowrap">
                            {String(row[cellKey(c)] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={`text-xs py-6 text-center ${sub}`}>{d("bxNothingInRange")}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <button
            onClick={step === "preview" ? () => setStep("options") : onClose}
            disabled={busy}
            className={`px-3 py-2 rounded-lg border text-sm font-semibold disabled:opacity-60 ${
              isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            {step === "preview" ? d("bxBackToEditing") : d("dialogCancel")}
          </button>

          {step === "options" ? (
            <button
              onClick={runPreview}
              disabled={busy || paywalled}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy ? d("bxWorking") : d("bxPreview")}
            </button>
          ) : (
            <button
              onClick={runDownload}
              disabled={busy || paywalled || (preview?.totalRows ?? 0) === 0 || pdfTooLong}
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy ? d("bxWorking") : d("bxDownload")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, sub, hint, children }: {
  label: string; sub: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-xs font-semibold">{label}</span>
        {hint && <span className={`text-[11px] ${sub}`}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * The API sends rows as objects keyed in camelCase while `columns` carries the
 * display names that go into the file. Mapped here so the preview table and
 * the file cannot disagree about column order.
 */
function cellKey(column: string): string {
  switch (column) {
    case "Invoice Type": return "invoiceType";
    case "Issue Date": return "issueDate";
    case "Due Date": return "dueDate";
    default: return column.charAt(0).toLowerCase() + column.slice(1).replace(/\s+/g, "");
  }
}
