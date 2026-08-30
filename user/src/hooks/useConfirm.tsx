"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
import ConfirmDialog from "@/components/user_dashboard/ConfirmDialog";
import { DialogTone } from "@/components/user_dashboard/DialogShell";
import { useLanguage } from "@/hooks/context/LanguageContext";

/**
 * `window.confirm`, replaced — without twenty lines of state at every call site.
 *
 * The browser's own box works, but it has three problems that matter. It is
 * prefixed with the host name and looks exactly like the prompts people are
 * trained to dismiss without reading, so the pause it is meant to create often
 * does not happen. It renders "delete this customer" and "delete your entire
 * financial history" identically, with no way to mark one as graver than the
 * other. And browsers offer a "prevent this page from creating additional
 * dialogues" tick after a few in a row — once that is set, every later
 * `confirm()` returns false on its own, so the action silently never runs and
 * nothing on screen explains why. That last one is a real failure, and it is
 * likeliest during exactly the bulk tidy-up where these appear most.
 *
 * ConfirmDialog already existed and fixes all three. What stopped it spreading
 * was the cost of adopting it: a piece of state, a handler and a rendered
 * element per call. This packages that into two lines.
 *
 *     const { ask, dialog } = useConfirm(isDark);
 *
 *     ask({
 *       title: "Delete this customer?",
 *       body: "This cannot be undone.",
 *       tone: "danger",
 *       onConfirm: async () => { await deleteCustomer(c.id); load(); },
 *     });
 *
 *     return <>{dialog}</>;   // anywhere in the tree
 *
 * `onConfirm` may be async: the dialog shows its busy state until the promise
 * settles, then closes itself. By default it closes even if the promise
 * rejects, because most callers already have somewhere to report an error and a
 * dialog stuck open over a banner is worse than one that got out of the way.
 *
 * `keepOpenOnError` inverts that for the callers that do NOT — the question
 * stays on screen with the failure printed under it, so the button can simply
 * be pressed again. The dashboard's ledger deletions work this way: there is no
 * error banner behind the dialog for them to fall back to.
 *
 * Labels default to translated strings, so a caller that does not care gets the
 * user's language rather than English.
 */

export interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for anything that destroys something or removes access. */
  tone?: DialogTone;
  /** Keep the question up and print the failure under it, instead of closing. */
  keepOpenOnError?: boolean;
  /**
   * Overrides the ambient theme for this one question. For surfaces that are a
   * fixed colour regardless of the app theme — the bookkeeping modal is always
   * dark, the demo invoice preview always light — so the dialog matches what it
   * sits on rather than what the rest of the app is set to.
   */
  isDark?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function useConfirm(isDark: boolean) {
  const { t } = useLanguage();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Tracked synchronously so `onConfirm` is free to open the next question by
   * calling `ask` again — without the close that follows wiping it out. Same
   * reasoning as the `latest` ref in usePrompt.
   */
  const latest = useRef<ConfirmRequest | null>(null);

  // Stable identities: call sites keep these in `useCallback` dependency lists,
  // and a fresh function each render would quietly defeat the memo.
  const ask = useCallback((next: ConfirmRequest) => {
    latest.current = next;
    setRequest(next);
    setBusy(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    latest.current = null;
    setRequest(null);
    setBusy(false);
    setError(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={!!request}
      isDark={request?.isDark ?? isDark}
      busy={busy}
      tone={request?.tone}
      title={request?.title ?? ""}
      body={
        <>
          {request?.body}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </>
      }
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      onCancel={() => { if (!busy) close(); }}
      onConfirm={async () => {
        if (!request || busy) return;
        const current = request;
        setBusy(true);
        setError(null);
        try {
          await current.onConfirm();
          // Not closed when `onConfirm` chained another question onto this one.
          if (latest.current === current) close();
        } catch (e) {
          if (latest.current !== current) return;
          if (!current.keepOpenOnError) { close(); return; }
          setError(e instanceof Error ? e.message : t("dashboard", "dialogFailed"));
          setBusy(false);
        }
      }}
    />
  );

  return { ask, dialog };
}
