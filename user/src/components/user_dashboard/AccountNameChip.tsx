"use client";

import { useEffect, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { CurrentUser, getMe, updateName } from "@/lib/api/me";

/**
 * The avatar + inline-editable account name from the dashboard's top bar.
 *
 * Extracted so every tab's bar is identical. It used to exist only inline on
 * the Dashboard page, so moving to Invoices or Customers dropped the avatar and
 * the name entirely and the bar visibly changed shape between tabs.
 *
 * Click the name to edit; Enter or the tick saves, Escape cancels. A failed save
 * keeps the previous name rather than showing something that was never stored.
 */
export default function AccountNameChip({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  const displayName = me ? `${me.firstName} ${me.lastName}`.trim() || "User" : "User";

  const startEdit = () => {
    setDraft(me ? `${me.firstName} ${me.lastName}`.trim() : "");
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const parts = draft.trim().split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");
    if (!firstName) { setEditing(false); return; }
    setError(null);
    try {
      await updateName({ firstName, lastName });
      setMe((prev) => (prev ? { ...prev, firstName, lastName } : prev));
      setEditing(false);
    } catch (e) {
      /*
       * Say what went wrong and stay open.
       *
       * This used to swallow the error and close, so a rejected save was
       * indistinguishable from the feature being broken — the name just snapped
       * back. Closing also threw away what they typed.
       */
      setError(e instanceof Error ? e.message : "Could not save your name.");
    }
  };

  const input = isDark
    ? "bg-gray-700 border-gray-600 text-white"
    : "bg-white border-gray-300 text-gray-900";

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0" />
      {editing ? (
        <div className="relative flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className={`text-sm font-medium rounded px-2 py-0.5 w-40 outline-none border ${error ? "border-red-500" : input}`}
            placeholder={t("dashboard", "yourName")}
          />
          <button onClick={save} className="text-green-500 hover:text-green-600" title={t("dashboard", "saveChanges")}>
            <Check className="h-4 w-4" />
          </button>
          {/* Absolute so a failed save can't push the nav bar around. */}
          {error && (
            <span className="absolute top-full left-0 mt-1 whitespace-nowrap text-xs text-red-500">{error}</span>
          )}
        </div>
      ) : (
        <button
          onClick={startEdit}
          className={`group flex items-center gap-1 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}
          title={t("dashboard", "editNameTitle")}
        >
          {displayName}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
        </button>
      )}
    </div>
  );
}
