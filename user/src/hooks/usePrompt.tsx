"use client";

import { ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import DialogShell, { DialogButtons, DialogTone } from "@/components/user_dashboard/DialogShell";

/**
 * `window.prompt`, replaced.
 *
 * The sibling of useConfirm, for the questions that want a VALUE rather than a
 * yes or no. The browser's prompt has every fault its confirm box does — it is
 * prefixed with the host name, unstyleable, and looks like the scam popups
 * people dismiss without reading — plus two of its own: it cannot show context
 * beside the field, and it cannot validate, so a bad answer is only discovered
 * after the box has closed.
 *
 * That matters most where it was still in use. "How many months should this
 * workspace keep paid features for free?" is a question about money, asked of
 * an admin, in a box that could not show what the current setting was.
 *
 *     const { askFor, dialog } = usePrompt(isDark);
 *
 *     askFor({
 *       title: 'Grandfather "Acme"',
 *       body: <p>Currently grandfathered until 3 March 2027.</p>,
 *       label: "Months from today",
 *       defaultValue: "6",
 *       type: "number",
 *       validate: (v) => (Number(v) >= 0 ? null : "Enter a number of months."),
 *       onSubmit: (value) => applyMonths(Number(value)),
 *     });
 *
 * Cancelling calls nothing at all, which is the same contract `prompt`
 * returning null had.
 *
 * `onSubmit` MAY open the next question by calling `askFor` again — see the
 * note on `latest` below for why that works.
 */

export interface PromptRequest {
  title: string;
  /** Context shown above the field — the part a browser prompt cannot do. */
  body?: ReactNode;
  label: string;
  defaultValue?: string;
  type?: "text" | "number" | "password";
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  /** Overrides the ambient theme for this one question. See ConfirmRequest. */
  isDark?: boolean;
  /** Return an error message to keep the dialog open, or null to accept. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void | Promise<void>;
}

export function usePrompt(isDark: boolean) {
  const { t } = useLanguage();
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fieldId = useId();

  /**
   * The request currently on screen, tracked synchronously.
   *
   * `onSubmit` is allowed to ask the NEXT question by calling `askFor` again —
   * renaming a Brain category asks for a name and then a role that way. State
   * alone could not express that: `submit` closed the dialog immediately after
   * awaiting `onSubmit`, so the follow-up request set inside the callback was
   * overwritten by the close a moment later and the second question never
   * appeared at all. Comparing against a ref that `askFor` updates synchronously
   * tells the difference between "this request finished" and "this request
   * handed over to another one".
   */
  const latest = useRef<PromptRequest | null>(null);

  // Stable identities, so a call site can hold these in a dependency list.
  const askFor = useCallback((next: PromptRequest) => {
    latest.current = next;
    setRequest(next);
    setValue(next.defaultValue ?? "");
    setError(null);
    setBusy(false);
  }, []);

  const close = useCallback(() => {
    latest.current = null;
    setRequest(null);
    setValue("");
    setError(null);
    setBusy(false);
  }, []);

  /** Backdrop and Escape must not dismiss a request that is still running. */
  const dismiss = () => { if (!busy) close(); };

  // Focus and select, so the default can be replaced by typing.
  useEffect(() => {
    if (request) inputRef.current?.select();
  }, [request]);

  const submit = async () => {
    if (!request || busy) return;
    const problem = request.validate?.(value) ?? null;
    if (problem) { setError(problem); return; }
    const current = request;
    setBusy(true);
    try {
      await current.onSubmit(value);
      // Only close if `onSubmit` did not chain another question onto this one.
      if (latest.current === current) close();
    } catch (e) {
      // Kept open on failure: closing would hide the reason and lose what was
      // typed, and the caller has no dialog left to report into.
      if (latest.current === current) {
        setError(e instanceof Error ? e.message : t("dashboard", "dialogFailed"));
        setBusy(false);
      }
    }
  };

  const dark = request?.isDark ?? isDark;
  const field = dark
    ? "bg-gray-900 border-gray-600 text-white"
    : "bg-gray-50 border-gray-300 text-gray-900";

  const dialog = (
    <DialogShell open={!!request} isDark={dark} busy={busy} titleId={titleId} onDismiss={dismiss}>
      <h3 id={titleId} className="text-base font-bold">{request?.title}</h3>
      {request?.body && (
        <div className={`mt-2 text-sm ${dark ? "text-gray-300" : "text-gray-600"}`}>
          {request.body}
        </div>
      )}

      <label htmlFor={fieldId} className="block mt-4 text-xs font-semibold">
        {request?.label}
      </label>
      <input
        id={fieldId}
        ref={inputRef}
        type={request?.type ?? "text"}
        value={value}
        placeholder={request?.placeholder}
        disabled={busy}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
        }}
        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-60 ${field}`}
      />

      {error && <p id={`${fieldId}-error`} className="mt-2 text-xs text-red-500">{error}</p>}

      <DialogButtons
        confirmLabel={request?.confirmLabel ?? t("dashboard", "dialogSave")}
        cancelLabel={request?.cancelLabel ?? t("dashboard", "dialogCancel")}
        workingLabel={t("dashboard", "dialogWorking")}
        tone={request?.tone}
        busy={busy}
        isDark={dark}
        onConfirm={submit}
        onCancel={close}
      />
    </DialogShell>
  );

  return { askFor, dialog };
}
