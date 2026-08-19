"use client";

import { ReactNode } from "react";

/**
 * An in-app confirmation, replacing `window.confirm`.
 *
 * The browser's own box is unstyleable, prefixed with "localhost:3000 says",
 * and visually identical to the scam prompts people are trained to dismiss
 * without reading. Every place it was used here asks about something
 * consequential — leaving a workspace, handing over a company, adding a charge
 * to a bill — which is exactly the wrong thing to ask in a dialog people have
 * learned to click through.
 *
 * Deliberately dumb: it renders what it is given and calls back. Each caller
 * knows what its own action costs, so the wording lives with the action rather
 * than in here.
 */
export default function ConfirmDialog({
  open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel",
  tone = "default", busy = false, isDark, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for anything that removes access or destroys something. */
  tone?: "default" | "danger" | "warning";
  busy?: boolean;
  isDark: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const card = isDark ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-200";
  const confirmColor =
    tone === "danger" ? "bg-red-500 hover:bg-red-600"
      : tone === "warning" ? "bg-amber-500 hover:bg-amber-600"
        : "bg-blue-500 hover:bg-blue-600";

  return (
    // z-[80]: above the team panel (z-60) that opens most of these.
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${card}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-base font-bold">{title}</h3>
        <div className={`mt-2 text-sm leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
          {body}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60 ${confirmColor}`}
          >
            {busy ? "Working…" : confirmLabel}
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
      </div>
    </div>
  );
}
