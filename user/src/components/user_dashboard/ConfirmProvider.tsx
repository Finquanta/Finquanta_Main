"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { ConfirmRequest, useConfirm } from "@/hooks/useConfirm";
import { PromptRequest, usePrompt } from "@/hooks/usePrompt";

/**
 * One confirmation and one prompt for the whole tree, mounted once.
 *
 * The hooks work perfectly well on their own, but using them takes three steps
 * and the third is invisible: import, call, and render `{dialog}` somewhere.
 * Miss that last one and nothing breaks loudly — `ask()` sets state that
 * nothing is listening to, so the button simply does nothing. No error, no
 * warning, no clue. That is the worst shape a bug can have, and it is waiting
 * for whoever adds the next destructive button.
 *
 * With the dialogs mounted at the layout, a page asks a question and cannot
 * forget to render the answer:
 *
 *     const { ask } = useAsk();
 *     ask({ title: "Delete this?", tone: "danger", onConfirm: … });
 *
 * Scope: the dashboard and the demo, where ThemeContext is the single source of
 * truth for light or dark. The admin panel keeps calling `useConfirm(dark)`
 * directly — its theme is per-page `useState` seeded from localStorage with no
 * context and no change event, so a provider up at the layout would show a
 * stale colour the moment somebody toggled it. Both paths run the same hook
 * underneath; the provider is only deciding where it lives.
 *
 * A surface that is a fixed colour regardless of the app theme passes `isDark`
 * on the individual request.
 */

interface AskContext {
  ask: (request: ConfirmRequest) => void;
  askFor: (request: PromptRequest) => void;
}

const Ctx = createContext<AskContext | null>(null);

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { ask, dialog } = useConfirm(isDark);
  const { askFor, dialog: promptDialog } = usePrompt(isDark);

  // `ask` and `askFor` are stable, so consumers do not re-render on every
  // render of the provider.
  const value = useMemo(() => ({ ask, askFor }), [ask, askFor]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialog}
      {promptDialog}
    </Ctx.Provider>
  );
}

export function useAsk(): AskContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAsk must be used within ConfirmProvider");
  return ctx;
}
