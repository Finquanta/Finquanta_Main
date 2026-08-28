"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useTheme } from "@/hooks/context/ThemeContext";
import { themeClasses } from "@/lib/theme";
import {
  DocumentCapture, Destination, LOW_CONFIDENCE,
  confirmCapture, discardCapture, getCaptureFileUrl, linkCapture,
} from "@/lib/api/capture";
import { PaymentRequiredError } from "@/lib/api/client";
import { createTransaction } from "@/lib/api/transactions";
import { runWorkflow } from "@/lib/api/accounting";
import { CURRENCIES, Currency, FxRate, getFxRate } from "@/lib/api/fx";
import { Group, getGroups } from "@/lib/api/groups";

/**
 * Review before anything reaches the books.
 *
 * NOTHING here posts on its own, however confident the reading was (spec §6).
 * The same rule Finna follows: the model drafts, a person confirms. What that
 * buys is not politeness — a misread total lands in someone's accounts, and the
 * only reliable check on that is the human who has the paper in their hand.
 *
 * Low-confidence fields are marked so that check has somewhere to land. Marking
 * everything would be the same as marking nothing.
 *
 * On confirm the entry is created through the SAME calls manual entry uses —
 * createTransaction, runWorkflow — never a private import path. A second way to
 * write to the ledger is a second way for it to disagree with itself.
 */

type Field = "vendor" | "documentDate" | "total" | "taxAmount" | "currency" | "documentNumber";

interface Props {
  capture: DocumentCapture;
  onClose: () => void;
  onSaved: () => void;
  /** Raised when the allowance ran out between capture and confirm. */
  onOutOfScans: (error: PaymentRequiredError) => void;
}

export default function CaptureReviewModal({ capture, onClose, onSaved, onOutOfScans }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // One shared palette, so this dialog and the billing ones cannot disagree
  // about what a card or muted text looks like. See lib/theme.ts.
  const { surface, line, heading, body: bodyText, label: labelText, warn: warnText, panel, input } =
    themeClasses(isDark);

  const f = capture.extractedFields;

  const [vendor, setVendor] = useState(f.vendor ?? "");
  const [date, setDate] = useState(f.documentDate ?? new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState(f.total != null ? String(f.total) : "");
  /**
   * A starting point from what the document appears to be — never a decision.
   * A vendor bill defaults to Accounts Payable because that is what a bill is;
   * proof a customer paid is cash in, not a receivable, because the money has
   * already arrived. The user changes it in one click either way.
   */
  const [destination, setDestination] = useState<Destination>(
    capture.documentType === "customer_payment_proof"
      ? "income"
      : capture.documentType === "vendor_bill"
      ? "bill"
      : "expense"
  );
  const [note, setNote] = useState(f.documentNumber ? `#${f.documentNumber}` : "");
  const [preview, setPreview] = useState<string | null>(null);
  /** The email body, when that is what the document is. */
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Currency, seeded from the document itself.
   *
   * The extraction already reads a currency off the page, so a euro receipt
   * should arrive with EUR selected rather than making the user notice and fix
   * it. Anything outside the two the books support falls back to USD — the
   * picker offers what `fx.ts` offers, and inventing a third option here would
   * be a promise the rate endpoint cannot keep.
   */
  const detected = (f.currency ?? "").toUpperCase();
  const [currency, setCurrency] = useState<Currency>(
    (CURRENCIES as readonly string[]).includes(detected) ? (detected as Currency) : "USD"
  );
  const [usdAmount, setUsdAmount] = useState("");
  const [usdEdited, setUsdEdited] = useState(false);
  const [rate, setRate] = useState<FxRate | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  /**
   * Cost / profit centres, assignable here rather than afterwards.
   *
   * Grouping an entry from the Groups page means finding it again later; the
   * moment you are already looking at the receipt is the moment you know which
   * job it belongs to. Optional — an ungrouped entry is a normal entry, and the
   * selector simply does not render for a workspace with no groups yet.
   */
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    getGroups()
      .then((all) => setGroups(all.filter((g) => g.status !== "archived")))
      // Groups are an optional refinement; failing to load them must not stand
      // between somebody and recording their receipt.
      .catch(() => setGroups([]));
  }, []);

  // The document itself, beside the fields — checking a total against a number
  // you cannot see is not checking.
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    getCaptureFileUrl(capture.id)
      .then(async (u) => {
        if (!alive) { URL.revokeObjectURL(u); return; }
        url = u;
        setPreview(u);
        // Text has to be read out of the blob to be shown; an <img> cannot
        // display it and an <object> would offer it as a download.
        if (capture.mimeType.startsWith("text/")) {
          try { setPreviewText(await (await fetch(u)).text()); } catch { /* fields still work */ }
        }
      })
      .catch(() => { /* the fields still work without it */ });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [capture.id, capture.mimeType]);

  /**
   * Foreign currency is offered on CASH entries only, exactly as the manual
   * entry form has it. The accrual workflows (`runWorkflow`) take an amount and
   * nothing else — there is no field on them to carry the original currency or
   * the rate used, so offering the choice there would silently record a euro
   * figure as dollars. One limitation, honoured in both places.
   */
  const isCash = destination === "income" || destination === "expense";
  const foreign = isCash && currency !== "USD";

  // Fetch the rate whenever a foreign amount/date is in play, and fill the USD
  // unless the user has typed their own.
  useEffect(() => {
    if (!foreign) {
      setRate(null);
      setRateError(null);
      return;
    }
    const amt = Number(total);
    if (!date || !(amt > 0)) return;

    let alive = true;
    setRateLoading(true);
    setRateError(null);
    getFxRate(currency, "USD", date)
      .then((r) => {
        if (!alive) return;
        setRate(r);
        if (!usdEdited) setUsdAmount((amt * r.rate).toFixed(2));
      })
      .catch((e) => {
        if (alive) setRateError(e instanceof Error ? e.message : t("dashboard", "captureRateFailed"));
      })
      .finally(() => { if (alive) setRateLoading(false); });

    return () => { alive = false; };
  }, [foreign, currency, total, date, usdEdited, t]);

  const low = (field: Field) => (capture.confidenceScores[field] ?? 1) < LOW_CONFIDENCE;

  const fieldClass = (field: Field) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
      low(field)
        ? isDark
          ? "border-amber-400 bg-amber-900/20 text-amber-100"
          : "border-amber-400 bg-amber-50 text-gray-900"
        : input
    }`;

  const save = async () => {
    setError(null);
    const amount = Number(total);
    // `dashboard.errAmount`, not `demo.errAmountPositive` — the latter has never
    // existed in any locale, so this printed the raw key back at the user
    // instead of a sentence. Its two neighbours below were already correct.
    if (!Number.isFinite(amount) || amount <= 0) return setError(t("dashboard", "errAmount"));
    if (!date) return setError(t("dashboard", "errDate"));
    if (!vendor.trim()) return setError(t("dashboard", "errInvoiceName"));

    setSaving(true);
    try {
      /**
       * Permission FIRST, then the entry.
       *
       * This consumes the monthly allowance, so it has to be able to say no
       * before anything is written — otherwise a workspace that ran out gets an
       * entry it was refused, and the books and the meter disagree.
       */
      await confirmCapture(capture.id, destination);

      let recordId: string | null = null;
      if (destination === "bill" || destination === "receivable") {
        /**
         * The two accrual sides, posted through the same workflows the Accrual
         * tab of the entry form uses.
         *
         *  - Accounts Payable  → `credit_expense`: a bill owed, expense now and
         *    cash later.
         *  - Accounts Receivable → `credit_revenue`: an invoice raised, revenue
         *    now and cash when the customer pays.
         *
         * Neither moves cash, which is exactly what makes them accrual entries.
         */
        const entry = await runWorkflow({
          type: destination === "bill" ? "credit_expense" : "credit_revenue",
          amount,
          description: vendor.trim() + (note.trim() ? ` — ${note.trim()}` : ""),
          date,
          groupId: groupId || null,
        });
        recordId = entry.id;
      } else {
        // The books are kept in USD. For a foreign entry `amount` is the USD
        // value — auto-converted or overridden — and the original is kept so
        // the row can show what actually moved.
        const usd = foreign ? Number(usdAmount) : amount;
        if (foreign && !(usd > 0)) {
          setSaving(false);
          return setError(t("dashboard", "captureNeedUsd"));
        }

        const saved = await createTransaction({
          type: destination === "income" ? "income" : "expense",
          category: vendor.trim(),
          description: note.trim() || undefined,
          amount: usd,
          date,
          groupId: groupId || null,
          ...(foreign ? { currency, originalAmount: amount, exchangeRate: rate?.rate } : {}),
        });
        recordId = saved?.id ?? null;
      }

      // Best effort: the entry exists either way, and a missing link is a gap in
      // the capture record, not in the books.
      if (recordId) {
        try { await linkCapture(capture.id, destination, recordId); } catch { /* ignore */ }
      }

      onSaved();
    } catch (e) {
      if (e instanceof PaymentRequiredError) {
        onOutOfScans(e);
        return;
      }
      setError(e instanceof Error ? e.message : t("dashboard", "genericError"));
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    // Nothing was consumed, so this costs the user nothing but the seconds spent.
    try { await discardCapture(capture.id); } catch { /* ignore */ }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-review-title"
      onClick={discard}
    >
      <div
        className={`w-full max-w-3xl rounded-xl shadow-xl max-h-[92vh] overflow-y-auto ${surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-5 border-b ${line}`}>
          <h2 id="capture-review-title" className={`text-lg font-bold ${heading}`}>
            {t("dashboard", "captureReviewTitle")}
          </h2>
          <p className={`mt-1 text-sm ${bodyText}`}>
            {t("dashboard", "captureReviewBody")}
          </p>
        </div>

        {capture.extractionError && (
          <div className={`mx-5 mt-4 rounded-lg border border-amber-200 px-4 py-3 ${isDark ? "bg-amber-900/20" : "bg-amber-50"}`}>
            <p className={`text-xs ${isDark ? "text-amber-200" : "text-amber-800"}`}>
              {t("dashboard", "captureUnreadable")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
          {/* The document */}
          <div className="space-y-2">
          <div className={`rounded-lg border overflow-hidden min-h-[16rem] flex items-center justify-center ${line} ${panel}`}>
            {/* An email that carried no attachment: the body IS the document,
                stored as text. Rendered as text rather than pushed through the
                image branch, which would show a broken picture. */}
            {capture.mimeType.startsWith("text/") ? (
              <pre className={`w-full h-full max-h-[28rem] overflow-auto p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words ${labelText}`}>
                {previewText ?? "…"}
              </pre>
            ) : preview && capture.mimeType !== "application/pdf" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={t("dashboard", "captureReviewTitle")} className="max-h-[28rem] w-auto object-contain" />
            ) : preview ? (
              <object data={preview} type="application/pdf" className="w-full h-[28rem]">
                <p className="p-4 text-sm text-gray-500">{t("dashboard", "capturePdfNoPreview")}</p>
              </object>
            ) : (
              <FileText className="h-10 w-10 text-gray-300" />
            )}
          </div>

          {/**
            * A way OUT of the preview — and for a PDF it is the only one that
            * always works.
            *
            * <object> renders inline in most browsers and in some renders
            * nothing at all, where the entire fallback was a sentence saying
            * the preview was unavailable. That left somebody holding a
            * document they could not read and no route to it. The blob is
            * already fetched; this just hands it to the browser's own viewer.
            */}
          {preview && (
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("dashboard", "captureOpenInTab")}
            </a>
          )}
          </div>

          {/* The fields */}
          <div className="space-y-3">
            {([
              // `invoiceNameLabel`, the same key the manual entry form uses —
              // one name for one idea across both screens.
              ["vendor", t("dashboard", "invoiceNameLabel"), vendor, setVendor, "text"],
              ["documentDate", t("dashboard", "dateOfInvoiceLabel"), date, setDate, "date"],
            ] as const).map(([field, label, value, setter, type]) => (
              <div key={field}>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1 ${labelText}`}>
                  {label}
                  {low(field as Field) && (
                    <span className={`inline-flex items-center gap-1 font-medium ${warnText}`}>
                      <AlertTriangle className="h-3 w-3" />
                      {t("dashboard", "captureCheckThis")}
                    </span>
                  )}
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  className={fieldClass(field as Field)}
                />
              </div>
            ))}

            {/* Amount, with its currency beside it. Pulled out of the loop
                above because it is the one field that is two controls. */}
            <div>
              <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1 ${labelText}`}>
                {t("dashboard", "invoiceAmountLabel")}
                {low("total") && (
                  <span className={`inline-flex items-center gap-1 font-medium ${warnText}`}>
                    <AlertTriangle className="h-3 w-3" />
                    {t("dashboard", "captureCheckThis")}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className={`${fieldClass("total")} flex-1`}
                />
                {/* Cash entries only — see the note on `isCash`. */}
                {isCash && (
                  <select
                    value={currency}
                    onChange={(e) => { setCurrency(e.target.value as Currency); setUsdEdited(false); }}
                    className={`rounded-lg border px-3 py-2 text-sm outline-none ${input}`}
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* What will actually be recorded, when the document is not in USD.
                Editable, because a bank's rate on the day is not the ECB's. */}
            {foreign && (
              <div className={`rounded-lg px-3 py-2.5 border ${panel} ${line}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className={`text-xs font-semibold ${labelText}`}>
                    {t("dashboard", "bmRecordedUsd")}
                  </label>
                  {rateLoading ? (
                    <span className="text-[11px] text-gray-500">{t("dashboard", "captureFetchingRate")}</span>
                  ) : rate ? (
                    <span className="text-[11px] text-gray-500">
                      {rate.rate.toFixed(4)} · {rate.effectiveDate}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={usdAmount}
                    onChange={(e) => { setUsdAmount(e.target.value); setUsdEdited(true); }}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none ${input}`}
                  />
                  {usdEdited && rate && (
                    <button
                      type="button"
                      onClick={() => setUsdEdited(false)}
                      className="text-[11px] text-blue-500 hover:underline px-1"
                    >
                      {t("dashboard", "captureResetRate")}
                    </button>
                  )}
                </div>
                {rateError && (
                  <p className={`text-[11px] mt-1 ${warnText}`}>{rateError}</p>
                )}
              </div>
            )}

            <div>
              <label className={`block text-xs font-semibold mb-1 ${labelText}`}>
                {t("dashboard", "invoiceDescriptionLabel")}
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${input}`}
              />
            </div>

            {/* The type is the USER's call — no AI-suggested destination
                (spec §7). The document type only sets the starting point.
                Cash pair first, then the two accrual sides. */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${labelText}`}>
                {t("dashboard", "invoiceTypeLabel")}
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as Destination)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${input}`}
              >
                <option value="income">{t("dashboard", "captureDestIncome")}</option>
                <option value="expense">{t("dashboard", "captureDestExpense")}</option>
                <option value="bill">{t("dashboard", "captureDestBill")}</option>
                <option value="receivable">{t("dashboard", "captureDestReceivable")}</option>
              </select>
            </div>

            {/* Cost / profit centre. Hidden entirely when the workspace has no
                groups — an empty dropdown is a question with no answers. */}
            {groups.length > 0 && (
              <div>
                <label className={`block text-xs font-semibold mb-1 ${labelText}`}>
                  {t("dashboard", "captureGroup")}
                </label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${input}`}
                >
                  <option value="">{t("dashboard", "captureGroupNone")}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                onClick={discard}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium ${isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
              >
                {t("dashboard", "captureDiscard")}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-60"
              >
                {saving ? t("dashboard", "saving") : t("dashboard", "captureConfirm")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
