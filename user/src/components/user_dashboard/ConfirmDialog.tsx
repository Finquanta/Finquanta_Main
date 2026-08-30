"use client";

import { ReactNode, useId } from "react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import DialogShell, { DialogButtons, DialogTone } from "./DialogShell";

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
 * than in here. The backdrop, the card and the keyboard handling come from
 * DialogShell, which usePrompt shares.
 *
 * The button labels default to translated strings rather than English literals.
 * `window.confirm` had its buttons localized by the browser, so hardcoding
 * "Confirm"/"Cancel" here would have been a regression in nine of ten locales.
 */
export default function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel,
  tone = "default", busy = false, isDark, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for anything that removes access or destroys something. */
  tone?: DialogTone;
  busy?: boolean;
  isDark: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const titleId = useId();

  return (
    <DialogShell open={open} isDark={isDark} busy={busy} titleId={titleId} onDismiss={onCancel}>
      <h3 id={titleId} className="text-base font-bold">{title}</h3>
      <div className={`mt-2 text-sm leading-relaxed ${isDark ? "text-gray-300" : "text-gray-600"}`}>
        {body}
      </div>

      <DialogButtons
        confirmLabel={confirmLabel ?? t("dashboard", "dialogConfirm")}
        cancelLabel={cancelLabel ?? t("dashboard", "dialogCancel")}
        workingLabel={t("dashboard", "dialogWorking")}
        tone={tone}
        busy={busy}
        isDark={isDark}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </DialogShell>
  );
}
