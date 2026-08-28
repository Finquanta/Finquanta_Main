"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, X } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { themeClasses } from "@/lib/theme";
import { DueItem, getRecurringDue, skipRecurring } from "@/lib/api/recurring";
import { createTransaction } from "@/lib/api/transactions";
import { Group, getGroups } from "@/lib/api/groups";
import { PaymentRequiredError } from "@/lib/api/client";

/**
 * "You paid this last month — did you pay it again?"
 *
 * A monthly subscription is the easiest thing in the world to forget to record,
 * because nothing happens when you forget. The money leaves the account either
 * way and the books just quietly stop matching.
 *
 * TWO STEPS, deliberately, and the second is the point.
 *
 * The first asks whether it happened at all — the only question somebody can
 * answer from memory. Saying yes does NOT post anything: it opens the entry for
 * review, where the amount, the name, the date and the group can all be changed
 * before it goes anywhere. Prices go up, a payment lands a day late, a cost
 * moves to a different project. A prompt that wrote the entry straight to the
 * books on one click would be a prompt that quietly files last month's figure
 * forever.
 *
 * Saying no is recorded; saying "not now" is not, and comes back next time.
 */

/** Deferrals live for the tab, not the workspace — "not now" means today. */
const DEFERRED_KEY = "recurringDeferredV1";

/**
 * Confirming one occurrence can reveal the next for somebody catching up, so
 * the queue is refilled when it empties — but only a few times, because an
 * unbounded run of prompts is indistinguishable from a broken page.
 */
const MAX_REFILLS = 3;

const idOf = (i: DueItem) => `${i.seriesKey}@${i.dueDate}`;

function readDeferred(): string[] {
  try {
    const raw = sessionStorage.getItem(DEFERRED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function defer(id: string): void {
  try {
    sessionStorage.setItem(DEFERRED_KEY, JSON.stringify([...readDeferred(), id]));
  } catch {
    /* a blocked store must not break the dashboard */
  }
}

/** "20 September 2026" — unambiguous, unlike any all-numeric format. */
function pretty(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function RecurringDueDialog() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = themeClasses(isDark);

  const [queue, setQueue] = useState<DueItem[]>([]);
  const [step, setStep] = useState<"ask" | "review">("ask");
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** `sessionStorage` and `document` do not exist during the server render. */
  const [mounted, setMounted] = useState(false);
  const refills = useRef(0);

  // The editable copy, kept separate from the queue item so backing out of a
  // review leaves the original untouched.
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [groupId, setGroupId] = useState("");
  const [note, setNote] = useState("");

  const current = queue[0] ?? null;

  const load = useCallback(async () => {
    try {
      const due = await getRecurringDue();
      const deferred = new Set(readDeferred());
      setQueue(due.filter((d) => !deferred.has(idOf(d))));
    } catch {
      // Not signed in yet, or the server is waking. This is a nicety, so it can
      // simply not appear.
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
    getGroups().then(setGroups).catch(() => setGroups([]));
    // A different workspace has entirely different books.
    const onSwitch = () => {
      refills.current = 0;
      setStep("ask");
      load();
    };
    window.addEventListener("finna:businessChanged", onSwitch);
    return () => window.removeEventListener("finna:businessChanged", onSwitch);
  }, [load]);

  /** Drop the head of the queue, and refill once it runs dry. */
  const advance = useCallback(() => {
    setStep("ask");
    setError(null);
    setQueue((prev) => {
      const rest = prev.slice(1);
      if (rest.length === 0 && refills.current < MAX_REFILLS) {
        refills.current += 1;
        load();
      }
      return rest;
    });
  }, [load]);

  if (!mounted || !current) return null;

  const isIncome = current.type === "income";
  const verb = isIncome ? "receive" : "pay";

  const openReview = () => {
    setName(current.name);
    setAmount(String(current.amount));
    setDate(current.dueDate);
    setGroupId(current.groupId ?? "");
    setNote(current.description ?? "");
    setError(null);
    setStep("review");
  };

  const notNow = () => {
    defer(idOf(current));
    advance();
  };

  const sayNo = async () => {
    setBusy(true);
    try {
      await skipRecurring(current.seriesKey, current.dueDate);
      advance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const value = Number(amount);
    if (!name.trim()) return setError("Give it a name.");
    if (!(value > 0)) return setError("The amount has to be more than zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Pick a date.");

    setBusy(true);
    setError(null);
    try {
      await createTransaction({
        type: current.type,
        category: name.trim(),
        amount: value,
        date,
        description: note.trim() || undefined,
        groupId: groupId || null,
        /**
         * Carried over, and it has to be: the recurrence is what makes this a
         * series at all. Dropping it here would post the entry and then never
         * ask again — the exact failure this feature exists to prevent.
         */
        recurrence: current.recurrence,
      });
      advance();
    } catch (e) {
      setError(
        e instanceof PaymentRequiredError
          ? "That is more entries than your plan allows this month."
          : e instanceof Error
            ? e.message
            : "Could not add that to the books."
      );
    } finally {
      setBusy(false);
    }
  };

  const field = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${c.input}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-title"
    >
      <div className={`w-full max-w-md rounded-xl shadow-xl ${c.surface}`}>
        <div className={`flex items-start justify-between p-5 border-b ${c.line}`}>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            <h2 id="recurring-title" className={`text-lg font-bold ${c.heading}`}>
              {step === "ask" ? "Does this still happen?" : "Check it before it goes in"}
            </h2>
          </div>
          <button onClick={notNow} aria-label="Close" className={`flex-shrink-0 ${c.quietControl}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "ask" ? (
          <div className="p-5 space-y-4">
            <p className={`text-sm ${c.body}`}>
              You recorded{" "}
              <span className={`font-semibold ${c.heading}`}>{current.name}</span> as{" "}
              {current.recurrence === "monthly" ? "a monthly" : "a yearly"}{" "}
              {isIncome ? "payment in" : "expense"}, last on{" "}
              <span className="font-medium">{pretty(current.lastDate)}</span>.
            </p>
            <p className={`text-sm ${c.body}`}>
              Did you {verb} it again on{" "}
              <span className={`font-semibold ${c.heading}`}>{pretty(current.dueDate)}</span>?
            </p>
            <p className={`text-xs ${c.muted}`}>
              Nothing is added to your books yet — you can change the amount, name, group and date
              on the next step.
            </p>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                onClick={notNow}
                disabled={busy}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium ${c.body} ${c.hover}`}
              >
                Not now
              </button>
              <button
                onClick={sayNo}
                disabled={busy}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${c.line} ${c.body} ${c.hover}`}
              >
                No, it stopped
              </button>
              <button
                onClick={openReview}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60"
              >
                Yes, I did
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${c.label}`}>
                {isIncome ? "Income name" : "Expense name"}
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${c.label}`}>Amount (USD)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={field}
                />
                {current.currency && current.currency !== "USD" && (
                  <p className={`mt-1 text-[11px] ${c.muted}`}>
                    Originally billed in {current.currency}. Your books are kept in USD, so put the
                    USD value here.
                  </p>
                )}
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${c.label}`}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={field}
                />
              </div>
            </div>

            {/* Only offered where there is something to choose — an empty
                dropdown is a question with no answers. */}
            {groups.length > 0 && (
              <div>
                <label className={`block text-xs font-semibold mb-1 ${c.label}`}>
                  Business group
                </label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className={field}
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={`block text-xs font-semibold mb-1 ${c.label}`}>
                Note (optional)
              </label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
            </div>

            <p className={`text-[11px] ${c.muted}`}>
              This stays marked as {current.recurrence}, so you will be asked again next time.
            </p>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setStep("ask");
                  setError(null);
                }}
                disabled={busy}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium ${c.body} ${c.hover}`}
              >
                Back
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60"
              >
                {busy ? "Adding…" : "Add to books"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
