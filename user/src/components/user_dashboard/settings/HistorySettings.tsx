"use client";

import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, RotateCcw } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useAsk } from "@/components/user_dashboard/ConfirmProvider";
import {
  GoBackPoint, HistoryChange, HistoryGroup, getHistory, goBackTo, previewGoBack, undoChange,
} from "@/lib/api/history";

/**
 * Workspace settings → History (beta feature `books_history`).
 *
 * Every change to this workspace's books, newest first: who made it, when, and
 * what it changed. Owners and Admins can undo a single change, or go back to a
 * moment — every change after it undone at once. Undos are recorded too, so
 * they can be undone.
 *
 * A change here is one database transaction: an invoice and its lines saved
 * together show as one change. Scoped to the active workspace like the other
 * tabs; the panel remounts this when the workspace changes.
 */

type T = (namespace: string, key: string) => string;

const TABLE_KEY: Record<string, string> = {
  financial_transactions: "histTableTransaction",
  invoices: "histTableInvoice",
  invoice_items: "histTableInvoiceLine",
  loans: "histTableLoan",
  loan_payments: "histTableLoanPayment",
  customers: "histTableCustomer",
  groups: "histTableGroup",
  journal_entries: "histTableJournalEntry",
  journal_lines: "histTableJournalLine",
  transaction_receipts: "histTableReceipt",
};

const FIELD_KEY: Record<string, string> = {
  amount: "histFieldAmount",
  description: "histFieldDescription",
  category: "histFieldCategory",
  status: "histFieldStatus",
  total: "histFieldTotal",
  name: "histFieldName",
  date: "histFieldDate",
};

/** The field that names a record, in order of preference. */
const NAME_FIELDS = ["name", "number", "description", "category", "filename"];
const AMOUNT_FIELDS = ["amount", "total", "principal", "debit", "credit"];
/** Bookkeeping plumbing nobody edits on purpose. */
const HIDDEN_FIELDS = new Set(["id", "updated_at", "created_at", "__children", "business_id", "user_id", "created_by", "data"]);

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
};

const rowOf = (change: HistoryChange) => (change.after ?? change.before ?? {}) as Record<string, unknown>;

function titleOf(change: HistoryChange): string {
  const row = rowOf(change);
  for (const field of NAME_FIELDS) {
    const value = row[field];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function amountOf(change: HistoryChange): string | null {
  const row = rowOf(change);
  for (const field of AMOUNT_FIELDS) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "" && Number(value) !== 0) return String(value);
  }
  return null;
}

function differences(change: HistoryChange): { field: string; from: unknown; to: unknown }[] {
  if (change.op !== "U" || !change.before || !change.after) return [];
  const fields = new Set([...Object.keys(change.before), ...Object.keys(change.after)]);
  return [...fields]
    .filter((field) => !HIDDEN_FIELDS.has(field))
    .filter((field) => JSON.stringify(change.before![field]) !== JSON.stringify(change.after![field]))
    .map((field) => ({ field, from: change.before![field], to: change.after![field] }));
}

const tableLabel = (t: T, table: string) => (TABLE_KEY[table] ? t("dashboard", TABLE_KEY[table]) : table);
const fieldLabel = (t: T, field: string) => (FIELD_KEY[field] ? t("dashboard", FIELD_KEY[field]) : field.replace(/_/g, " "));

function ChangeLine({ change, t, isDark }: { change: HistoryChange; t: T; isDark: boolean }) {
  const op =
    change.op === "I"
      ? { label: t("dashboard", "histAdded"), tone: isDark ? "bg-green-900/40 text-green-300" : "bg-green-100 text-green-800" }
      : change.op === "U"
        ? { label: t("dashboard", "histEdited"), tone: isDark ? "bg-amber-900/40 text-amber-300" : "bg-amber-100 text-amber-800" }
        : { label: t("dashboard", "histDeleted"), tone: isDark ? "bg-red-900/40 text-red-300" : "bg-red-100 text-red-800" };
  const title = titleOf(change);
  const amount = amountOf(change);
  const changed = differences(change);
  const children = (change.before?.__children ?? null) as Record<string, unknown[]> | null;
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${op.tone}`}>{op.label}</span>
        <span className="font-medium">{tableLabel(t, change.table)}</span>
        {title && <span className="min-w-0 break-words">“{title}”</span>}
        {amount && change.op !== "U" && <span className={sub}>{amount}</span>}
      </div>
      {changed.length > 0 && (
        <ul className="mt-1 pl-4 text-xs space-y-0.5">
          {changed.slice(0, 6).map((d) => (
            <li key={d.field} className="break-words">
              <span className={sub}>{fieldLabel(t, d.field)}:</span> {show(d.from)} → {show(d.to)}
            </li>
          ))}
        </ul>
      )}
      {children && Object.keys(children).length > 0 && (
        <p className={`mt-1 pl-4 text-xs ${sub}`}>
          {t("dashboard", "histIncludes")}:{" "}
          {Object.entries(children).map(([table, rows]) => `${tableLabel(t, table)} × ${rows.length}`).join(", ")}
        </p>
      )}
    </li>
  );
}

export default function HistorySettings({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const { ask } = useAsk();

  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState("");

  const [goBackOpen, setGoBackOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [preview, setPreview] = useState<{ point: GoBackPoint; groups: HistoryGroup[] } | null>(null);

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const load = async (more = false) => {
    setLoading(true);
    setError(null);
    try {
      const page = await getHistory(more ? cursor : null);
      setGroups((prev) => (more ? [...prev, ...page.groups] : page.groups));
      setCursor(page.nextCursor);
      setCanUndo(page.canUndo);
      setUnavailable(false);
    } catch (e) {
      // The route does not exist for a workspace that cannot see the feature.
      if (message(e) === "Not found") setUnavailable(true);
      else setError(message(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = (group: HistoryGroup) =>
    ask({
      title: t("dashboard", "histUndoTitle"),
      body: t("dashboard", "histUndoBody"),
      tone: "warning",
      confirmLabel: t("dashboard", "histUndo"),
      onConfirm: async () => {
        setBusy(group.txid);
        setError(null);
        setNotice(null);
        try {
          await undoChange(group.txid);
          await load();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy("");
        }
      },
    });

  const showPreview = async (point: GoBackPoint) => {
    setBusy("preview");
    setError(null);
    setNotice(null);
    try {
      setPreview({ point, groups: await previewGoBack(point) });
      setGoBackOpen(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  };

  const confirmGoBack = () => {
    if (!preview) return;
    const point = preview.point;
    ask({
      title: t("dashboard", "histGoBackConfirmTitle"),
      body: t("dashboard", "histGoBackConfirmBody"),
      tone: "warning",
      confirmLabel: t("dashboard", "histConfirmGoBack"),
      onConfirm: async () => {
        setBusy("goback");
        setError(null);
        try {
          const { undone } = await goBackTo(point);
          setNotice(`${t("dashboard", "histGoBackDone")} ${undone}`);
          setPreview(null);
          setGoBackOpen(false);
          setWhen("");
          await load();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy("");
        }
      },
    });
  };

  const days = useMemo(() => {
    const byDay = new Map<string, { label: string; groups: HistoryGroup[] }>();
    for (const group of groups) {
      const at = new Date(group.at);
      const key = at.toDateString();
      if (!byDay.has(key)) {
        byDay.set(key, {
          label: at.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          groups: [],
        });
      }
      byDay.get(key)!.groups.push(group);
    }
    return [...byDay.values()];
  }, [groups]);

  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const card = isDark ? "border-gray-700" : "border-gray-200";
  const outline = `rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
    isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
  }`;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-green-500" />
          {t("dashboard", "histTitle")}
        </h3>
        <p className={`text-sm ${sub}`}>{t("dashboard", "histIntro")}</p>
      </div>

      {unavailable ? (
        <p className="text-sm">{t("dashboard", "histNotAvailable")}</p>
      ) : (
        <>
          {canUndo && (
            <div>
              {!goBackOpen ? (
                <button onClick={() => setGoBackOpen(true)} className={`${outline} inline-flex items-center gap-1.5`}>
                  <RotateCcw className="h-4 w-4" />
                  {t("dashboard", "histGoBack")}
                </button>
              ) : (
                <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
                  <p className={`text-sm ${sub}`}>{t("dashboard", "histGoBackHint")}</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      <span className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "histWhen")}</span>
                      <input
                        type="datetime-local"
                        value={when}
                        onChange={(e) => { setWhen(e.target.value); setPreview(null); }}
                        className={`rounded-lg border px-2 py-1.5 text-sm outline-none ${
                          isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                        }`}
                      />
                    </label>
                    <button
                      disabled={!when || busy === "preview"}
                      onClick={() => showPreview({ date: new Date(when).toISOString() })}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {t("dashboard", "histPreview")}
                    </button>
                    <button
                      onClick={() => { setGoBackOpen(false); setPreview(null); }}
                      className={`px-2 py-1.5 text-sm ${sub}`}
                    >
                      {t("dashboard", "invCancel")}
                    </button>
                  </div>

                  {preview &&
                    (preview.groups.length === 0 ? (
                      <p className="text-sm">{t("dashboard", "histNothingAfter")}</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          {t("dashboard", "histWillUndo")} {preview.groups.length}
                        </p>
                        <ul className="max-h-64 overflow-y-auto space-y-3 pr-1">
                          {preview.groups.map((g) => (
                            <li key={g.txid}>
                              <p className={`text-xs mb-1 ${sub}`}>
                                {new Date(g.at).toLocaleString()} · {g.actor ? g.actor.name : t("dashboard", "histBySystem")}
                              </p>
                              <ul className="space-y-1">
                                {g.changes.map((c) => <ChangeLine key={c.id} change={c} t={t} isDark={isDark} />)}
                              </ul>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={confirmGoBack}
                          disabled={busy === "goback"}
                          className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                        >
                          {t("dashboard", "histConfirmGoBack")}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {notice && <p className="text-sm text-green-600" aria-live="polite">{notice}</p>}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

          {!loading && groups.length === 0 && !error && (
            <p className={`text-sm ${sub}`}>{t("dashboard", "histEmpty")}</p>
          )}

          <div className="space-y-6">
            {days.map((day) => (
              <section key={day.label}>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${sub}`}>{day.label}</h4>
                <div className="space-y-3">
                  {day.groups.map((g) => (
                    <div key={g.txid} className={`rounded-xl border p-4 ${card} ${g.undoneBy ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className={`text-xs flex flex-wrap items-center gap-1.5 ${sub}`}>
                          <span>{new Date(g.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span>{g.actor ? g.actor.name : t("dashboard", "histBySystem")}</span>
                          {g.undoOf && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDark ? "bg-blue-900/40 text-blue-300" : "bg-blue-100 text-blue-800"}`}>
                              {t("dashboard", "histUndoOf")}
                            </span>
                          )}
                          {g.undoneBy && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}>
                              {t("dashboard", "histUndone")}
                            </span>
                          )}
                        </div>
                        {canUndo && (
                          <div className="flex flex-wrap items-center gap-2">
                            {!g.undoneBy && (
                              <button onClick={() => undo(g)} disabled={!!busy} className={outline}>
                                {t("dashboard", "histUndo")}
                              </button>
                            )}
                            <button
                              onClick={() => showPreview({ txid: g.txid })}
                              disabled={!!busy}
                              className={`text-xs underline disabled:opacity-50 ${sub}`}
                            >
                              {t("dashboard", "histGoBackHere")}
                            </button>
                          </div>
                        )}
                      </div>
                      <ul className="mt-3 space-y-2">
                        {g.changes.map((c) => <ChangeLine key={c.id} change={c} t={t} isDark={isDark} />)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {cursor && (
            <button onClick={() => load(true)} disabled={loading} className={outline}>
              {t("dashboard", "histLoadMore")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
