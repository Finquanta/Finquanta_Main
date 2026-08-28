"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/api/me";
import PhoneDialog from "./PhoneDialog";

/**
 * "Add phone number" in the sidebar, for accounts that have not given one.
 *
 * Nothing has ever asked for a phone number — the column has existed on
 * `user_profiles` all along and every row is empty — so this is the first place
 * that does. It disappears once a number is on file, like the verify prompt
 * above it: a permanent request for something already done is noise beside
 * navigation.
 *
 * The form itself is a DIALOG, not an inline box: picking a country and
 * typing digits are two decisions, and a 56-pixel sidebar is the wrong place
 * to make either. This button only decides whether to ask.
 *
 * This is the PERSONAL number. The business's own number is a separate field on
 * the business profile, and the admin panel shows them on separate tabs, because
 * "how do I reach this person" and "how do I reach this company" are different
 * questions even when a sole trader answers both with the same digits.
 */
export default function PhoneChip({ isDark }: { isDark: boolean }) {
  const [needed, setNeeded] = useState(false);
  const [open, setOpen] = useState(false);
  /** The workspace's country, so the dialog can pre-select a dialling code. */
  const [country, setCountry] = useState<string | undefined>(undefined);

  useEffect(() => {
    getMe()
      .then((me) => {
        setNeeded(!((me.profile?.phone as string) ?? "").trim());
        const c = (me.profile?.country as string) ?? "";
        if (c.trim()) setCountry(c.trim());
      })
      // A failed lookup hides it. Asking someone for a number they already gave
      // is worse than not asking.
      .catch(() => setNeeded(false));
  }, []);

  if (!needed) return null;

  const shape =
    "w-full mt-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold " +
    "flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60";

  return (
    <>
      <PhoneDialog
        open={open}
        onClose={() => setOpen(false)}
        defaultCountry={country}
        // Saved: the prompt has done its job and should stop asking.
        onSaved={() => setNeeded(false)}
      />
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
    </>
  );
}
