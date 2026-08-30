"use client";

import { ReactNode, useEffect, useRef } from "react";

/** Anything a person can Tab to. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type DialogTone = "default" | "danger" | "warning";

/** One place decides what "danger" looks like, so the two dialogs can't drift. */
export const toneButton = (tone: DialogTone = "default") =>
  tone === "danger"
    ? "bg-red-500 hover:bg-red-600"
    : tone === "warning"
      ? "bg-amber-500 hover:bg-amber-600"
      : "bg-blue-500 hover:bg-blue-600";

/**
 * The backdrop, the card and the keyboard behaviour every in-app dialog shares.
 *
 * ConfirmDialog and usePrompt used to own separate copies of this, and they had
 * already drifted: opposite button orders, different busy labels, Escape in one
 * and not the other, and `role="dialog"` on the card in one and on the backdrop
 * in the other. Both now render through here, so there is one answer per
 * question rather than two.
 *
 * Three behaviours are deliberate:
 *
 * `stopPropagation` on the backdrop. These dialogs are frequently rendered
 * INSIDE another modal whose own backdrop closes it on click — AddNodeModal is
 * the example. Without this, dismissing a delete confirmation also tore down
 * the editor behind it and discarded whatever had been typed.
 *
 * Nothing dismisses while `busy`. The buttons were already disabled mid-action,
 * but the backdrop and Escape were not, so clicking away from a running delete
 * made the dialog vanish as though it had been cancelled while the delete
 * carried on. A dismissal that does not dismiss is worse than no dismissal.
 *
 * The page behind stops scrolling while it is open, and focus is trapped
 * inside it. `aria-modal` is a promise to assistive technology that the rest of
 * the page is inert; without a trap that promise is false, and Tab walks onto
 * buttons the reader cannot see but can still press. Focus goes back where it
 * came from on close, so keyboard users do not lose their place.
 */
export default function DialogShell({
  open, isDark, titleId, busy = false, onDismiss, children,
}: {
  open: boolean;
  isDark: boolean;
  /** Id of the heading inside `children`, so the dialog has an accessible name. */
  titleId: string;
  busy?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  // Held in a ref so an inline arrow from the caller doesn't re-bind the key
  // listener on every render.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) dismiss.current();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, busy]);

  /**
   * Keyed on `open` alone, deliberately: including `busy` would re-run this
   * mid-action and yank focus back to the first button while something is
   * still going.
   */
  useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    const returnTo = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(card?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    // The card itself is the fallback when nothing inside can take focus.
    (focusable()[0] ?? card)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const outside = !card?.contains(active);

      if (e.shiftKey && (active === first || outside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || outside)) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const card = isDark
    ? "bg-gray-800 text-white border-gray-700"
    : "bg-white text-gray-900 border-gray-200";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { e.stopPropagation(); if (!busy) dismiss.current(); }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl outline-none ${card}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The footer both dialogs end with. Confirm sits first and takes the width,
 * which is the order every existing confirmation in the app already used.
 */
export function DialogButtons({
  confirmLabel, cancelLabel, workingLabel, tone, busy, isDark, onConfirm, onCancel,
}: {
  confirmLabel: string;
  cancelLabel: string;
  workingLabel: string;
  tone?: DialogTone;
  busy: boolean;
  isDark: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 mt-5">
      <button
        onClick={onConfirm}
        disabled={busy}
        className={`flex-1 text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60 ${toneButton(tone)}`}
      >
        {busy ? workingLabel : confirmLabel}
      </button>
      <button
        onClick={onCancel}
        disabled={busy}
        className={`px-4 py-2.5 rounded-lg border text-sm font-semibold disabled:opacity-60 ${
          isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
        }`}
      >
        {cancelLabel}
      </button>
    </div>
  );
}
