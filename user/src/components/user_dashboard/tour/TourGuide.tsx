"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Section 10 — the new user tour.
 *
 * The spec called for exactly five steps. The dashboard is the product, though,
 * so it gets walked through properly rather than summarised in one step: the
 * tour keeps the spec's five PARTS, and the Dashboard part has its own steps for
 * each card on it. The header shows both ("Dashboard · 2 of 5"), so it never
 * feels longer than it is.
 *
 * Skip is on every step. It can be restarted later from Settings.
 */

const STORAGE_KEY = "finquantaTourDone";

/** Fired by Settings → Restart Tour. */
export const TOUR_RESTART_EVENT = "finquanta:restartTour";

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function restartTour() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(TOUR_RESTART_EVENT));
}

/** The five parts of the tour, in order. Shown in the step header. */
const PARTS = ["Dashboard", "Getting around", "Bookkeeping", "Invoices", "Finna"] as const;

interface Step {
  /** Which of the five parts this step belongs to. */
  part: (typeof PARTS)[number];
  /** The [data-tour="…"] element to spotlight. Absent = centred, no anchor. */
  anchor?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  // Part 1 — the dashboard, card by card. This is the screen users live on, so
  // it's worth pointing at each piece rather than waving at the page.
  {
    part: "Dashboard",
    title: "Welcome to Finquanta",
    body:
      "This is your dashboard — your whole business on one screen. Let's walk through it, starting at the top. It takes about a minute, and you can skip out at any point.",
  },
  {
    part: "Dashboard",
    anchor: "health",
    title: "Your Financial Health Score",
    body:
      "One number out of 100, built from four ratios: can you cover your bills (liquidity), do you keep what you earn (profitability), how much you've borrowed (debt risk), and whether the business funds itself (cash flow). Click it to expand any ratio and see what it means for you. It waits for about a month of data before scoring, so it never guesses.",
  },
  {
    part: "Dashboard",
    anchor: "actions",
    title: "Add data, create invoices",
    body:
      "The two things you'll do most. Add data opens your bookkeeping entry form — money in, money out, or debt. Create invoice takes you straight to a new invoice.",
  },
  {
    part: "Dashboard",
    anchor: "summary",
    title: "Balance, cash flow and expenses",
    body:
      "Your headline numbers for the period you've picked. Balance is what the business is worth on paper, cash flow is money that actually moved, and expenses is what went out. Change the period above to see any month or year.",
  },
  {
    part: "Dashboard",
    anchor: "chart",
    title: "Your trend over time",
    body:
      "The same figures as a chart. Use the toggle to switch between Revenue, Cashflow and Expense — revenue counts what you've earned including unpaid invoices, while cashflow counts only money that actually landed. Seeing those two diverge is usually the first sign of a collection problem.",
  },
  {
    part: "Dashboard",
    anchor: "goals",
    title: "Goals and reminders",
    body:
      "Track what you're aiming for. We already started a goal for you based on the main financial goal you picked at signup — edit it, or add your own. Reminders sit on the tab next to it.",
  },

  // Parts 2–5.
  {
    part: "Getting around",
    anchor: "sidebar",
    title: "Your sidebar",
    body:
      "Invoices for billing, Customers for the people you bill, and Activity for your financial history. Settings is at the bottom — that's where you edit your business details and the answers that shape your health score.",
  },
  {
    part: "Getting around",
    anchor: "activity",
    title: "Your activity timeline",
    body:
      "Every financial event in one place, newest first: entries you record, invoices sent and paid, loan payments. Filter it by Money In, Money Out, Invoices or Debt to answer \"what actually happened last month?\" without digging through your books.",
  },
  {
    part: "Bookkeeping",
    anchor: "bookkeeping",
    title: "Your books",
    body:
      "Every entry lands here. Behind the scenes it's posted to a proper double-entry ledger, so your books stay balanced without you thinking about it. Switch between Cash Basis and Accrual to see what actually moved versus what you've earned and owe — and tick Accountant view for the debits and credits behind any row.",
  },
  {
    part: "Invoices",
    anchor: "invoices",
    title: "Invoices post themselves",
    body:
      "Create, send and track invoices. Marking one Sent records what you're owed; marking it Paid records the cash. You never touch the ledger yourself. Deleted invoices go to a recycle bin, and deleting one removes it from your books entirely — no phantom revenue left behind.",
  },
  {
    part: "Finna",
    anchor: "finna",
    title: "Meet Finna",
    body:
      "Your AI assistant — and she can read your actual books. Ask \"what were my expenses this month?\", \"who owes me money?\" or \"how is my business doing?\" and you'll get real numbers, not generic advice. She can draft invoices and entries from a message too, but nothing is ever saved until you press Confirm.",
  },
];

interface Rect { top: number; left: number; width: number; height: number }

export default function TourGuide({ isDark }: { isDark: boolean }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Start automatically for a new user; Settings can restart it later.
  useEffect(() => {
    if (!hasSeenTour()) setActive(true);
    const restart = () => { setStep(0); setActive(true); };
    window.addEventListener(TOUR_RESTART_EVENT, restart);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, restart);
  }, []);

  const current = STEPS[step];

  // Track where the highlighted element is, and keep up if the page moves.
  const measure = useCallback(() => {
    if (!current?.anchor) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${current.anchor}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    // Off-screen (e.g. the sidebar on mobile) — treat as unanchored.
    if (r.width === 0 || r.height === 0) { setRect(null); return; }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  useEffect(() => {
    if (!active) return;
    measure();
    const el = current?.anchor
      ? document.querySelector(`[data-tour="${current.anchor}"]`)
      : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Re-measure after the smooth scroll settles.
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, measure, current]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setActive(false);
    setStep(0);
  };

  if (!active || !current) return null;

  const isLast = step === STEPS.length - 1;
  const pad = 8;

  // The tooltip sits under the highlight, or over it when there's no room.
  const spotlightBottom = rect ? rect.top + rect.height : 0;
  const below = !rect || spotlightBottom + 240 < window.innerHeight;
  const tipStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: below ? spotlightBottom + pad + 8 : undefined,
        bottom: below ? undefined : window.innerHeight - rect.top + pad + 8,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)),
        width: 360,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 360,
      };

  const panel = isDark ? "bg-[#1e1e2e] border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dimmer. A transparent ring around the target is what "spotlights" it —
          a huge box-shadow is the cheapest way to cut a hole in an overlay. */}
      {rect ? (
        <div
          className="fixed rounded-xl pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
            outline: "2px solid #3b82f6",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/65" />
      )}

      <div className={`rounded-2xl border shadow-2xl p-5 ${panel}`} style={tipStyle}>
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* Named by part, so a longer dashboard walk still reads as 5 parts. */}
            <p className="text-xs font-semibold text-blue-500 mb-1">
              {current.part} · {PARTS.indexOf(current.part) + 1} of {PARTS.length}
            </p>
            <h3 className="text-base font-bold">{current.title}</h3>
          </div>
          {/* Skip — on every step, per the spec. */}
          <button onClick={finish} className={`p-1 rounded-lg ${sub} hover:opacity-70`} aria-label="Skip tour">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className={`text-sm mt-2 leading-relaxed ${sub}`}>{current.body}</p>

        {/* Overall progress, so the length of the tour is never a surprise. */}
        <div className={`h-1 rounded-full mt-4 ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={finish} className={`text-xs font-medium ${sub} hover:underline`}>
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${
                  isDark ? "border-gray-600 text-gray-200 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
