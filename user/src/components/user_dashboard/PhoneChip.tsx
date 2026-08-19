"use client";

import { useEffect, useState } from "react";
import { getMe, saveMyPhone } from "@/lib/api/me";

/**
 * "Add phone number" in the sidebar, for accounts that have not given one.
 *
 * Nothing has ever asked for a phone number — the column has existed on
 * `user_profiles` all along and every row is empty — so this is the first place
 * that does. It disappears once a number is on file, like the verify prompt
 * above it: a permanent request for something already done is noise beside
 * navigation.
 *
 * This is the PERSONAL number. The business's own number is a separate field on
 * the business profile, and the admin panel shows them on separate tabs, because
 * "how do I reach this person" and "how do I reach this company" are different
 * questions even when a sole trader answers both with the same digits.
 */
export default function PhoneChip({ isDark }: { isDark: boolean }) {
  const [needed, setNeeded] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    getMe()
      .then((me) => setNeeded(!((me.profile?.phone as string) ?? "").trim()))
      // A failed lookup hides it. Asking someone for a number they already gave
      // is worse than not asking.
      .catch(() => setNeeded(false));
  }, []);

  if (!needed) return null;

  const shape =
    "w-full mt-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold " +
    "flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60";

  const save = async () => {
    const value = phone.trim();
    if (!value) return;
    setState("saving");
    try {
      await saveMyPhone(value);
      setState("saved");
      // Leave the confirmation up briefly, then remove the prompt entirely.
      setTimeout(() => setNeeded(false), 1500);
    } catch {
      setState("error");
    }
  };

  if (state === "saved") {
    return (
      <div className={`${shape} ${isDark ? "border-green-600 text-green-400" : "border-green-600 text-green-700"}`}>
        Saved
      </div>
    );
  }

  if (open) {
    return (
      <div className="mt-2 space-y-1.5">
        <input
          type="tel"
          value={phone}
          autoFocus
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setOpen(false); setState("idle"); }
          }}
          placeholder="+1 555 123 4567"
          className={`w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none ${
            isDark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          }`}
        />
        <div className="flex gap-1.5">
          <button
            onClick={save}
            disabled={state === "saving" || !phone.trim()}
            className="flex-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-[13px] font-semibold py-1.5"
          >
            {state === "saving" ? "Saving…" : state === "error" ? "Try again" : "Save"}
          </button>
          <button
            onClick={() => { setOpen(false); setState("idle"); }}
            className={`rounded-lg border px-3 text-[13px] font-semibold ${
              isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      title="Add a phone number to your account"
      className={`${shape} ${
        isDark
          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
          : "border-gray-300 text-gray-700 hover:bg-gray-50"
      }`}
    >
      Add Phone Number
    </button>
  );
}
