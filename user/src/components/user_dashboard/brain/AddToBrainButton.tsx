"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { EntityType, attachEntityToBrain } from "@/lib/api/brain";

/**
 * "Add to Company Brain" — the bridge from a ledger record to the Brain.
 *
 * Drops onto any page that shows a record. It stores a pointer and nothing
 * else, then takes the user straight to the new node so they can write down
 * WHY the record matters while they're still thinking about it. That handoff is
 * the point: a reference with no note attached is just a bookmark.
 *
 * Attaching a record that's already in the Brain opens the existing node
 * instead of creating a second one — the server dedupes, so clicking twice is
 * safe by construction rather than by the button remembering anything.
 */
export default function AddToBrainButton({
  isDark, entityType, entityId, title, variant = "button", className = "",
}: {
  isDark: boolean;
  entityType: EntityType;
  entityId: string;
  /** Default label for the node. The user can rename it; the record is untouched. */
  title?: string;
  /** "icon" for table rows, "button" for detail pages. */
  variant?: "icon" | "button";
  className?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();

  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (state === "saving") return;
    setState("saving");
    setError(null);
    try {
      const node = await attachEntityToBrain({ entityType, entityId, title });
      setState("done");
      // Straight into the Brain with the node open, ready for the note.
      router.push(`/brain?node=${node.id}`);
    } catch (e) {
      setState("idle");
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrAttach"));
    }
  };

  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const label = t("dashboard", "brainAddToBrain");

  if (variant === "icon") {
    return (
      <button
        onClick={add}
        disabled={state === "saving"}
        title={error ?? label}
        aria-label={label}
        className={`${sub} hover:text-purple-500 disabled:opacity-50 ${error ? "text-red-500" : ""} ${className}`}
      >
        {state === "saving"
          ? <Loader2 className="h-4 w-4 inline animate-spin" />
          : state === "done"
            ? <Check className="h-4 w-4 inline text-green-500" />
            : <Brain className="h-4 w-4 inline" />}
      </button>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={add}
        disabled={state === "saving"}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-60 ${
          isDark ? "border-gray-700 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-100"
        }`}
      >
        {state === "saving"
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : state === "done"
            ? <Check className="h-4 w-4 text-green-500" />
            : <Brain className="h-4 w-4" />}
        {label}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
